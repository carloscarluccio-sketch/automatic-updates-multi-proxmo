import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import api from '../services/api';

interface Cluster {
  id: number;
  name: string;
  host: string;
  port: number;
  location?: string;
  status: string;
}

interface ClusterAssignment {
  id: number;
  cluster_id: number;
  assigned_at: string;
  proxmox_clusters: Cluster;
}

interface CompanyClusterDialogProps {
  open: boolean;
  onClose: () => void;
  companyId: number;
  companyName: string;
}

export const CompanyClusterDialog: React.FC<CompanyClusterDialogProps> = ({
  open,
  onClose,
  companyId,
  companyName
}) => {
  const [assignments, setAssignments] = useState<ClusterAssignment[]>([]);
  const [availableClusters, setAvailableClusters] = useState<Cluster[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, companyId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load assigned clusters
      const assignedRes = await api.get(`/companies/${companyId}/clusters`);
      setAssignments(assignedRes.data.data || []);

      // Load available clusters
      const availableRes = await api.get(`/companies/${companyId}/clusters/available`);
      setAvailableClusters(availableRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load clusters');
      console.error('Load clusters error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCluster = async () => {
    if (!selectedClusterId) {
      setError('Please select a cluster');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/companies/${companyId}/clusters`, {
        cluster_id: Number(selectedClusterId)
      });

      setSuccess('Cluster assigned successfully');
      setSelectedClusterId('');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign cluster');
      console.error('Assign cluster error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignCluster = async (clusterId: number, clusterName: string) => {
    if (!window.confirm(`Are you sure you want to unassign cluster "${clusterName}"?\n\nThis will only work if there are no active VMs on this cluster for this company.`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/companies/${companyId}/clusters/${clusterId}`);
      setSuccess(`Cluster "${clusterName}" unassigned successfully`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to unassign cluster');
      console.error('Unassign cluster error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setSelectedClusterId('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <StorageIcon />
            <Typography variant="h6">
              Cluster Assignments - {companyName}
            </Typography>
          </Box>
          <IconButton onClick={loadData} disabled={loading} size="small">
            <RefreshIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {loading && (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        )}

        {!loading && (
          <>
            {/* Assigned Clusters Section */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Assigned Clusters ({assignments.length})
              </Typography>

              {assignments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No clusters assigned yet
                </Typography>
              ) : (
                <List dense>
                  {assignments.map((assignment) => (
                    <React.Fragment key={assignment.id}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body1" fontWeight="medium">
                                {assignment.proxmox_clusters.name}
                              </Typography>
                              <Chip
                                label={assignment.proxmox_clusters.status}
                                size="small"
                                color={assignment.proxmox_clusters.status === 'active' ? 'success' : 'default'}
                              />
                            </Box>
                          }
                          secondary={
                            <Box component="span">
                              <Typography variant="body2" component="span">
                                {assignment.proxmox_clusters.host}:{assignment.proxmox_clusters.port}
                              </Typography>
                              {assignment.proxmox_clusters.location && (
                                <Typography variant="body2" component="span" sx={{ ml: 2 }}>
                                  • {assignment.proxmox_clusters.location}
                                </Typography>
                              )}
                              <Typography variant="caption" component="span" sx={{ display: 'block' }} color="text.secondary">
                                Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            color="error"
                            onClick={() => handleUnassignCluster(
                              assignment.cluster_id,
                              assignment.proxmox_clusters.name
                            )}
                            disabled={loading}
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>

            {/* Assign New Cluster Section */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Assign New Cluster
              </Typography>

              {availableClusters.length === 0 ? (
                <Alert severity="info" icon={<CheckCircleIcon />}>
                  All available clusters are already assigned to this company.
                </Alert>
              ) : (
                <Box display="flex" gap={2} alignItems="flex-start">
                  <FormControl fullWidth>
                    <InputLabel>Select Cluster</InputLabel>
                    <Select
                      value={selectedClusterId}
                      label="Select Cluster"
                      onChange={(e: SelectChangeEvent<string>) => setSelectedClusterId(e.target.value)}
                      disabled={loading}
                    >
                      <MenuItem value="">
                        <em>Choose a cluster...</em>
                      </MenuItem>
                      {availableClusters.map((cluster) => (
                        <MenuItem key={cluster.id} value={cluster.id.toString()}>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {cluster.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {cluster.host}:{cluster.port}
                              {cluster.location && ` • ${cluster.location}`}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAssignCluster}
                    disabled={loading || !selectedClusterId}
                    sx={{ minWidth: 120 }}
                  >
                    Assign
                  </Button>
                </Box>
              )}
            </Paper>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
