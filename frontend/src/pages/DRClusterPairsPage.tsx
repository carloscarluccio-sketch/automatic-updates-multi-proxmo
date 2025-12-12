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
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  HealthAndSafety as DRIcon,
  PlayArrow as EnableIcon,
  Stop as DisableIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface DRClusterPair {
  id: number;
  primary_cluster_id: number;
  dr_cluster_id: number;
  pair_name: string;
  replication_enabled: boolean;
  replication_schedule: string;
  replication_method: 'zfs' | 'storage_replication' | 'backup_restore';
  dr_network_mapping: string | null;
  dr_ip_translation: boolean;
  auto_failover_enabled: boolean;
  failover_priority: number;
  max_failover_time: number;
  require_manual_approval: boolean;
  health_check_enabled: boolean;
  health_check_interval: number;
  failure_threshold: number;
  status: 'active' | 'inactive' | 'failover_active' | 'testing' | 'error';
  last_health_check: string | null;
  last_sync: string | null;
  last_failover: string | null;
  company_id: number | null;
  managed_by: 'super_admin' | 'company_admin';
  created_at: string;
  proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters: {
    id: number;
    name: string;
    host: string;
  };
  proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters: {
    id: number;
    name: string;
    host: string;
  };
  companies?: {
    id: number;
    name: string;
  };
  users?: {
    id: number;
    username: string;
  };
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
  primary_cluster_id: number | '';
  dr_cluster_id: number | '';
  pair_name: string;
  replication_enabled: boolean;
  replication_schedule: string;
  replication_method: 'zfs' | 'storage_replication' | 'backup_restore';
  dr_network_mapping: string;
  dr_ip_translation: boolean;
  auto_failover_enabled: boolean;
  failover_priority: number;
  max_failover_time: number;
  require_manual_approval: boolean;
  health_check_enabled: boolean;
  health_check_interval: number;
  failure_threshold: number;
  status: 'active' | 'inactive' | 'failover_active' | 'testing' | 'error';
  company_id: number | '';
}

const DRClusterPairsPage: React.FC = () => {
  const [pairs, setPairs] = useState<DRClusterPair[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPair, setEditingPair] = useState<DRClusterPair | null>(null);
  const [deletingPair, setDeletingPair] = useState<DRClusterPair | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('user');

  const [formData, setFormData] = useState<FormData>({
    primary_cluster_id: '',
    dr_cluster_id: '',
    pair_name: '',
    replication_enabled: true,
    replication_schedule: '*/15 * * * *',
    replication_method: 'storage_replication',
    dr_network_mapping: '',
    dr_ip_translation: true,
    auto_failover_enabled: false,
    failover_priority: 100,
    max_failover_time: 300,
    require_manual_approval: true,
    health_check_enabled: true,
    health_check_interval: 60,
    failure_threshold: 3,
    status: 'active',
    company_id: '',
  });

  useEffect(() => {
    loadData();
    checkUserRole();
  }, []);

  const checkUserRole = () => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role || 'user');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [pairsRes, clustersRes, companiesRes] = await Promise.all([
        api.get('/dr-cluster-pairs'),
        api.get('/dr-cluster-pairs/available-clusters'),
        userRole === 'super_admin' ? api.get('/companies') : Promise.resolve({ data: { data: [] } })
      ]);

      setPairs(pairsRes.data.data || []);
      setClusters(clustersRes.data.data || []);
      if (userRole === 'super_admin') {
        setCompanies(companiesRes.data.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (pair?: DRClusterPair) => {
    if (pair) {
      setEditingPair(pair);
      setFormData({
        primary_cluster_id: pair.primary_cluster_id,
        dr_cluster_id: pair.dr_cluster_id,
        pair_name: pair.pair_name,
        replication_enabled: pair.replication_enabled,
        replication_schedule: pair.replication_schedule,
        replication_method: pair.replication_method,
        dr_network_mapping: pair.dr_network_mapping || '',
        dr_ip_translation: pair.dr_ip_translation,
        auto_failover_enabled: pair.auto_failover_enabled,
        failover_priority: pair.failover_priority,
        max_failover_time: pair.max_failover_time,
        require_manual_approval: pair.require_manual_approval,
        health_check_enabled: pair.health_check_enabled,
        health_check_interval: pair.health_check_interval,
        failure_threshold: pair.failure_threshold,
        status: pair.status,
        company_id: pair.company_id || '',
      });
    } else {
      setEditingPair(null);
      setFormData({
        primary_cluster_id: '',
        dr_cluster_id: '',
        pair_name: '',
        replication_enabled: true,
        replication_schedule: '*/15 * * * *',
        replication_method: 'storage_replication',
        dr_network_mapping: '',
        dr_ip_translation: true,
        auto_failover_enabled: false,
        failover_priority: 100,
        max_failover_time: 300,
        require_manual_approval: true,
        health_check_enabled: true,
        health_check_interval: 60,
        failure_threshold: 3,
        status: 'active',
        company_id: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPair(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      if (editingPair) {
        await api.put(`/dr-cluster-pairs/${editingPair.id}`, formData);
        setSuccess('DR cluster pair updated successfully');
      } else {
        await api.post('/dr-cluster-pairs', formData);
        setSuccess('DR cluster pair created successfully');
      }

      handleCloseDialog();
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save DR cluster pair');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingPair) return;

    try {
      setLoading(true);
      setError(null);

      await api.delete(`/dr-cluster-pairs/${deletingPair.id}`);
      setSuccess('DR cluster pair deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingPair(null);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete DR cluster pair');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReplication = async (pair: DRClusterPair) => {
    try {
      setLoading(true);
      setError(null);

      await api.patch(`/dr-cluster-pairs/${pair.id}/toggle-replication`);
      setSuccess(`Replication ${pair.replication_enabled ? 'disabled' : 'enabled'} successfully`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle replication');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'failover_active': return 'warning';
      case 'testing': return 'info';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DRIcon color="primary" fontSize="large" />
          <Typography variant="h4">DR Cluster Pairs</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
          >
            Create Pair
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
              <TableCell>Pair Name</TableCell>
              <TableCell>Primary Cluster</TableCell>
              <TableCell>DR Cluster</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Replication</TableCell>
              <TableCell>Auto-Failover</TableCell>
              <TableCell>Last Sync</TableCell>
              {userRole === 'super_admin' && <TableCell>Company</TableCell>}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={userRole === 'super_admin' ? 10 : 9} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : pairs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={userRole === 'super_admin' ? 10 : 9} align="center">
                  No DR cluster pairs found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              pairs.map((pair) => (
                <TableRow key={pair.id}>
                  <TableCell>{pair.pair_name}</TableCell>
                  <TableCell>
                    {pair.proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters.name}
                    <Typography variant="caption" display="block" color="textSecondary">
                      {pair.proxmox_clusters_dr_cluster_pairs_primary_cluster_idToproxmox_clusters.host}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {pair.proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters.name}
                    <Typography variant="caption" display="block" color="textSecondary">
                      {pair.proxmox_clusters_dr_cluster_pairs_dr_cluster_idToproxmox_clusters.host}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={pair.replication_method.replace('_', ' ')}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={pair.status}
                      color={getStatusColor(pair.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={pair.replication_enabled ? 'Click to disable' : 'Click to enable'}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleReplication(pair)}
                        color={pair.replication_enabled ? 'success' : 'default'}
                      >
                        {pair.replication_enabled ? <EnableIcon /> : <DisableIcon />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={pair.auto_failover_enabled ? 'Enabled' : 'Disabled'}
                      color={pair.auto_failover_enabled ? 'warning' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {pair.last_sync ? new Date(pair.last_sync).toLocaleString() : 'Never'}
                  </TableCell>
                  {userRole === 'super_admin' && (
                    <TableCell>{pair.companies?.name || 'All Companies'}</TableCell>
                  )}
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(pair)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDeletingPair(pair);
                        setDeleteDialogOpen(true);
                      }}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPair ? 'Edit DR Cluster Pair' : 'Create DR Cluster Pair'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Pair Name"
                value={formData.pair_name}
                onChange={(e) => setFormData({ ...formData, pair_name: e.target.value })}
                disabled={loading}
                helperText="Auto-generated from cluster names if left empty"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Primary Cluster</InputLabel>
                <Select
                  value={formData.primary_cluster_id}
                  label="Primary Cluster"
                  onChange={(e) => setFormData({ ...formData, primary_cluster_id: e.target.value as number })}
                  disabled={loading || !!editingPair}
                >
                  {clusters.map((cluster) => (
                    <MenuItem key={cluster.id} value={cluster.id} disabled={cluster.id === formData.dr_cluster_id}>
                      {cluster.name} ({cluster.location || cluster.host})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>DR Cluster</InputLabel>
                <Select
                  value={formData.dr_cluster_id}
                  label="DR Cluster"
                  onChange={(e) => setFormData({ ...formData, dr_cluster_id: e.target.value as number })}
                  disabled={loading || !!editingPair}
                >
                  {clusters.map((cluster) => (
                    <MenuItem key={cluster.id} value={cluster.id} disabled={cluster.id === formData.primary_cluster_id}>
                      {cluster.name} ({cluster.location || cluster.host})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {userRole === 'super_admin' && !editingPair && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Company (Optional)</InputLabel>
                  <Select
                    value={formData.company_id}
                    label="Company (Optional)"
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value as number })}
                    disabled={loading}
                  >
                    <MenuItem value="">All Companies</MenuItem>
                    {companies.map((company) => (
                      <MenuItem key={company.id} value={company.id}>
                        {company.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Replication Method</InputLabel>
                <Select
                  value={formData.replication_method}
                  label="Replication Method"
                  onChange={(e) => setFormData({ ...formData, replication_method: e.target.value as FormData['replication_method'] })}
                  disabled={loading}
                >
                  <MenuItem value="storage_replication">Storage Replication</MenuItem>
                  <MenuItem value="zfs">ZFS Replication</MenuItem>
                  <MenuItem value="backup_restore">Backup & Restore</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Replication Schedule (Cron)"
                value={formData.replication_schedule}
                onChange={(e) => setFormData({ ...formData, replication_schedule: e.target.value })}
                disabled={loading}
                placeholder="*/15 * * * *"
                helperText="Cron expression (default: every 15 minutes)"
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Failover Priority"
                value={formData.failover_priority}
                onChange={(e) => setFormData({ ...formData, failover_priority: parseInt(e.target.value) })}
                disabled={loading}
                helperText="Lower = higher priority"
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Max Failover Time (sec)"
                value={formData.max_failover_time}
                onChange={(e) => setFormData({ ...formData, max_failover_time: parseInt(e.target.value) })}
                disabled={loading}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Health Check Interval (sec)"
                value={formData.health_check_interval}
                onChange={(e) => setFormData({ ...formData, health_check_interval: parseInt(e.target.value) })}
                disabled={loading}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="DR Network Mapping (JSON)"
                value={formData.dr_network_mapping}
                onChange={(e) => setFormData({ ...formData, dr_network_mapping: e.target.value })}
                disabled={loading}
                placeholder='{"vmbr0": "vmbr1", "vmbr2": "vmbr3"}'
                helperText="Optional: Map primary network bridges to DR bridges"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.replication_enabled}
                    onChange={(e) => setFormData({ ...formData, replication_enabled: e.target.checked })}
                    disabled={loading}
                  />
                }
                label="Replication Enabled"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.dr_ip_translation}
                    onChange={(e) => setFormData({ ...formData, dr_ip_translation: e.target.checked })}
                    disabled={loading}
                  />
                }
                label="DR IP Translation"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.auto_failover_enabled}
                    onChange={(e) => setFormData({ ...formData, auto_failover_enabled: e.target.checked })}
                    disabled={loading}
                  />
                }
                label="Auto-Failover Enabled"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.require_manual_approval}
                    onChange={(e) => setFormData({ ...formData, require_manual_approval: e.target.checked })}
                    disabled={loading}
                  />
                }
                label="Require Manual Approval"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.health_check_enabled}
                    onChange={(e) => setFormData({ ...formData, health_check_enabled: e.target.checked })}
                    disabled={loading}
                  />
                }
                label="Health Check Enabled"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as FormData['status'] })}
                  disabled={loading}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="testing">Testing</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !formData.primary_cluster_id || !formData.dr_cluster_id}
          >
            {editingPair ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the DR cluster pair "{deletingPair?.pair_name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={loading}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DRClusterPairsPage;
