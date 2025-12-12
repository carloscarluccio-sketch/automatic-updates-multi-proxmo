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
  Switch,
  FormControlLabel,
  Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import { DataTable, Column } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { clustersService } from '../services/clustersService';
import { companiesService } from '../services/companiesService';

interface Template {
  id: number;
  name: string;
  description: string | null;
  vmid: number;
  node_name: string;
  cluster_id: number;
  company_id: number | null;
  os_type: string | null;
  os_version: string | null;
  cpu_cores: number;
  memory_mb: number;
  disk_size_gb: number;
  has_cloud_init: boolean;
  cloud_init_user: string | null;
  cloud_init_packages: string | null;
  cloud_init_script: string | null;
  network_bridge: string;
  network_model: string;
  is_public: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
  proxmox_clusters: {
    id: number;
    name: string;
    host: string;
  };
  companies: {
    id: number;
    name: string;
  } | null;
  users: {
    id: number;
    username: string;
  };
}

interface TemplateFormData {
  name: string;
  description: string;
  vmid: number;
  node_name: string;
  cluster_id: number;
  company_id?: number;
  os_type: string;
  os_version: string;
  cpu_cores: number;
  memory_mb: number;
  disk_size_gb: number;
  has_cloud_init: boolean;
  cloud_init_user: string;
  cloud_init_packages: string;
  cloud_init_script: string;
  network_bridge: string;
  network_model: string;
  is_public: boolean;
}

interface CloneFormData {
  vm_name: string;
  target_vmid: number;
  target_node: string;
  company_id?: number;
}

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDialog, setOpenDialog] = useState(false);
  const [openCloneDialog, setOpenCloneDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [cloneFromTemplate, setCloneFromTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    vmid: 9000,
    node_name: 'pve',
    cluster_id: 0,
    os_type: 'linux',
    os_version: '',
    cpu_cores: 2,
    memory_mb: 2048,
    disk_size_gb: 20,
    has_cloud_init: false,
    cloud_init_user: 'ubuntu',
    cloud_init_packages: '',
    cloud_init_script: '',
    network_bridge: 'vmbr0',
    network_model: 'virtio',
    is_public: false,
  });
  const [cloneData, setCloneData] = useState<CloneFormData>({
    vm_name: '',
    target_vmid: 100,
    target_node: 'pve',
  });
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadTemplates();
    loadClusters();
    if (currentUser?.role === 'super_admin') {
      loadCompanies();
    }
  }, [currentUser]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/templates');
      setTemplates(response.data.data || []);
    } catch (error) {
      showSnackbar('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadClusters = async () => {
    try {
      const data = await clustersService.getAll();
      setClusters(data);
    } catch (error) {
      console.error('Failed to load clusters:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await companiesService.getAll();
      setCompanies(data);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        vmid: template.vmid,
        node_name: template.node_name,
        cluster_id: template.cluster_id,
        company_id: template.company_id || undefined,
        os_type: template.os_type || 'linux',
        os_version: template.os_version || '',
        cpu_cores: template.cpu_cores,
        memory_mb: template.memory_mb,
        disk_size_gb: template.disk_size_gb,
        has_cloud_init: template.has_cloud_init,
        cloud_init_user: template.cloud_init_user || 'ubuntu',
        cloud_init_packages: template.cloud_init_packages || '',
        cloud_init_script: template.cloud_init_script || '',
        network_bridge: template.network_bridge,
        network_model: template.network_model,
        is_public: template.is_public,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        vmid: 9000,
        node_name: 'pve',
        cluster_id: clusters.length > 0 ? clusters[0].id : 0,
        os_type: 'linux',
        os_version: '',
        cpu_cores: 2,
        memory_mb: 2048,
        disk_size_gb: 20,
        has_cloud_init: false,
        cloud_init_user: 'ubuntu',
        cloud_init_packages: '',
        cloud_init_script: '',
        network_bridge: 'vmbr0',
        network_model: 'virtio',
        is_public: false,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTemplate(null);
  };

  const handleOpenCloneDialog = (template: Template) => {
    setCloneFromTemplate(template);
    setCloneData({
      vm_name: `${template.name}-clone`,
      target_vmid: 100,
      target_node: template.node_name,
    });
    setOpenCloneDialog(true);
  };

  const handleCloseCloneDialog = () => {
    setOpenCloneDialog(false);
    setCloneFromTemplate(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      if (editingTemplate) {
        await api.put(`/templates/${editingTemplate.id}`, formData);
        showSnackbar('Template updated successfully', 'success');
      } else {
        await api.post('/templates', formData);
        showSnackbar('Template created successfully', 'success');
      }
      handleCloseDialog();
      await loadTemplates();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async () => {
    if (!cloneFromTemplate) return;

    try {
      setLoading(true);
      await api.post(`/templates/${cloneFromTemplate.id}/clone`, cloneData);
      showSnackbar('VM cloned from template successfully', 'success');
      handleCloseCloneDialog();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Clone operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (template: Template) => {
    if (!window.confirm(`Are you sure you want to delete template "${template.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/templates/${template.id}`);
      showSnackbar('Template deleted successfully', 'success');
      await loadTemplates();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to delete template', 'error');
    } finally {
      setLoading(false);
    }
  };

  const columns: Column[] = [
    { id: 'name', label: 'Name', minWidth: 150 },
    {
      id: 'vmid',
      label: 'VMID',
      minWidth: 80,
      format: (value) => `#${value}`,
    },
    {
      id: 'os_type',
      label: 'OS',
      minWidth: 100,
      format: (value, row: any) => (
        <Box>
          <Typography variant="body2">{value || 'Unknown'}</Typography>
          {row.os_version && (
            <Typography variant="caption" color="textSecondary">
              {row.os_version}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: 'cpu_cores',
      label: 'CPU',
      minWidth: 80,
      format: (value) => `${value} cores`,
    },
    {
      id: 'memory_mb',
      label: 'Memory',
      minWidth: 100,
      format: (value) => `${Math.round((value || 0) / 1024)} GB`,
    },
    {
      id: 'disk_size_gb',
      label: 'Storage',
      minWidth: 100,
      format: (value) => `${value || 0} GB`,
    },
    {
      id: 'is_public',
      label: 'Visibility',
      minWidth: 100,
      format: (value) => (
        <Chip
          icon={value ? <PublicIcon /> : <LockIcon />}
          label={value ? 'Public' : 'Private'}
          color={value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
  ];

  if (currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin') {
    columns.push({
      id: 'actions',
      label: 'Actions',
      minWidth: 200,
      format: (_value, row: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Clone to VM">
            <IconButton size="small" color="primary" onClick={() => handleOpenCloneDialog(row)}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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
  }

  if (loading && templates.length === 0) {
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
          <Typography variant="h4">VM Templates</Typography>
          {(currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin') && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              disabled={loading}
            >
              Create Template
            </Button>
          )}
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Found {templates.length} templates. Templates allow you to quickly deploy pre-configured VMs.
        </Alert>

        <DataTable columns={columns} rows={templates} emptyMessage="No templates found" />

        {/* Create/Edit Template Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Template Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
                fullWidth
              />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="VMID"
                    type="number"
                    value={formData.vmid}
                    onChange={(e) => setFormData({ ...formData, vmid: Number(e.target.value) })}
                    required
                    fullWidth
                    disabled={!!editingTemplate}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Node"
                    value={formData.node_name}
                    onChange={(e) => setFormData({ ...formData, node_name: e.target.value })}
                    required
                    fullWidth
                  />
                </Grid>
              </Grid>

              <FormControl fullWidth>
                <InputLabel>Cluster</InputLabel>
                <Select
                  value={formData.cluster_id}
                  label="Cluster"
                  onChange={(e) => setFormData({ ...formData, cluster_id: Number(e.target.value) })}
                  required
                >
                  {clusters.map((cluster) => (
                    <MenuItem key={cluster.id} value={cluster.id}>
                      {cluster.name} ({cluster.host})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {currentUser?.role === 'super_admin' && (
                <FormControl fullWidth>
                  <InputLabel>Company</InputLabel>
                  <Select
                    value={formData.company_id || ''}
                    label="Company"
                    onChange={(e) =>
                      setFormData({ ...formData, company_id: (e.target.value as number) || undefined })
                    }
                  >
                    <MenuItem value="">None (Global)</MenuItem>
                    {companies.map((company) => (
                      <MenuItem key={company.id} value={company.id}>
                        {company.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>OS Type</InputLabel>
                    <Select
                      value={formData.os_type}
                      label="OS Type"
                      onChange={(e) => setFormData({ ...formData, os_type: e.target.value })}
                    >
                      <MenuItem value="linux">Linux</MenuItem>
                      <MenuItem value="windows">Windows</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="OS Version"
                    value={formData.os_version}
                    onChange={(e) => setFormData({ ...formData, os_version: e.target.value })}
                    fullWidth
                    placeholder="e.g., Ubuntu 22.04"
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <TextField
                    label="CPU Cores"
                    type="number"
                    value={formData.cpu_cores}
                    onChange={(e) => setFormData({ ...formData, cpu_cores: Number(e.target.value) })}
                    required
                    fullWidth
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    label="Memory (MB)"
                    type="number"
                    value={formData.memory_mb}
                    onChange={(e) => setFormData({ ...formData, memory_mb: Number(e.target.value) })}
                    required
                    fullWidth
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    label="Storage (GB)"
                    type="number"
                    value={formData.disk_size_gb}
                    onChange={(e) => setFormData({ ...formData, disk_size_gb: Number(e.target.value) })}
                    required
                    fullWidth
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.has_cloud_init}
                    onChange={(e) => setFormData({ ...formData, has_cloud_init: e.target.checked })}
                  />
                }
                label="Has Cloud-Init"
              />

              {formData.has_cloud_init && (
                <>
                  <TextField
                    label="Cloud-Init User"
                    value={formData.cloud_init_user}
                    onChange={(e) => setFormData({ ...formData, cloud_init_user: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    label="Cloud-Init Packages (comma-separated)"
                    value={formData.cloud_init_packages}
                    onChange={(e) => setFormData({ ...formData, cloud_init_packages: e.target.value })}
                    fullWidth
                    placeholder="e.g., qemu-guest-agent, curl, git"
                  />
                  <TextField
                    label="Cloud-Init Script"
                    value={formData.cloud_init_script}
                    onChange={(e) => setFormData({ ...formData, cloud_init_script: e.target.value })}
                    multiline
                    rows={4}
                    fullWidth
                    placeholder="#!/bin/bash..."
                  />
                </>
              )}

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label="Network Bridge"
                    value={formData.network_bridge}
                    onChange={(e) => setFormData({ ...formData, network_bridge: e.target.value })}
                    required
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Network Model"
                    value={formData.network_model}
                    onChange={(e) => setFormData({ ...formData, network_model: e.target.value })}
                    required
                    fullWidth
                  />
                </Grid>
              </Grid>

              {currentUser?.role === 'super_admin' && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_public}
                      onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    />
                  }
                  label="Public (visible to all companies)"
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={loading || !formData.name || !formData.vmid || !formData.cluster_id}
            >
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Clone from Template Dialog */}
        <Dialog open={openCloneDialog} onClose={handleCloseCloneDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Clone VM from Template</DialogTitle>
          <DialogContent>
            {cloneFromTemplate && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <Alert severity="info">
                  Cloning from template: <strong>{cloneFromTemplate.name}</strong>
                </Alert>
                <TextField
                  label="New VM Name"
                  value={cloneData.vm_name}
                  onChange={(e) => setCloneData({ ...cloneData, vm_name: e.target.value })}
                  required
                  fullWidth
                />
                <TextField
                  label="Target VMID"
                  type="number"
                  value={cloneData.target_vmid}
                  onChange={(e) => setCloneData({ ...cloneData, target_vmid: Number(e.target.value) })}
                  required
                  fullWidth
                />
                <TextField
                  label="Target Node"
                  value={cloneData.target_node}
                  onChange={(e) => setCloneData({ ...cloneData, target_node: e.target.value })}
                  required
                  fullWidth
                />
                {currentUser?.role === 'super_admin' && (
                  <FormControl fullWidth>
                    <InputLabel>Assign to Company</InputLabel>
                    <Select
                      value={cloneData.company_id || ''}
                      label="Assign to Company"
                      onChange={(e) =>
                        setCloneData({ ...cloneData, company_id: (e.target.value as number) || undefined })
                      }
                    >
                      <MenuItem value="">None</MenuItem>
                      {companies.map((company) => (
                        <MenuItem key={company.id} value={company.id}>
                          {company.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCloneDialog} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleClone}
              variant="contained"
              disabled={loading || !cloneData.vm_name || !cloneData.target_vmid}
            >
              Clone VM
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
