import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Chip,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Switch,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  PendingActions as PendingIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface BackupSchedule {
  id: number;
  name: string;
  description: string | null;
  company_id: number;
  vm_id: number | null;
  cluster_id: number | null;
  schedule_type: 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  schedule_time: string | null;
  schedule_cron: string | null;
  enabled: boolean;
  retention_days: number;
  retention_count: number | null;
  compression: 'none' | 'lzo' | 'gzip' | 'zstd';
  mode: 'snapshot' | 'suspend' | 'stop';
  storage_location: string | null;
  include_ram: boolean;
  notification_email: string | null;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  next_run: string | null;
  last_run: string | null;
  last_status: 'success' | 'failed' | 'running' | 'pending';
  last_error: string | null;
  created_at: string;
  updated_at: string;
  companies?: { id: number; name: string };
  virtual_machines?: { id: number; name: string; vmid: number };
  proxmox_clusters?: { id: number; name: string };
}

interface VM {
  id: number;
  name: string;
  vmid: number;
}

interface Cluster {
  id: number;
  name: string;
}

interface Company {
  id: number;
  name: string;
}

const BackupSchedulesPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [vms, setVms] = useState<VM[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<BackupSchedule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    company_id: null as number | null,
    vm_id: null as number | null,
    cluster_id: null as number | null,
    schedule_type: 'daily' as 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly',
    schedule_time: '02:00',
    enabled: true,
    retention_days: 7,
    retention_count: null as number | null,
    compression: 'zstd' as 'none' | 'lzo' | 'gzip' | 'zstd',
    mode: 'snapshot' as 'snapshot' | 'suspend' | 'stop',
    storage_location: '',
    include_ram: false,
    notification_email: '',
    notify_on_success: false,
    notify_on_failure: true,
  });

  useEffect(() => {
    loadSchedules();
    loadVMs();
    loadClusters();
    if (currentUser?.role === 'super_admin') {
      loadCompanies();
    }
  }, [currentUser]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/backup-schedules');
      setSchedules(response.data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load backup schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadVMs = async () => {
    try {
      const response = await api.get('/vms');
      setVms(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to load VMs:', err);
    }
  };

  const loadClusters = async () => {
    try {
      const response = await api.get('/clusters');
      setClusters(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to load clusters:', err);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to load companies:', err);
    }
  };

  const handleOpenDialog = (schedule?: BackupSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        name: schedule.name,
        description: schedule.description || '',
        company_id: schedule.company_id,
        vm_id: schedule.vm_id,
        cluster_id: schedule.cluster_id,
        schedule_type: schedule.schedule_type,
        schedule_time: schedule.schedule_time || '02:00',
        enabled: schedule.enabled,
        retention_days: schedule.retention_days,
        retention_count: schedule.retention_count,
        compression: schedule.compression,
        mode: schedule.mode,
        storage_location: schedule.storage_location || '',
        include_ram: schedule.include_ram,
        notification_email: schedule.notification_email || '',
        notify_on_success: schedule.notify_on_success,
        notify_on_failure: schedule.notify_on_failure,
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        name: '',
        description: '',
        company_id: currentUser?.role === 'super_admin' ? null : currentUser?.company_id || null,
        vm_id: null,
        cluster_id: null,
        schedule_type: 'daily',
        schedule_time: '02:00',
        enabled: true,
        retention_days: 7,
        retention_count: null,
        compression: 'zstd',
        mode: 'snapshot',
        storage_location: '',
        include_ram: false,
        notification_email: '',
        notify_on_success: false,
        notify_on_failure: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingSchedule(null);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      if (editingSchedule) {
        await api.put(`/backup-schedules/${editingSchedule.id}`, formData);
        setSuccess('Backup schedule updated successfully');
      } else {
        await api.post('/backup-schedules', formData);
        setSuccess('Backup schedule created successfully');
      }

      handleCloseDialog();
      await loadSchedules();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (schedule: BackupSchedule) => {
    if (!window.confirm(`Are you sure you want to delete schedule "${schedule.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.delete(`/backup-schedules/${schedule.id}`);
      setSuccess('Backup schedule deleted successfully');
      await loadSchedules();
    } catch (err: any) {
      setError(err.message || 'Failed to delete backup schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (schedule: BackupSchedule) => {
    try {
      setLoading(true);
      setError(null);
      await api.patch(`/backup-schedules/${schedule.id}/toggle`);
      setSuccess(`Backup schedule ${schedule.enabled ? 'disabled' : 'enabled'} successfully`);
      await loadSchedules();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle backup schedule');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon fontSize="small" />;
      case 'failed':
        return <ErrorIcon fontSize="small" />;
      case 'running':
        return <PlayIcon fontSize="small" />;
      default:
        return <PendingIcon fontSize="small" />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ScheduleIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4">Backup Schedules</Typography>
        </Box>
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
            Add Schedule
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              {currentUser?.role === 'super_admin' && <TableCell>Company</TableCell>}
              <TableCell>VM / Cluster</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell>Retention</TableCell>
              <TableCell>Next Run</TableCell>
              <TableCell>Last Status</TableCell>
              <TableCell>Enabled</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schedules.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={currentUser?.role === 'super_admin' ? 11 : 10} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No backup schedules found. Click "Add Schedule" to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>{schedule.id}</TableCell>
                  <TableCell>
                    <Typography variant="body1" fontWeight={500}>
                      {schedule.name}
                    </Typography>
                    {schedule.description && (
                      <Typography variant="caption" color="text.secondary">
                        {schedule.description}
                      </Typography>
                    )}
                  </TableCell>
                  {currentUser?.role === 'super_admin' && (
                    <TableCell>{schedule.companies?.name || '-'}</TableCell>
                  )}
                  <TableCell>
                    {schedule.virtual_machines ? (
                      <Tooltip title={`VMID: ${schedule.virtual_machines.vmid}`}>
                        <Chip label={schedule.virtual_machines.name} size="small" />
                      </Tooltip>
                    ) : schedule.proxmox_clusters ? (
                      <Chip label={schedule.proxmox_clusters.name} size="small" color="primary" />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{schedule.schedule_type}</Typography>
                    {schedule.schedule_time && (
                      <Typography variant="caption" color="text.secondary">
                        {schedule.schedule_time}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={schedule.mode} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {schedule.retention_days} days
                    {schedule.retention_count && ` / ${schedule.retention_count} backups`}
                  </TableCell>
                  <TableCell>
                    {schedule.next_run ? new Date(schedule.next_run).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(schedule.last_status)}
                      label={schedule.last_status}
                      color={getStatusColor(schedule.last_status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={schedule.enabled}
                      onChange={() => handleToggle(schedule)}
                      disabled={loading}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(schedule)}
                      disabled={loading}
                      title="Edit Schedule"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(schedule)}
                      disabled={loading}
                      color="error"
                      title="Delete Schedule"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingSchedule ? 'Edit Backup Schedule' : 'Add Backup Schedule'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Schedule Name"
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

            {currentUser?.role === 'super_admin' && (
              <FormControl fullWidth>
                <InputLabel>Company</InputLabel>
                <Select
                  value={formData.company_id || ''}
                  label="Company"
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value as number || null })}
                >
                  <MenuItem value="">Select Company</MenuItem>
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl fullWidth>
              <InputLabel>VM (Optional)</InputLabel>
              <Select
                value={formData.vm_id || ''}
                label="VM (Optional)"
                onChange={(e) => setFormData({ ...formData, vm_id: e.target.value as number || null })}
              >
                <MenuItem value="">All VMs</MenuItem>
                {vms.map((vm) => (
                  <MenuItem key={vm.id} value={vm.id}>
                    {vm.name} (VMID: {vm.vmid})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Cluster (Optional)</InputLabel>
              <Select
                value={formData.cluster_id || ''}
                label="Cluster (Optional)"
                onChange={(e) => setFormData({ ...formData, cluster_id: e.target.value as number || null })}
              >
                <MenuItem value="">All Clusters</MenuItem>
                {clusters.map((cluster) => (
                  <MenuItem key={cluster.id} value={cluster.id}>
                    {cluster.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Schedule Type</InputLabel>
              <Select
                value={formData.schedule_type}
                label="Schedule Type"
                onChange={(e) => setFormData({ ...formData, schedule_type: e.target.value as any })}
              >
                <MenuItem value="once">Once</MenuItem>
                <MenuItem value="hourly">Hourly</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </FormControl>

            {formData.schedule_type !== 'hourly' && (
              <TextField
                label="Schedule Time"
                type="time"
                value={formData.schedule_time}
                onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            )}

            <FormControl fullWidth>
              <InputLabel>Backup Mode</InputLabel>
              <Select
                value={formData.mode}
                label="Backup Mode"
                onChange={(e) => setFormData({ ...formData, mode: e.target.value as any })}
              >
                <MenuItem value="snapshot">Snapshot (No Downtime)</MenuItem>
                <MenuItem value="suspend">Suspend VM</MenuItem>
                <MenuItem value="stop">Stop VM</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Compression</InputLabel>
              <Select
                value={formData.compression}
                label="Compression"
                onChange={(e) => setFormData({ ...formData, compression: e.target.value as any })}
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="lzo">LZO (Fast)</MenuItem>
                <MenuItem value="gzip">GZIP (Balanced)</MenuItem>
                <MenuItem value="zstd">ZSTD (Best)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Retention Days"
              type="number"
              value={formData.retention_days}
              onChange={(e) => setFormData({ ...formData, retention_days: Number(e.target.value) })}
              fullWidth
              inputProps={{ min: 1 }}
            />

            <TextField
              label="Retention Count (Optional)"
              type="number"
              value={formData.retention_count || ''}
              onChange={(e) => setFormData({ ...formData, retention_count: e.target.value ? Number(e.target.value) : null })}
              fullWidth
              inputProps={{ min: 1 }}
              helperText="Maximum number of backups to keep"
            />

            <TextField
              label="Storage Location (Optional)"
              value={formData.storage_location}
              onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
              fullWidth
              helperText="e.g., local-lvm, nfs-storage"
            />

            <TextField
              label="Notification Email (Optional)"
              type="email"
              value={formData.notification_email}
              onChange={(e) => setFormData({ ...formData, notification_email: e.target.value })}
              fullWidth
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.include_ram}
                  onChange={(e) => setFormData({ ...formData, include_ram: e.target.checked })}
                />
              }
              label="Include RAM State"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.notify_on_success}
                  onChange={(e) => setFormData({ ...formData, notify_on_success: e.target.checked })}
                />
              }
              label="Notify on Success"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.notify_on_failure}
                  onChange={(e) => setFormData({ ...formData, notify_on_failure: e.target.checked })}
                />
              }
              label="Notify on Failure"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
              }
              label="Enabled"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !formData.name || !formData.schedule_type}
          >
            {editingSchedule ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BackupSchedulesPage;
