import React, { useState, useEffect } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography, Switch, FormControlLabel, Alert, Snackbar, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Block as BlockIcon,
  CheckCircle as CheckCircleIcon, Speed as SpeedIcon
} from '@mui/icons-material';
import api from '../services/api';

interface RateLimit {
  id: number;
  endpoint: string;
  method: string;
  max_requests: number;
  window_seconds: number;
  block_duration_seconds: number;
  is_enabled: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface RateLimitStats {
  total_configs: number;
  enabled_configs: number;
  disabled_configs: number;
  recent_blocks_24h: number;
}

interface FormData {
  endpoint: string;
  method: string;
  max_requests: number;
  window_seconds: number;
  block_duration_seconds: number;
  description: string;
  is_enabled: boolean;
}

const RateLimitsPage: React.FC = () => {
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [stats, setStats] = useState<RateLimitStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<FormData>({
    endpoint: '',
    method: 'ALL',
    max_requests: 100,
    window_seconds: 60,
    block_duration_seconds: 300,
    description: '',
    is_enabled: true
  });

  useEffect(() => {
    loadRateLimits();
    loadStats();
  }, []);

  const loadRateLimits = async () => {
    try {
      setLoading(true);
      const response = await api.get('/rate-limits');
      setRateLimits(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load rate limits');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/rate-limits/stats');
      setStats(response.data.data);
    } catch (err: any) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleOpenDialog = (rateLimit?: RateLimit) => {
    if (rateLimit) {
      setEditingId(rateLimit.id);
      setFormData({
        endpoint: rateLimit.endpoint,
        method: rateLimit.method,
        max_requests: rateLimit.max_requests,
        window_seconds: rateLimit.window_seconds,
        block_duration_seconds: rateLimit.block_duration_seconds,
        description: rateLimit.description || '',
        is_enabled: rateLimit.is_enabled
      });
    } else {
      setEditingId(null);
      setFormData({
        endpoint: '',
        method: 'ALL',
        max_requests: 100,
        window_seconds: 60,
        block_duration_seconds: 300,
        description: '',
        is_enabled: true
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingId) {
        await api.patch(`/rate-limits/${editingId}`, formData);
        setSuccess('Rate limit updated successfully');
      } else {
        await api.post('/rate-limits', formData);
        setSuccess('Rate limit created successfully');
      }
      handleCloseDialog();
      loadRateLimits();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save rate limit');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await api.delete(`/rate-limits/${deleteId}`);
      setSuccess('Rate limit deleted successfully');
      setDeleteDialogOpen(false);
      setDeleteId(null);
      loadRateLimits();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete rate limit');
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (seconds < 3600) return `${minutes}m`;
    const hours = Math.floor(seconds / 3600);
    return `${hours}h`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          <SpeedIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          API Rate Limit Management
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add Rate Limit
        </Button>
      </Box>

      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Typography color="textSecondary" gutterBottom>Total Configs</Typography>
              <Typography variant="h4">{stats.total_configs}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Typography color="textSecondary" gutterBottom>Enabled</Typography>
              <Typography variant="h4" color="success.main">{stats.enabled_configs}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Typography color="textSecondary" gutterBottom>Disabled</Typography>
              <Typography variant="h4" color="warning.main">{stats.disabled_configs}</Typography>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card><CardContent>
              <Typography color="textSecondary" gutterBottom>Blocks (24h)</Typography>
              <Typography variant="h4" color="error.main">{stats.recent_blocks_24h}</Typography>
            </CardContent></Card>
          </Grid>
        </Grid>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Endpoint</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Max Requests</TableCell>
              <TableCell>Window</TableCell>
              <TableCell>Block Duration</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rateLimits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="textSecondary">{loading ? 'Loading...' : 'No rate limits configured'}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              rateLimits.map((rateLimit) => (
                <TableRow key={rateLimit.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{rateLimit.endpoint}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={rateLimit.method} size="small" color={rateLimit.method === 'GET' ? 'info' : rateLimit.method === 'POST' ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell><Typography variant="body2">{rateLimit.max_requests} requests</Typography></TableCell>
                  <TableCell><Typography variant="body2">{formatDuration(rateLimit.window_seconds)}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{formatDuration(rateLimit.block_duration_seconds)}</Typography></TableCell>
                  <TableCell>
                    {rateLimit.is_enabled ? (
                      <Chip icon={<CheckCircleIcon />} label="Enabled" color="success" size="small" />
                    ) : (
                      <Chip icon={<BlockIcon />} label="Disabled" color="default" size="small" />
                    )}
                  </TableCell>
                  <TableCell><Typography variant="body2" color="textSecondary">{rateLimit.description || '-'}</Typography></TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleOpenDialog(rateLimit)} color="primary"><EditIcon /></IconButton>
                    <IconButton size="small" onClick={() => { setDeleteId(rateLimit.id); setDeleteDialogOpen(true); }} color="error"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Rate Limit' : 'Add Rate Limit'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Endpoint" value={formData.endpoint} onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })} placeholder="/api/resource" helperText="Use /* for wildcard matching" />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Method</InputLabel>
                <Select value={formData.method} label="Method" onChange={(e) => setFormData({ ...formData, method: e.target.value })}>
                  <MenuItem value="ALL">ALL</MenuItem>
                  <MenuItem value="GET">GET</MenuItem>
                  <MenuItem value="POST">POST</MenuItem>
                  <MenuItem value="PUT">PUT</MenuItem>
                  <MenuItem value="PATCH">PATCH</MenuItem>
                  <MenuItem value="DELETE">DELETE</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Max Requests" type="number" value={formData.max_requests} onChange={(e) => setFormData({ ...formData, max_requests: parseInt(e.target.value) })} inputProps={{ min: 1 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Window (seconds)" type="number" value={formData.window_seconds} onChange={(e) => setFormData({ ...formData, window_seconds: parseInt(e.target.value) })} inputProps={{ min: 1 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Block Duration (seconds)" type="number" value={formData.block_duration_seconds} onChange={(e) => setFormData({ ...formData, block_duration_seconds: parseInt(e.target.value) })} inputProps={{ min: 0 }} helperText="How long to block after limit exceeded" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Description" multiline rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel control={<Switch checked={formData.is_enabled} onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })} />} label="Enabled" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">{editingId ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent><Typography>Are you sure you want to delete this rate limit configuration?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess('')}>
        <Alert onClose={() => setSuccess('')} severity="success">{success}</Alert>
      </Snackbar>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error">{error}</Alert>
      </Snackbar>
    </Box>
  );
};

export default RateLimitsPage;
