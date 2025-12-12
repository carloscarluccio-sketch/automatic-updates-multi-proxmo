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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CameraAlt as SnapshotIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface SnapshotSchedule {
  id: number;
  vm_id: number;
  schedule_type: 'daily' | 'weekly' | 'monthly';
  schedule_value: string;
  retention_count: number;
  enabled: boolean;
  last_run: string | null;
  created_at: string;
  virtual_machines: {
    id: number;
    name: string;
    vmid: number;
    company_id: number;
    companies: {
      id: number;
      name: string;
    };
  };
}

interface VirtualMachine {
  id: number;
  name: string;
  vmid: number;
  company_id: number;
}

interface FormData {
  vm_id: number | '';
  schedule_type: 'daily' | 'weekly' | 'monthly';
  schedule_value: string;
  retention_count: number;
  enabled: boolean;
}

const SnapshotSchedulesPage: React.FC = () => {
  const [schedules, setSchedules] = useState<SnapshotSchedule[]>([]);
  const [vms, setVms] = useState<VirtualMachine[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SnapshotSchedule | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [formData, setFormData] = useState<FormData>({
    vm_id: '',
    schedule_type: 'daily',
    schedule_value: '02:00',
    retention_count: 7,
    enabled: true,
  });

  useEffect(() => {
    loadSchedules();
    loadVMs();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/snapshot-schedules');
      setSchedules(response.data.data || []);
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to load snapshot schedules');
    } finally {
      setLoading(false);
    }
  };

  const loadVMs = async () => {
    try {
      const response = await api.get('/vms');
      setVms(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to load VMs:', error);
    }
  };

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleOpenDialog = (schedule?: SnapshotSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        vm_id: schedule.vm_id,
        schedule_type: schedule.schedule_type,
        schedule_value: schedule.schedule_value,
        retention_count: schedule.retention_count,
        enabled: schedule.enabled,
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        vm_id: '',
        schedule_type: 'daily',
        schedule_value: '02:00',
        retention_count: 7,
        enabled: true,
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
      if (!formData.vm_id) {
        showAlert('error', 'Please select a virtual machine');
        return;
      }

      if (!formData.schedule_value) {
        showAlert('error', 'Please enter a schedule value');
        return;
      }

      setLoading(true);

      if (editingSchedule) {
        await api.put(`/snapshot-schedules/${editingSchedule.id}`, formData);
        showAlert('success', 'Snapshot schedule updated successfully');
      } else {
        await api.post('/snapshot-schedules', formData);
        showAlert('success', 'Snapshot schedule created successfully');
      }

      handleCloseDialog();
      loadSchedules();
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to save snapshot schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (schedule: SnapshotSchedule) => {
    if (!window.confirm(`Are you sure you want to delete the snapshot schedule for "${schedule.virtual_machines.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/snapshot-schedules/${schedule.id}`);
      showAlert('success', 'Snapshot schedule deleted successfully');
      loadSchedules();
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to delete snapshot schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (schedule: SnapshotSchedule) => {
    try {
      setLoading(true);
      await api.patch(`/api/snapshot-schedules/${schedule.id}/toggle`);
      showAlert('success', `Snapshot schedule ${schedule.enabled ? 'disabled' : 'enabled'} successfully`);
      loadSchedules();
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to toggle snapshot schedule');
    } finally {
      setLoading(false);
    }
  };

  const getScheduleTypeLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      default: return type;
    }
  };

  const getScheduleValueLabel = (type: string, value: string) => {
    switch (type) {
      case 'daily':
        return `at ${value}`;
      case 'weekly':
        return `on ${value}`;
      case 'monthly':
        return `on day ${value}`;
      default:
        return value;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SnapshotIcon /> Snapshot Schedules
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
              <TableCell>VM Name</TableCell>
              <TableCell>VMID</TableCell>
              <TableCell>Company</TableCell>
              <TableCell>Schedule</TableCell>
              <TableCell>Retention</TableCell>
              <TableCell>Last Run</TableCell>
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
                  No snapshot schedules found
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule) => (
                <TableRow key={schedule.id}>
                  <TableCell>{schedule.virtual_machines.name}</TableCell>
                  <TableCell>{schedule.virtual_machines.vmid}</TableCell>
                  <TableCell>{schedule.virtual_machines.companies.name}</TableCell>
                  <TableCell>
                    {getScheduleTypeLabel(schedule.schedule_type)}{' '}
                    {getScheduleValueLabel(schedule.schedule_type, schedule.schedule_value)}
                  </TableCell>
                  <TableCell>{schedule.retention_count} snapshots</TableCell>
                  <TableCell>
                    {schedule.last_run
                      ? new Date(schedule.last_run).toLocaleString()
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={schedule.enabled ? 'Enabled' : 'Disabled'}
                      color={schedule.enabled ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Switch
                      checked={schedule.enabled}
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

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSchedule ? 'Edit Snapshot Schedule' : 'Create Snapshot Schedule'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Virtual Machine</InputLabel>
              <Select
                value={formData.vm_id}
                label="Virtual Machine"
                onChange={(e) => setFormData({ ...formData, vm_id: e.target.value as number })}
                disabled={loading}
              >
                {vms.map((vm) => (
                  <MenuItem key={vm.id} value={vm.id}>
                    {vm.name} (VMID: {vm.vmid})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Schedule Type</InputLabel>
              <Select
                value={formData.schedule_type}
                label="Schedule Type"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    schedule_type: e.target.value as 'daily' | 'weekly' | 'monthly',
                    schedule_value: e.target.value === 'daily' ? '02:00' : '',
                  })
                }
                disabled={loading}
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </FormControl>

            {formData.schedule_type === 'daily' && (
              <TextField
                fullWidth
                label="Time"
                type="time"
                value={formData.schedule_value}
                onChange={(e) => setFormData({ ...formData, schedule_value: e.target.value })}
                disabled={loading}
                helperText="Time when the snapshot will be taken (24-hour format)"
                InputLabelProps={{ shrink: true }}
              />
            )}

            {formData.schedule_type === 'weekly' && (
              <FormControl fullWidth>
                <InputLabel>Day of Week</InputLabel>
                <Select
                  value={formData.schedule_value}
                  label="Day of Week"
                  onChange={(e) => setFormData({ ...formData, schedule_value: e.target.value })}
                  disabled={loading}
                >
                  <MenuItem value="Monday">Monday</MenuItem>
                  <MenuItem value="Tuesday">Tuesday</MenuItem>
                  <MenuItem value="Wednesday">Wednesday</MenuItem>
                  <MenuItem value="Thursday">Thursday</MenuItem>
                  <MenuItem value="Friday">Friday</MenuItem>
                  <MenuItem value="Saturday">Saturday</MenuItem>
                  <MenuItem value="Sunday">Sunday</MenuItem>
                </Select>
              </FormControl>
            )}

            {formData.schedule_type === 'monthly' && (
              <TextField
                fullWidth
                label="Day of Month"
                type="number"
                value={formData.schedule_value}
                onChange={(e) => setFormData({ ...formData, schedule_value: e.target.value })}
                disabled={loading}
                helperText="Day of the month (1-31)"
                inputProps={{ min: 1, max: 31 }}
              />
            )}

            <TextField
              fullWidth
              label="Retention Count"
              type="number"
              value={formData.retention_count}
              onChange={(e) =>
                setFormData({ ...formData, retention_count: parseInt(e.target.value) || 7 })
              }
              disabled={loading}
              helperText="Number of snapshots to keep"
              inputProps={{ min: 1 }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  disabled={loading}
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
          <Button onClick={handleSave} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : editingSchedule ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SnapshotSchedulesPage;
