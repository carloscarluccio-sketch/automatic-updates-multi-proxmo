/**
 * IP Reservations Management Page
 * Phase 2.1: Reserve IPs before VM creation with expiration tracking
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TimerIcon from '@mui/icons-material/Timer';
import WarningIcon from '@mui/icons-material/Warning';
import api from '../services/api';

interface Reservation {
  id: number;
  ip_address: string;
  reserved_for: string;
  reservation_type: string;
  notes: string | null;
  reserved_at: string;
  expires_at: string | null;
  status: string;
  is_expired: boolean;
  expires_in_hours: number | null;
  ip_ranges: {
    id: number;
    subnet: string;
    description: string | null;
    vlan_id: number | null;
  };
  users_ip_reservations_reserved_byTousers: {
    email: string;
    full_name: string | null;
  };
  companies: {
    name: string;
  };
  virtual_machines: {
    name: string;
    vmid: number;
  } | null;
}

interface IPRange {
  id: number;
  subnet: string;
  description: string | null;
  gateway: string | null;
  vlan_id: number | null;
}

export const IPReservationsPage: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [ipRanges, setIPRanges] = useState<IPRange[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    ip_range_id: '',
    ip_address: '',
    reserved_for: '',
    reservation_type: 'vm',
    notes: '',
    expires_at: '',
  });

  useEffect(() => {
    loadData();
    loadIPRanges();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/ip-reservations?status=${filterStatus}&include_expired=true`);
      if (response.data.success) {
        setReservations(response.data.data);
        setSummary(response.data.summary);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  const loadIPRanges = async () => {
    try {
      const response = await api.get('/ip-ranges');
      if (response.data.success) {
        setIPRanges(response.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load IP ranges:', err);
    }
  };

  const handleOpenDialog = (reservation?: Reservation) => {
    if (reservation) {
      setEditingReservation(reservation);
      setFormData({
        ip_range_id: reservation.ip_ranges.id?.toString() || '',
        ip_address: reservation.ip_address,
        reserved_for: reservation.reserved_for,
        reservation_type: reservation.reservation_type,
        notes: reservation.notes || '',
        expires_at: reservation.expires_at ? new Date(reservation.expires_at).toISOString().slice(0, 16) : '',
      });
    } else {
      setEditingReservation(null);
      setFormData({
        ip_range_id: '',
        ip_address: '',
        reserved_for: '',
        reservation_type: 'vm',
        notes: '',
        expires_at: '',
      });
    }
    setOpenDialog(true);
    setError('');
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingReservation(null);
    setFormData({
      ip_range_id: '',
      ip_address: '',
      reserved_for: '',
      reservation_type: 'vm',
      notes: '',
      expires_at: '',
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      if (editingReservation) {
        // Update existing
        await api.put(`/ip-reservations/${editingReservation.id}`, {
          reserved_for: formData.reserved_for,
          notes: formData.notes,
          expires_at: formData.expires_at || null,
        });
        setSuccess('Reservation updated successfully');
      } else {
        // Create new
        await api.post('/ip-reservations', {
          ...formData,
          ip_range_id: parseInt(formData.ip_range_id),
        });
        setSuccess('Reservation created successfully');
      }

      handleCloseDialog();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/ip-reservations/${id}`);
      setSuccess('Reservation cancelled successfully');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel reservation');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'expired':
        return 'error';
      case 'fulfilled':
        return 'info';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const getExpirationDisplay = (reservation: Reservation) => {
    if (!reservation.expires_at) {
      return <Chip label="No Expiration" size="small" color="default" />;
    }

    if (reservation.is_expired) {
      return <Chip label="Expired" size="small" color="error" icon={<WarningIcon />} />;
    }

    const hours = reservation.expires_in_hours || 0;
    const color = hours <= 24 ? 'warning' : 'success';
    const label = hours < 1
      ? 'Expires soon'
      : hours <= 24
      ? `${hours}h left`
      : `${Math.floor(hours / 24)}d left`;

    return <Chip label={label} size="small" color={color} icon={<TimerIcon />} />;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          IP Reservations
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Filter Status</InputLabel>
            <Select
              value={filterStatus}
              label="Filter Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
              <MenuItem value="fulfilled">Fulfilled</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
              <MenuItem value="">All</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
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
            Reserve IP
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total
                </Typography>
                <Typography variant="h4">{summary.total}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Active
                </Typography>
                <Typography variant="h4" color="success.main">
                  {summary.active}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Expiring Soon
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {summary.expiring_soon}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Expired
                </Typography>
                <Typography variant="h4" color="error.main">
                  {summary.expired}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Fulfilled
                </Typography>
                <Typography variant="h4" color="info.main">
                  {summary.fulfilled}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>IP Address</TableCell>
              <TableCell>Subnet</TableCell>
              <TableCell>Reserved For</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Reserved By</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Expiration</TableCell>
              <TableCell>Reserved At</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>
                    No reservations found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              reservations.map((reservation) => (
                <TableRow key={reservation.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {reservation.ip_address}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{reservation.ip_ranges.subnet}</Typography>
                    {reservation.ip_ranges.vlan_id && (
                      <Chip label={`VLAN ${reservation.ip_ranges.vlan_id}`} size="small" sx={{ mt: 0.5 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{reservation.reserved_for}</Typography>
                    {reservation.virtual_machines && (
                      <Typography variant="caption" color="text.secondary">
                        VM: {reservation.virtual_machines.name} ({reservation.virtual_machines.vmid})
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={reservation.reservation_type} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {reservation.users_ip_reservations_reserved_byTousers.full_name ||
                        reservation.users_ip_reservations_reserved_byTousers.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={reservation.status}
                      size="small"
                      color={getStatusColor(reservation.status)}
                      icon={reservation.status === 'fulfilled' ? <CheckCircleIcon /> : undefined}
                    />
                  </TableCell>
                  <TableCell>{getExpirationDisplay(reservation)}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(reservation.reserved_at).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(reservation.reserved_at).toLocaleTimeString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {reservation.status === 'active' && (
                      <>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(reservation)}
                            disabled={loading}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <IconButton
                            size="small"
                            onClick={() => handleCancel(reservation.id)}
                            disabled={loading}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingReservation ? 'Edit Reservation' : 'Create IP Reservation'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {!editingReservation && (
              <>
                <FormControl fullWidth required>
                  <InputLabel>IP Range</InputLabel>
                  <Select
                    value={formData.ip_range_id}
                    label="IP Range"
                    onChange={(e) => setFormData({ ...formData, ip_range_id: e.target.value })}
                  >
                    {ipRanges.map((range) => (
                      <MenuItem key={range.id} value={range.id}>
                        {range.subnet} {range.description && `- ${range.description}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="IP Address"
                  value={formData.ip_address}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  required
                  fullWidth
                  placeholder="e.g., 10.0.1.100"
                />
              </>
            )}

            <TextField
              label="Reserved For"
              value={formData.reserved_for}
              onChange={(e) => setFormData({ ...formData, reserved_for: e.target.value })}
              required
              fullWidth
              placeholder="VM name, device, or service"
              helperText="Describe what this IP is reserved for"
            />

            {!editingReservation && (
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.reservation_type}
                  label="Type"
                  onChange={(e) => setFormData({ ...formData, reservation_type: e.target.value })}
                >
                  <MenuItem value="vm">Virtual Machine</MenuItem>
                  <MenuItem value="device">Physical Device</MenuItem>
                  <MenuItem value="service">Service</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            )}

            <TextField
              label="Expiration Date"
              type="datetime-local"
              value={formData.expires_at}
              onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Leave empty for no expiration"
            />

            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              multiline
              rows={3}
              fullWidth
              placeholder="Optional notes about this reservation"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !formData.ip_address || !formData.reserved_for}
          >
            {editingReservation ? 'Update' : 'Create'} Reservation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IPReservationsPage;
