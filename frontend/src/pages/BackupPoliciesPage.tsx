import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Backup as BackupIcon,
  ToggleOff as DisableIcon,
  ToggleOn as EnableIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface BackupPolicy {
  id: number;
  company_id: number;
  cluster_id: number;
  name: string;
  schedule_cron: string | null;
  retention_days: number | null;
  compression: 'none' | 'lzo' | 'gzip' | 'zstd';
  mode: 'snapshot' | 'suspend' | 'stop';
  storage_location: string | null;
  enabled: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  companies?: {
    id: number;
    name: string;
  };
  proxmox_clusters?: {
    id: number;
    name: string;
    host: string;
  };
  vm_backup_assignments?: Array<{
    id: number;
    vm_id: number;
  }>;
}

interface Cluster {
  id: number;
  name: string;
  host: string;
  location?: string;
}

interface Company {
  id: number;
  name: string;
}

interface FormData {
  target_company_id: number | '';
  cluster_id: number | '';
  name: string;
  schedule_cron: string;
  retention_days: number;
  compression: 'none' | 'lzo' | 'gzip' | 'zstd';
  mode: 'snapshot' | 'suspend' | 'stop';
  storage_location: string;
  enabled: boolean;
}

const BackupPoliciesPage: React.FC = () => {
  const [policies, setPolicies] = useState<BackupPolicy[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<BackupPolicy | null>(null);
  const [deletingPolicy, setDeletingPolicy] = useState<BackupPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');

  const [formData, setFormData] = useState<FormData>({
    target_company_id: '',
    cluster_id: '',
    name: '',
    schedule_cron: '0 2 * * *',
    retention_days: 7,
    compression: 'zstd',
    mode: 'snapshot',
    storage_location: '',
    enabled: true,
  });

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserRole(user.role);
    }
    loadPolicies();
    loadClusters();
    if (userRole === 'super_admin') {
      loadCompanies();
    }
  }, [userRole]);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/backup-policies');
      setPolicies(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load backup policies');
    } finally {
      setLoading(false);
    }
  };

  const loadClusters = async () => {
    try {
      const response = await api.get('/backup-policies/available-clusters');
      setClusters(response.data.data || []);
    } catch (err) {
      console.error('Failed to load clusters', err);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data.data || []);
    } catch (err) {
      console.error('Failed to load companies', err);
    }
  };

  const handleOpenDialog = (policy?: BackupPolicy) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        target_company_id: policy.company_id,
        cluster_id: policy.cluster_id,
        name: policy.name,
        schedule_cron: policy.schedule_cron || '0 2 * * *',
        retention_days: policy.retention_days || 7,
        compression: policy.compression,
        mode: policy.mode,
        storage_location: policy.storage_location || '',
        enabled: policy.enabled !== false,
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        target_company_id: '',
        cluster_id: '',
        name: '',
        schedule_cron: '0 2 * * *',
        retention_days: 7,
        compression: 'zstd',
        mode: 'snapshot',
        storage_location: '',
        enabled: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPolicy(null);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!formData.cluster_id || !formData.name) {
        setError('Please fill in all required fields');
        return;
      }

      if (editingPolicy) {
        await api.put(`/backup-policies/${editingPolicy.id}`, formData);
        setSuccess('Backup policy updated successfully');
      } else {
        await api.post('/backup-policies', formData);
        setSuccess('Backup policy created successfully');
      }

      handleCloseDialog();
      loadPolicies();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save backup policy');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDeleteDialog = (policy: BackupPolicy) => {
    setDeletingPolicy(policy);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeletingPolicy(null);
  };

  const handleDelete = async () => {
    if (!deletingPolicy) return;

    try {
      setLoading(true);
      setError(null);
      await api.delete(`/backup-policies/${deletingPolicy.id}`);
      setSuccess('Backup policy deleted successfully');
      handleCloseDeleteDialog();
      loadPolicies();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete backup policy');
      handleCloseDeleteDialog();
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (policy: BackupPolicy) => {
    try {
      setError(null);
      await api.patch(`/backup-policies/${policy.id}/toggle-enabled`);
      setSuccess(`Backup policy ${policy.enabled ? 'disabled' : 'enabled'} successfully`);
      loadPolicies();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle backup policy');
    }
  };

  const getCompressionLabel = (compression: string) => {
    switch (compression) {
      case 'none': return 'None';
      case 'lzo': return 'LZO';
      case 'gzip': return 'GZIP';
      case 'zstd': return 'ZSTD';
      default: return compression;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'snapshot': return 'Snapshot';
      case 'suspend': return 'Suspend';
      case 'stop': return 'Stop';
      default: return mode;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BackupIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4">Backup Policies</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadPolicies}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Create Policy
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {loading && !dialogOpen ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                {userRole === 'super_admin' && <TableCell>Company</TableCell>}
                <TableCell>Cluster</TableCell>
                <TableCell>Schedule</TableCell>
                <TableCell>Retention</TableCell>
                <TableCell>Compression</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell>VMs Assigned</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {policies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={userRole === 'super_admin' ? 10 : 9} align="center">
                    No backup policies found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell>{policy.name}</TableCell>
                    {userRole === 'super_admin' && (
                      <TableCell>{policy.companies?.name || 'N/A'}</TableCell>
                    )}
                    <TableCell>{policy.proxmox_clusters?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {policy.schedule_cron || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>{policy.retention_days || 0} days</TableCell>
                    <TableCell>
                      <Chip label={getCompressionLabel(policy.compression)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={getModeLabel(policy.mode)} size="small" color="info" />
                    </TableCell>
                    <TableCell align="center">
                      {policy.vm_backup_assignments?.length || 0}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={policy.enabled ? 'Enabled' : 'Disabled'}
                        color={policy.enabled ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleToggleEnabled(policy)}
                        color={policy.enabled ? 'success' : 'default'}
                        title={policy.enabled ? 'Disable' : 'Enable'}
                      >
                        {policy.enabled ? <EnableIcon /> : <DisableIcon />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(policy)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDeleteDialog(policy)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPolicy ? 'Edit Backup Policy' : 'Create Backup Policy'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Policy Name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>

            {userRole === 'super_admin' && !editingPolicy && (
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Company</InputLabel>
                  <Select
                    value={formData.target_company_id}
                    onChange={(e) => setFormData({ ...formData, target_company_id: e.target.value as number })}
                    label="Company"
                  >
                    <MenuItem value="">Select Company</MenuItem>
                    {companies.map((company) => (
                      <MenuItem key={company.id} value={company.id}>
                        {company.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12}>
              <FormControl fullWidth required disabled={!!editingPolicy}>
                <InputLabel>Cluster</InputLabel>
                <Select
                  value={formData.cluster_id}
                  onChange={(e) => setFormData({ ...formData, cluster_id: e.target.value as number })}
                  label="Cluster"
                >
                  <MenuItem value="">Select Cluster</MenuItem>
                  {clusters.map((cluster) => (
                    <MenuItem key={cluster.id} value={cluster.id}>
                      {cluster.name} ({cluster.location || cluster.host})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Schedule (Cron)"
                fullWidth
                value={formData.schedule_cron}
                onChange={(e) => setFormData({ ...formData, schedule_cron: e.target.value })}
                helperText="e.g., 0 2 * * * (Daily at 2 AM)"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Retention Days"
                type="number"
                fullWidth
                value={formData.retention_days}
                onChange={(e) => setFormData({ ...formData, retention_days: parseInt(e.target.value) })}
                inputProps={{ min: 1, max: 365 }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Compression</InputLabel>
                <Select
                  value={formData.compression}
                  onChange={(e) => setFormData({ ...formData, compression: e.target.value as any })}
                  label="Compression"
                >
                  <MenuItem value="none">None</MenuItem>
                  <MenuItem value="lzo">LZO (Fast)</MenuItem>
                  <MenuItem value="gzip">GZIP (Balanced)</MenuItem>
                  <MenuItem value="zstd">ZSTD (Best Compression)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Backup Mode</InputLabel>
                <Select
                  value={formData.mode}
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value as any })}
                  label="Backup Mode"
                >
                  <MenuItem value="snapshot">Snapshot (No Downtime)</MenuItem>
                  <MenuItem value="suspend">Suspend (Pause VM)</MenuItem>
                  <MenuItem value="stop">Stop (Shutdown VM)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Storage Location"
                fullWidth
                value={formData.storage_location}
                onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                helperText="Optional: Specify Proxmox storage location"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                }
                label="Enabled"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {editingPolicy ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the backup policy "{deletingPolicy?.name}"?
          </Typography>
          {deletingPolicy && deletingPolicy.vm_backup_assignments && deletingPolicy.vm_backup_assignments.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This policy is assigned to {deletingPolicy.vm_backup_assignments.length} VM(s).
              You cannot delete it until all VM assignments are removed.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={loading || (deletingPolicy?.vm_backup_assignments?.length || 0) > 0}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BackupPoliciesPage;
