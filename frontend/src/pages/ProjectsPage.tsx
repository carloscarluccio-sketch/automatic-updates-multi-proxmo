import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import { DataTable, Column } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import { projectsService, Project, ProjectFormData } from '../services/projectsService';
import api from '../services/api';

interface Company {
  id: number;
  name: string;
}

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    company_id: undefined,
  });
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadProjects();
    if (currentUser?.role === 'super_admin') {
      loadCompanies();
    }
  }, [currentUser]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectsService.getAll();
      setProjects(data);
    } catch (error) {
      showSnackbar('Failed to load projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data.data || []);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || '',
        company_id: project.company_id,
      });
    } else {
      setEditingProject(null);
      setFormData({
        name: '',
        description: '',
        company_id: currentUser?.role === 'super_admin' ? undefined : currentUser?.company_id || undefined,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProject(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingProject) {
        await projectsService.update(editingProject.id, formData);
        showSnackbar('Project updated successfully', 'success');
      } else {
        await projectsService.create(formData);
        showSnackbar('Project created successfully', 'success');
      }
      handleCloseDialog();
      await loadProjects();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (project: Project) => {
    if (!window.confirm(`Are you sure you want to delete project "${project.name}"?`)) {
      return;
    }

    try {
      await projectsService.delete(project.id);
      showSnackbar('Project deleted successfully', 'success');
      await loadProjects();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to delete project', 'error');
    }
  };

  const columns: Column[] = [
    {
      id: 'name',
      label: 'Project Name',
      minWidth: 200,
      format: (value) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderIcon color="primary" />
          <Typography variant="body2" fontWeight="medium">
            {value as string}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'description',
      label: 'Description',
      minWidth: 250,
      format: (value) => value || '-',
    },
  ];

  if (currentUser?.role === 'super_admin') {
    columns.push({
      id: 'companies',
      label: 'Company',
      minWidth: 150,
      format: (value: any) => value?.name || '-',
    });
  }

  columns.push({
    id: '_count',
    label: 'VMs',
    minWidth: 80,
    format: (value: any) => (
      <Chip
        label={value?.virtual_machines || 0}
        size="small"
        color={value?.virtual_machines > 0 ? 'primary' : 'default'}
      />
    ),
  });

  columns.push({
    id: 'actions',
    label: 'Actions',
    minWidth: 150,
    format: (_value, row: any) => (
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => handleOpenDialog(row)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    ),
  });

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">VM Projects</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Create Project
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Projects help organize VMs by grouping them logically. Found {projects.length} projects.
        </Alert>

        <DataTable
          columns={columns}
          rows={projects}
          emptyMessage="No projects found. Create your first project to get started."
        />

        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editingProject ? 'Edit Project' : 'Create Project'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Project Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                fullWidth
                placeholder="e.g., Production Environment"
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={3}
                placeholder="Brief description of this project..."
              />
              {currentUser?.role === 'super_admin' && !editingProject && (
                <FormControl fullWidth required>
                  <InputLabel>Company</InputLabel>
                  <Select
                    value={formData.company_id || ''}
                    onChange={(e) => setFormData({ ...formData, company_id: Number(e.target.value) })}
                    label="Company"
                  >
                    {companies.map((company) => (
                      <MenuItem key={company.id} value={company.id}>
                        {company.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              {editingProject ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};
