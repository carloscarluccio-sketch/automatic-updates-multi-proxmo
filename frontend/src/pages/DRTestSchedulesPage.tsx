import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  CircularProgress,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  HealthAndSafety as DRIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface DRTestSchedule {
  id: number;
  cluster_pair_id: number;
  test_name: string;
  description: string | null;
  schedule_enabled: boolean;
  cron_schedule: string;
  test_type: 'boot_test' | 'network_test' | 'full_failover_test' | 'custom';
  test_vms: string | null;
  isolated_network: boolean;
  cleanup_after_test: boolean;
  max_test_duration_minutes: number;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  notification_emails: string | null;
  last_run_at: string | null;
  last_run_status: 'success' | 'failed' | 'in_progress' | 'cancelled' | null;
  next_run_at: string | null;
  created_at: string;
  dr_cluster_pairs: {
    id: number;
    pair_name: string;
    company_id: number;
    proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
      id: number;
      name: string;
    };
    proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
      id: number;
      name: string;
    };
    companies: {
      id: number;
      name: string;
    } | null;
  };
}

interface ClusterPair {
  id: number;
  pair_name: string;
  company_id: number;
  proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
    id: number;
    name: string;
  };
  proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
    id: number;
    name: string;
  };
  companies: {
    id: number;
    name: string;
  } | null;
}

interface FormData {
  cluster_pair_id: number | '';
  test_name: string;
  description: string;
  cron_schedule: string;
  test_type: 'boot_test' | 'network_test' | 'full_failover_test' | 'custom';
  test_vms: string;
  isolated_network: boolean;
  cleanup_after_test: boolean;
  max_test_duration_minutes: number;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  notification_emails: string;
  schedule_enabled: boolean;
}

const DRTestSchedulesPage: React.FC = () => {
  const [schedules, setSchedules] = useState<DRTestSchedule[]>([]);
  const [clusterPairs, setClusterPairs] = useState<ClusterPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DRTestSchedule | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [formData, setFormData] = useState<FormData>({
    cluster_pair_id: '',
    test_name: '',
    description: '',
    cron_schedule: '0 2 1 * *', // Monthly at 2 AM on the 1st
    test_type: 'boot_test',
    test_vms: '',
    isolated_network: true,
    cleanup_after_test: true,
    max_test_duration_minutes: 60,
    notify_on_success: false,
    notify_on_failure: true,
    notification_emails: '',
    schedule_enabled: true,
  });

  useEffect(() => {
    loadSchedules();
    loadClusterPairs();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dr-test-schedules');
      setSchedules(response.data.data || []);
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to load DR test schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadClusterPairs = async () => {
    try {
      const response = await api.get('/dr-test-schedules/cluster-pairs');
      setClusterPairs(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to load cluster pairs:', error);
    }
  };

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleOpenDialog = (schedule?: DRTestSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        cluster_pair_id: schedule.cluster_pair_id,
        test_name: schedule.test_name,
        description: schedule.description || '',
        cron_schedule: schedule.cron_schedule,
        test_type: schedule.test_type,
        test_vms: schedule.test_vms || '',
        isolated_network: schedule.isolated_network,
        cleanup_after_test: schedule.cleanup_after_test,
        max_test_duration_minutes: schedule.max_test_duration_minutes,
        notify_on_success: schedule.notify_on_success,
        notify_on_failure: schedule.notify_on_failure,
        notification_emails: schedule.notification_emails || '',
        schedule_enabled: schedule.schedule_enabled,
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        cluster_pair_id: '',
        test_name: '',
        description: '',
        cron_schedule: '0 2 1 * *',
        test_type: 'boot_test',
        test_vms: '',
        isolated_network: true,
        cleanup_after_test: true,
        max_test_duration_minutes: 60,
        notify_on_success: false,
        notify_on_failure: true,
        notification_emails: '',
        schedule_enabled: true,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSchedule(null);
  };

  const handleSave = async () => {
    try {
      if (!formData.cluster_pair_id) {
        showAlert('error', 'Please select a cluster pair');
        return;
      }

      if (!formData.test_name.trim()) {
        showAlert('error', 'Please enter a test name');
        return;
      }

      setLoading(true);

      if (editingSchedule) {
        await api.put(`/dr-test-schedules/${editingSchedule.id}`, formData);
        showAlert('success', 'DR test schedule updated successfully');
      } else {
        await api.post('/dr-test-schedules', formData);
        showAlert('success', 'DR test schedule created successfully');
      }

      handleCloseDialog();
      loadSchedules();
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to save DR test schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (schedule: DRTestSchedule) => {
    if (!window.confirm(`Are you sure you want to delete the DR test schedule "${schedule.test_name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/dr-test-schedules/${schedule.id}`);
      showAlert('success', 'DR test schedule deleted successfully');
      loadSchedules();
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to delete DR test schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (schedule: DRTestSchedule) => {
    try {
      setLoading(true);
      await api.patch(`/api/dr-test-schedules/${schedule.id}/toggle`);
      showAlert('success', `DR test schedule ${schedule.schedule_enabled ? 'disabled' : 'enabled'} successfully`);
      loadSchedules();
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to toggle DR test schedule');
    } finally {
      setLoading(false);
    }
  };

  const getTestTypeLabel = (type: string) => {
    switch (type) {
      case 'boot_test': return 'Boot Test';
      case 'network_test': return 'Network Test';
      case 'full_failover_test': return 'Full Failover Test';
      case 'custom': return 'Custom Test';
      default: return type;
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'error';
      case 'in_progress': return 'info';
      case 'cancelled': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DRIcon /> DR Test Schedules
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadSchedules}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={loading}
          >
            Create Schedule
          </Button>
        </Box>
      </Box>

      {alert && (
        <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Test Name</TableCell>
              <TableCell>Cluster Pair</TableCell>
              <TableCell>Test Type</TableCell>
              <TableCell>Schedule (Cron)</TableCell>
              <TableCell>Last Run</TableCell>
              <TableCell>Next Run</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No DR test schedules found. Configure cluster pairs first to create test schedules.
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>
                    <strong>{schedule.test_name}</strong>
                    {schedule.description && (
                      <Typography variant="caption" display="block" color="textSecondary">
                        {schedule.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {schedule.dr_cluster_pairs.pair_name}
                    <Typography variant="caption" display="block" color="textSecondary">
                      {schedule.dr_cluster_pairs.proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters.name} → {schedule.dr_cluster_pairs.proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{getTestTypeLabel(schedule.test_type)}</TableCell>
                  <TableCell>
                    <code>{schedule.cron_schedule}</code>
                  </TableCell>
                  <TableCell>
                    {schedule.last_run_at ? (
                      <>
                        {new Date(schedule.last_run_at).toLocaleString()}
                        {schedule.last_run_status && (
                          <Chip
                            label={schedule.last_run_status}
                            color={getStatusColor(schedule.last_run_status)}
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </>
                    ) : 'Never'}
                  </TableCell>
                  <TableCell>
                    {schedule.next_run_at
                      ? new Date(schedule.next_run_at).toLocaleString()
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={schedule.schedule_enabled ? 'Enabled' : 'Disabled'}
                      color={schedule.schedule_enabled ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Switch
                      checked={schedule.schedule_enabled}
                      onChange={() => handleToggle(schedule)}
                      disabled={loading}
                      size="small"
                    />
                    <IconButton
                      onClick={() => handleOpenDialog(schedule)}
                      disabled={loading}
                      size="small"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDelete(schedule)}
                      disabled={loading}
                      color="error"
                      size="small"
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingSchedule ? 'Edit DR Test Schedule' : 'Create DR Test Schedule'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Cluster Pair</InputLabel>
                  <Select
                    value={formData.cluster_pair_id}
                    label="Cluster Pair"
                    onChange={(e) => setFormData({ ...formData, cluster_pair_id: e.target.value as number })}
                    disabled={loading}
                  >
                    {clusterPairs.map((pair) => (
                      <MenuItem key={pair.id} value={pair.id}>
                        {pair.pair_name} ({pair.proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters.name} → {pair.proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters.name})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Test Name"
                  value={formData.test_name}
                  onChange={(e) => setFormData({ ...formData, test_name: e.target.value })}
                  disabled={loading}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Test Type</InputLabel>
                  <Select
                    value={formData.test_type}
                    label="Test Type"
                    onChange={(e) => setFormData({ ...formData, test_type: e.target.value as FormData['test_type'] })}
                    disabled={loading}
                  >
                    <MenuItem value="boot_test">Boot Test</MenuItem>
                    <MenuItem value="network_test">Network Test</MenuItem>
                    <MenuItem value="full_failover_test">Full Failover Test</MenuItem>
                    <MenuItem value="custom">Custom Test</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={loading}
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Cron Schedule"
                  value={formData.cron_schedule}
                  onChange={(e) => setFormData({ ...formData, cron_schedule: e.target.value })}
                  disabled={loading}
                  helperText="Cron expression (e.g., 0 2 1 * * = monthly at 2 AM)"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Max Test Duration (minutes)"
                  type="number"
                  value={formData.max_test_duration_minutes}
                  onChange={(e) => setFormData({ ...formData, max_test_duration_minutes: parseInt(e.target.value) || 60 })}
                  disabled={loading}
                  inputProps={{ min: 1 }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Test VMs (JSON)"
                  value={formData.test_vms}
                  onChange={(e) => setFormData({ ...formData, test_vms: e.target.value })}
                  disabled={loading}
                  multiline
                  rows={3}
                  helperText="JSON array of VM IDs to test (optional, leave empty for all VMs)"
                  placeholder='[101, 102, 103]'
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notification Emails"
                  value={formData.notification_emails}
                  onChange={(e) => setFormData({ ...formData, notification_emails: e.target.value })}
                  disabled={loading}
                  helperText="Comma-separated email addresses"
                  placeholder="admin@example.com, ops@example.com"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isolated_network}
                      onChange={(e) => setFormData({ ...formData, isolated_network: e.target.checked })}
                      disabled={loading}
                    />
                  }
                  label="Use Isolated Network"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.cleanup_after_test}
                      onChange={(e) => setFormData({ ...formData, cleanup_after_test: e.target.checked })}
                      disabled={loading}
                    />
                  }
                  label="Cleanup After Test"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notify_on_success}
                      onChange={(e) => setFormData({ ...formData, notify_on_success: e.target.checked })}
                      disabled={loading}
                    />
                  }
                  label="Notify on Success"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notify_on_failure}
                      onChange={(e) => setFormData({ ...formData, notify_on_failure: e.target.checked })}
                      disabled={loading}
                    />
                  }
                  label="Notify on Failure"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.schedule_enabled}
                      onChange={(e) => setFormData({ ...formData, schedule_enabled: e.target.checked })}
                      disabled={loading}
                    />
                  }
                  label="Schedule Enabled"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : editingSchedule ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DRTestSchedulesPage;
