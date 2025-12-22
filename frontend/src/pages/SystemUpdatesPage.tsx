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
  IconButton,
  Typography,
  Chip,
  Alert,
  Card,
  CardContent,
  Grid,
  LinearProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Update as UpdateIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  CloudDownload as DownloadIcon,
  Undo as UndoIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  versions: string[];
}

interface UpdateHistory {
  id: number;
  version_from: string;
  version_to: string;
  update_type: 'major' | 'minor' | 'patch' | 'hotfix';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  backup_file: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  git_commit_hash: string | null;
  user: {
    id: number;
    username: string;
    email: string;
  };
}

interface SystemInfo {
  id: number;
  current_version: string;
  git_commit_hash: string | null;
  last_update_check: string | null;
  last_updated_at: string | null;
  installation_date: string;
  instance_id: string | null;
  instance_name: string | null;
}

const SystemUpdatesPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [updateHistory, setUpdateHistory] = useState<UpdateHistory[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [changelog, setChangelog] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openVersionDialog, setOpenVersionDialog] = useState(false);
  const [openChangelogDialog, setOpenChangelogDialog] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);

  // Only super_admin can access this page
  if (currentUser?.role !== 'super_admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Only super administrators can access system updates.
        </Alert>
      </Box>
    );
  }

  useEffect(() => {
    loadSystemInfo();
    loadUpdateHistory();
    checkForUpdates();
  }, []);

  const loadSystemInfo = async () => {
    try {
      const response = await api.get('/api/system/updates/info');
      setSystemInfo(response.data.data);
    } catch (err: any) {
      console.error('Failed to load system info:', err);
    }
  };

  const checkForUpdates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/system/updates/check');
      setUpdateInfo(response.data.data);
      setSuccess('Update check completed');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to check for updates');
    } finally {
      setLoading(false);
    }
  };

  const loadUpdateHistory = async () => {
    try {
      const response = await api.get('/api/system/updates/history');
      setUpdateHistory(response.data.data);
    } catch (err: any) {
      console.error('Failed to load update history:', err);
    }
  };

  const loadChangelog = async (version: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/api/system/updates/changelog/${version}`);
      setChangelog(response.data.data.changelog);
      setSelectedVersion(version);
      setOpenChangelogDialog(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load changelog');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClick = (version: string) => {
    setSelectedVersion(version);
    loadChangelog(version);
    setOpenConfirmDialog(true);
  };

  const executeUpdate = async () => {
    setOpenConfirmDialog(false);
    setUpdating(true);
    setError(null);
    try {
      const response = await api.post('/api/system/updates/execute', {
        targetVersion: selectedVersion
      });
      setSuccess(response.data.message);
      loadSystemInfo();
      loadUpdateHistory();
      checkForUpdates();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const handleRollback = async (updateId: number) => {
    if (!window.confirm('Are you sure you want to rollback this update?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/api/system/updates/rollback', { updateId });
      setSuccess(response.data.message);
      loadSystemInfo();
      loadUpdateHistory();
      checkForUpdates();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Rollback failed');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'failed': return 'error';
      case 'rolled_back': return 'warning';
      default: return 'default';
    }
  };

  const getUpdateTypeColor = (type: string) => {
    switch (type) {
      case 'major': return 'error';
      case 'minor': return 'warning';
      case 'patch': return 'info';
      case 'hotfix': return 'success';
      default: return 'default';
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        System Updates
      </Typography>

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

      {updating && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">Update in progress... This may take several minutes.</Typography>
          <LinearProgress sx={{ mt: 1 }} />
        </Alert>
      )}

      {/* Current System Info */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                <InfoIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Current Version
              </Typography>
              <Typography variant="h5">{systemInfo?.current_version || 'Unknown'}</Typography>
              {systemInfo?.git_commit_hash && (
                <Typography variant="caption" color="text.secondary">
                  Commit: {systemInfo.git_commit_hash.substring(0, 7)}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                <DownloadIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Latest Version
              </Typography>
              <Typography variant="h5">{updateInfo?.latestVersion || 'Checking...'}</Typography>
              {updateInfo?.updateAvailable ? (
                <Chip label="Update Available" color="warning" size="small" sx={{ mt: 1 }} />
              ) : (
                <Chip label="Up to Date" color="success" size="small" sx={{ mt: 1 }} />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                <ScheduleIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Last Updated
              </Typography>
              <Typography variant="h6">
                {systemInfo?.last_updated_at
                  ? new Date(systemInfo.last_updated_at).toLocaleDateString()
                  : 'Never'}
              </Typography>
              {systemInfo?.instance_name && (
                <Typography variant="caption" color="text.secondary">
                  Instance: {systemInfo.instance_name}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Actions */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={checkForUpdates}
          disabled={loading || updating}
        >
          Check for Updates
        </Button>

        {updateInfo?.updateAvailable && (
          <Button
            variant="contained"
            color="warning"
            startIcon={<UpdateIcon />}
            onClick={() => handleUpdateClick(updateInfo.latestVersion)}
            disabled={loading || updating}
          >
            Update to {updateInfo.latestVersion}
          </Button>
        )}

        <Button
          variant="outlined"
          startIcon={<HistoryIcon />}
          onClick={() => setOpenVersionDialog(true)}
          disabled={loading || updating}
        >
          View All Versions
        </Button>
      </Box>

      {/* Update History */}
      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        Update History
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>From Version</TableCell>
              <TableCell>To Version</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {updateHistory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No update history found
                </TableCell>
              </TableRow>
            ) : (
              updateHistory.map((update) => (
                <TableRow key={update.id}>
                  <TableCell>{new Date(update.started_at).toLocaleString()}</TableCell>
                  <TableCell>{update.version_from}</TableCell>
                  <TableCell>{update.version_to}</TableCell>
                  <TableCell>
                    <Chip
                      label={update.update_type}
                      color={getUpdateTypeColor(update.update_type)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={update.status}
                      color={getStatusColor(update.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDuration(update.duration_seconds)}</TableCell>
                  <TableCell>{update.user.username}</TableCell>
                  <TableCell>
                    {update.status === 'completed' && update.backup_file && (
                      <IconButton
                        size="small"
                        onClick={() => handleRollback(update.id)}
                        title="Rollback to this version"
                      >
                        <UndoIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* All Versions Dialog */}
      <Dialog
        open={openVersionDialog}
        onClose={() => setOpenVersionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Available Versions</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {updateInfo?.versions.map((version) => (
              <Box
                key={version}
                sx={{
                  p: 2,
                  mb: 1,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <Typography>{version}</Typography>
                <Box>
                  <Button
                    size="small"
                    onClick={() => loadChangelog(version)}
                  >
                    Changelog
                  </Button>
                  {version !== systemInfo?.current_version && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleUpdateClick(version)}
                      sx={{ ml: 1 }}
                    >
                      Install
                    </Button>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenVersionDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Changelog Dialog */}
      <Dialog
        open={openChangelogDialog}
        onClose={() => setOpenChangelogDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Changelog - {selectedVersion}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {changelog}
            </pre>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenChangelogDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Update Confirmation Dialog */}
      <Dialog
        open={openConfirmDialog}
        onClose={() => setOpenConfirmDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm System Update</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will update the system to version {selectedVersion}.
            A backup will be created automatically before the update.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            The update process includes:
          </Typography>
          <ul>
            <li>Create backup of current codebase</li>
            <li>Checkout version {selectedVersion} from Git</li>
            <li>Install dependencies</li>
            <li>Build backend and frontend</li>
            <li>Run database migrations</li>
            <li>Restart PM2 services</li>
          </ul>
          <Typography variant="body2" color="error">
            This process may take several minutes. Do not close this page during the update.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirmDialog(false)}>Cancel</Button>
          <Button onClick={executeUpdate} variant="contained" color="warning">
            Proceed with Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SystemUpdatesPage;
