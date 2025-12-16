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
  MenuItem,
  FormControlLabel,
  Checkbox,
  Select,
  InputLabel,
  FormControl,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StorageIcon from '@mui/icons-material/Storage';
import SyncIcon from '@mui/icons-material/Sync';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import { DataTable, Column } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface ISO {
  id: number;
  name: string;
  filename: string;
  size_bytes: bigint | null;
  company_id: number | null;
  cluster_id: number | null;
  storage: string | null;
  node: string | null;
  is_default: boolean;
  description: string | null;
  uploaded_by: number | null;
  created_at: string;
  updated_at: string;
}

interface Cluster {
  id: number;
  name: string;
  host: string;
}

interface SyncJob {
  id: string;
  sourceIsoId: number;
  sourceClusterId: number;
  targetClusterIds: number[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  results: Array<{
    clusterId: number;
    status: 'pending' | 'success' | 'failed';
    message?: string;
    isoId?: number;
  }>;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export const ISOsPage: React.FC = () => {
  const [isos, setISOs] = useState<ISO[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDialog, setOpenDialog] = useState(false);
  const [openSyncDialog, setOpenSyncDialog] = useState(false);
  const [editingISO, setEditingISO] = useState<ISO | null>(null);
  const [syncingISO, setSyncingISO] = useState<ISO | null>(null);
  const [syncTargetClusters, setSyncTargetClusters] = useState<number[]>([]);
  const [syncTargetStorage, setSyncTargetStorage] = useState('');
  const [syncTargetNode, setSyncTargetNode] = useState('');
  const [syncJob, setSyncJob] = useState<SyncJob | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    filename: '',
    size_bytes: '',
    cluster_id: '',
    storage: '',
    node: '',
    is_default: false,
    description: '',
  });
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    if (syncJob && syncJob.status === 'in_progress') {
      interval = window.setInterval(() => {
        checkSyncJobStatus(syncJob.id);
      }, 2000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [syncJob]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadISOs(), loadClusters()]);
    } catch (error) {
      showSnackbar('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadISOs = async () => {
    try {
      const response = await api.get('/isos');
      setISOs(response.data.data || []);
    } catch (error) {
      console.error('Failed to load ISOs:', error);
    }
  };

  const loadClusters = async () => {
    try {
      const response = await api.get('/clusters');
      setClusters(response.data.data || []);
    } catch (error) {
      console.error('Failed to load clusters:', error);
    }
  };

  const checkSyncJobStatus = async (jobId: string) => {
    try {
      const response = await api.get(`/isos/sync/${jobId}`);
      const job = response.data.data;
      setSyncJob(job);

      if (job.status === 'completed') {
        showSnackbar('ISO sync completed successfully!', 'success');
        await loadISOs(); // Reload ISOs to show newly synced ones
      } else if (job.status === 'failed') {
        showSnackbar(`ISO sync failed: ${job.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to check sync job status:', error);
    }
  };

  const handleOpenDialog = (iso?: ISO) => {
    if (iso) {
      setEditingISO(iso);
      setFormData({
        name: iso.name,
        filename: iso.filename,
        size_bytes: iso.size_bytes?.toString() || '',
        cluster_id: iso.cluster_id?.toString() || '',
        storage: iso.storage || '',
        node: iso.node || '',
        is_default: iso.is_default,
        description: iso.description || '',
      });
    } else {
      setEditingISO(null);
      setFormData({
        name: '',
        filename: '',
        size_bytes: '',
        cluster_id: '',
        storage: '',
        node: '',
        is_default: false,
        description: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingISO(null);
  };

  const handleOpenSyncDialog = (iso: ISO) => {
    setSyncingISO(iso);
    setSyncTargetClusters([]);
    setSyncTargetStorage('');
    setSyncTargetNode('');
    setSyncJob(null);
    setOpenSyncDialog(true);
  };

  const handleCloseSyncDialog = () => {
    setOpenSyncDialog(false);
    setSyncingISO(null);
    setSyncJob(null);
  };

  const handleStartSync = async () => {
    if (!syncingISO || syncTargetClusters.length === 0) {
      showSnackbar('Please select at least one target cluster', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/isos/sync', {
        isoId: syncingISO.id,
        targetClusterIds: syncTargetClusters,
        targetStorage: syncTargetStorage || undefined,
        targetNode: syncTargetNode || undefined,
      });

      const job = response.data.data;
      setSyncJob(job);
      showSnackbar('ISO sync started successfully!', 'success');
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to start ISO sync', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const data = {
        ...formData,
        size_bytes: formData.size_bytes ? parseInt(formData.size_bytes) : null,
        cluster_id: formData.cluster_id ? parseInt(formData.cluster_id) : null,
      };

      if (editingISO) {
        await api.put(`/isos/${editingISO.id}`, data);
        showSnackbar('ISO updated successfully', 'success');
      } else {
        await api.post('/isos', data);
        showSnackbar('ISO created successfully', 'success');
      }

      handleCloseDialog();
      await loadISOs();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (iso: ISO) => {
    if (!window.confirm(`Are you sure you want to delete ISO "${iso.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/isos/${iso.id}`);
      showSnackbar('ISO deleted successfully', 'success');
      await loadISOs();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to delete ISO', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const formatBytes = (bytes: bigint | null): string => {
    if (!bytes) return 'N/A';
    const gb = Number(bytes) / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const getClusterName = (clusterId: number | null): string => {
    if (!clusterId) return 'N/A';
    const cluster = clusters.find((c) => c.id === clusterId);
    return cluster?.name || 'Unknown';
  };

  const getAvailableTargetClusters = (): Cluster[] => {
    if (!syncingISO?.cluster_id) return clusters;
    return clusters.filter((c) => c.id !== syncingISO.cluster_id);
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'pending':
        return <PendingIcon color="action" />;
      default:
        return <CircularProgress size={20} />;
    }
  };

  const columns: Column[] = [
    { id: 'name', label: 'Name', minWidth: 200 },
    { id: 'filename', label: 'Filename', minWidth: 200 },
    {
      id: 'size_bytes',
      label: 'Size',
      minWidth: 100,
      format: (value) => formatBytes(value as bigint | null),
    },
    {
      id: 'cluster_id',
      label: 'Cluster',
      minWidth: 150,
      format: (value) => getClusterName(value as number | null),
    },
    {
      id: 'is_default',
      label: 'Type',
      minWidth: 100,
      format: (value) => (
        <Chip
          label={value ? 'Default' : 'Custom'}
          color={value ? 'success' : 'default'}
          size="small"
          icon={<StorageIcon />}
        />
      ),
    },
    { id: 'storage', label: 'Storage', minWidth: 120 },
    { id: 'node', label: 'Node', minWidth: 120 },
    { id: 'description', label: 'Description', minWidth: 200 },
  ];

  if (currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin') {
    columns.push({
      id: 'actions',
      label: 'Actions',
      minWidth: 200,
      format: (_value, row: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Sync to other clusters">
            <IconButton size="small" color="primary" onClick={() => handleOpenSyncDialog(row)}>
              <SyncIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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
              disabled={row.is_default && currentUser?.role !== 'super_admin'}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    });
  }

  if (loading && isos.length === 0) {
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
          <Box>
            <Typography variant="h4" gutterBottom>
              ISO Management
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Manage installation ISO images for VM creation and sync across clusters
            </Typography>
          </Box>
          {(currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin') && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} disabled={loading}>
              Add ISO
            </Button>
          )}
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Found {isos.length} ISO images. Use the sync button to copy ISOs across multiple Proxmox clusters.
        </Alert>

        <DataTable columns={columns} rows={isos} emptyMessage="No ISOs found" />

        {/* ISO Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>{editingISO ? 'Edit ISO' : 'Add ISO'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                fullWidth
                helperText="Display name for the ISO"
              />
              <TextField
                label="Filename"
                value={formData.filename}
                onChange={(e) => setFormData({ ...formData, filename: e.target.value })}
                required
                fullWidth
                helperText="ISO filename (e.g., ubuntu-22.04-server.iso)"
              />
              <TextField
                label="Size (bytes)"
                type="number"
                value={formData.size_bytes}
                onChange={(e) => setFormData({ ...formData, size_bytes: e.target.value })}
                fullWidth
                helperText="ISO file size in bytes"
              />
              <TextField
                select
                label="Cluster"
                value={formData.cluster_id}
                onChange={(e) => setFormData({ ...formData, cluster_id: e.target.value })}
                fullWidth
                helperText="Proxmox cluster where ISO is stored"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {clusters.map((cluster) => (
                  <MenuItem key={cluster.id} value={cluster.id.toString()}>
                    {cluster.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Storage"
                value={formData.storage}
                onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                fullWidth
                helperText="Proxmox storage location (e.g., local)"
              />
              <TextField
                label="Node"
                value={formData.node}
                onChange={(e) => setFormData({ ...formData, node: e.target.value })}
                fullWidth
                helperText="Proxmox node name (e.g., pve1)"
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
                fullWidth
                helperText="Additional notes about this ISO"
              />
              {currentUser?.role === 'super_admin' && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.is_default}
                      onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    />
                  }
                  label="Default ISO (available to all companies)"
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
              disabled={loading || !formData.name || !formData.filename}
            >
              {editingISO ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ISO Sync Dialog */}
        <Dialog open={openSyncDialog} onClose={handleCloseSyncDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            Sync ISO: {syncingISO?.name}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {!syncJob ? (
                <>
                  <Alert severity="info">
                    Source: {getClusterName(syncingISO?.cluster_id || null)} ({syncingISO?.storage}/{syncingISO?.node})
                  </Alert>

                  <FormControl fullWidth>
                    <InputLabel>Target Clusters</InputLabel>
                    <Select
                      multiple
                      value={syncTargetClusters}
                      onChange={(e: SelectChangeEvent<number[]>) => {
                        const value = e.target.value;
                        setSyncTargetClusters(typeof value === 'string' ? [] : value);
                      }}
                      input={<OutlinedInput label="Target Clusters" />}
                      renderValue={(selected) =>
                        (selected as number[]).map((id) => getClusterName(id)).join(', ')
                      }
                    >
                      {getAvailableTargetClusters().map((cluster) => (
                        <MenuItem key={cluster.id} value={cluster.id}>
                          {cluster.name} ({cluster.host})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Target Storage (optional)"
                    value={syncTargetStorage}
                    onChange={(e) => setSyncTargetStorage(e.target.value)}
                    fullWidth
                    helperText="Leave empty to use source storage name"
                  />

                  <TextField
                    label="Target Node (optional)"
                    value={syncTargetNode}
                    onChange={(e) => setSyncTargetNode(e.target.value)}
                    fullWidth
                    helperText="Leave empty to use source node name"
                  />
                </>
              ) : (
                <Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Sync Progress
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={syncJob.progress}
                        sx={{ flexGrow: 1 }}
                      />
                      <Typography variant="body2" color="textSecondary">
                        {syncJob.progress}%
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                      Status: {syncJob.status}
                    </Typography>
                  </Box>

                  <List>
                    {syncJob.results.map((result, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          {getSyncStatusIcon(result.status)}
                        </ListItemIcon>
                        <ListItemText
                          primary={getClusterName(result.clusterId)}
                          secondary={result.message || result.status}
                        />
                      </ListItem>
                    ))}
                  </List>

                  {syncJob.error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {syncJob.error}
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseSyncDialog} disabled={loading}>
              {syncJob?.status === 'in_progress' ? 'Close' : 'Cancel'}
            </Button>
            {!syncJob && (
              <Button
                onClick={handleStartSync}
                variant="contained"
                startIcon={<SyncIcon />}
                disabled={loading || syncTargetClusters.length === 0}
              >
                Start Sync
              </Button>
            )}
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
