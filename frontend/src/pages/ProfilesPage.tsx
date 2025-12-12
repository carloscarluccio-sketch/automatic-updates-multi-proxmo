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
  IconButton,
  Tooltip,
  Chip,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SecurityIcon from '@mui/icons-material/Security';
import { DataTable, Column } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface Profile {
  id: number;
  name: string;
  description: string | null;
  company_id: number | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  companies: {
    id: number;
    name: string;
  } | null;
  profile_permissions: ProfilePermission[];
  _count: {
    users_users_profile_idTouser_profiles: number;
  };
}

interface ProfilePermission {
  id: number;
  profile_id: number;
  permission_id: number;
  permissions: Permission;
}

interface Permission {
  id: number;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
}

export const ProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    company_id: '',
    is_system: false,
    permission_ids: [] as number[],
  });
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadProfiles(), loadPermissions(), loadCompanies()]);
    } catch (error) {
      showSnackbar('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    try {
      const response = await api.get('/profiles');
      setProfiles(response.data.data || []);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const loadPermissions = async () => {
    try {
      const response = await api.get('/profiles/permissions/list');
      setPermissions(response.data.data || []);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      if (currentUser?.role === 'super_admin') {
        const response = await api.get('/companies');
        setCompanies(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (profile?: Profile) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        name: profile.name,
        description: profile.description || '',
        company_id: profile.company_id ? profile.company_id.toString() : '',
        is_system: profile.is_system,
        permission_ids: profile.profile_permissions.map((pp) => pp.permission_id),
      });
    } else {
      setEditingProfile(null);
      setFormData({
        name: '',
        description: '',
        company_id: '',
        is_system: false,
        permission_ids: [],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProfile(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const submitData: any = {
        name: formData.name,
        description: formData.description || null,
        permission_ids: formData.permission_ids,
      };

      if (currentUser?.role === 'super_admin') {
        if (formData.company_id) {
          submitData.company_id = parseInt(formData.company_id);
        }
        submitData.is_system = formData.is_system;
      }

      if (editingProfile) {
        await api.put(`/profiles/${editingProfile.id}`, submitData);
        showSnackbar('Profile updated successfully', 'success');
      } else {
        await api.post('/profiles', submitData);
        showSnackbar('Profile created successfully', 'success');
      }
      handleCloseDialog();
      await loadProfiles();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (profile: Profile) => {
    if (!window.confirm(`Are you sure you want to delete profile "${profile.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/profiles/${profile.id}`);
      showSnackbar('Profile deleted successfully', 'success');
      await loadProfiles();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to delete profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = (permissionId: number) => {
    setFormData((prev) => ({
      ...prev,
      permission_ids: prev.permission_ids.includes(permissionId)
        ? prev.permission_ids.filter((id) => id !== permissionId)
        : [...prev.permission_ids, permissionId],
    }));
  };

  const handleSelectAllCategory = (category: string | null) => {
    const categoryPermissions = permissions.filter((p) => p.category === category).map((p) => p.id);
    const allSelected = categoryPermissions.every((id) => formData.permission_ids.includes(id));

    setFormData((prev) => ({
      ...prev,
      permission_ids: allSelected
        ? prev.permission_ids.filter((id) => !categoryPermissions.includes(id))
        : [...new Set([...prev.permission_ids, ...categoryPermissions])],
    }));
  };

  const groupPermissionsByCategory = () => {
    const grouped: { [key: string]: Permission[] } = {};
    permissions.forEach((perm) => {
      const category = perm.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(perm);
    });
    return grouped;
  };

  const columns: Column[] = [
    { id: 'name', label: 'Profile Name', minWidth: 200 },
    { id: 'description', label: 'Description', minWidth: 250 },
    {
      id: 'is_system',
      label: 'Type',
      minWidth: 100,
      format: (value) => (
        <Chip label={value ? 'System' : 'Custom'} color={value ? 'primary' : 'default'} size="small" />
      ),
    },
    {
      id: 'profile_permissions',
      label: 'Permissions',
      minWidth: 150,
      format: (value: any) => (
        <Chip label={`${value?.length || 0} permissions`} size="small" variant="outlined" />
      ),
    },
    {
      id: '_count',
      label: 'Users',
      minWidth: 100,
      format: (value: any) => `${value?.users_users_profile_idTouser_profiles || 0} users`,
    },
  ];

  if (currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin') {
    columns.push({
      id: 'actions',
      label: 'Actions',
      minWidth: 150,
      format: (_value, row: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenDialog(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDelete(row)}
              disabled={row.is_system || row._count.users_users_profile_idTouser_profiles > 0}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    });
  }

  if (loading && profiles.length === 0) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  const permissionsByCategory = groupPermissionsByCategory();

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Permission Profiles
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Manage role-based permission profiles for users
            </Typography>
          </Box>
          {(currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin') && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} disabled={loading}>
              Create Profile
            </Button>
          )}
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Found {profiles.length} permission profiles. Assign profiles to users for granular access control.
        </Alert>

        <DataTable columns={columns} rows={profiles} emptyMessage="No profiles found" />

        {/* Profile Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon />
              {editingProfile ? 'Edit Profile' : 'Create Profile'}
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Profile Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                fullWidth
                helperText="Unique name for this permission profile"
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
                fullWidth
                helperText="Description of what this profile allows"
              />
              {currentUser?.role === 'super_admin' && (
                <>
                  <TextField
                    select
                    label="Company"
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    fullWidth
                    helperText="Leave empty for system-wide profile"
                  >
                    <MenuItem value="">
                      <em>None (System Profile)</em>
                    </MenuItem>
                    {companies.map((company) => (
                      <MenuItem key={company.id} value={company.id.toString()}>
                        {company.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.is_system}
                        onChange={(e) => setFormData({ ...formData, is_system: e.target.checked })}
                      />
                    }
                    label="System Profile (available to all companies)"
                  />
                </>
              )}

              <Typography variant="h6" sx={{ mt: 2 }}>
                Permissions ({formData.permission_ids.length} selected)
              </Typography>

              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <Accordion key={category} defaultExpanded={category === 'VM Management'}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                        <Typography>{category}</Typography>
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAllCategory(category === 'Other' ? null : category);
                          }}
                        >
                          {perms.every((p) => formData.permission_ids.includes(p.id)) ? 'Deselect All' : 'Select All'}
                        </Button>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {perms.map((perm) => (
                          <ListItem key={perm.id} disablePadding>
                            <ListItemIcon>
                              <Checkbox
                                checked={formData.permission_ids.includes(perm.id)}
                                onChange={() => handleTogglePermission(perm.id)}
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={perm.name}
                              secondary={perm.description}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} variant="contained" disabled={loading || !formData.name}>
              {editingProfile ? 'Update' : 'Create'}
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
