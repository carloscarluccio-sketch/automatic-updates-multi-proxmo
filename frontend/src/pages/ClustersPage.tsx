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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Chip,
  Card,
  CardContent,
  Grid,
  LinearProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import { DataTable, Column } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface Cluster {
  id: number;
  name: string;
  location: string | null;
  host: string;
  port: number | null;
  username: string;
  realm: string | null;
  ssl_verify: boolean | null;
  status: string | null;
  company_id: number | null;
  cluster_type: string | null;
  nat_ready: boolean | null;
  proxmox_version: string | null;
  proxmox_release: string | null;
  version_last_checked: string | null;
  created_at: string;
  updated_at: string;
}

interface SSHKeyHealth {
  keysGenerated: boolean;
  fingerprint?: string;
  keyAge?: {
    days: number;
    generatedAt: string;
    lastRotatedAt: string | null;
    rotationCount: number;
  };
  expiration?: {
    expiresAt: string | null;
    daysUntilExpiration: number | null;
    hasExpiration: boolean;
    isExpired: boolean;
  };
  clusters?: {
    total: number;
    configured: number;
    working: number;
    notConfigured: number;
    configurationRate: number;
  };
  health?: {
    status: 'excellent' | 'good' | 'warning' | 'critical';
    warnings: string[];
  };
  lastUsed?: string | null;
}

interface ClusterFormData {
  name: string;
  location?: string;
  host: string;
  port?: number;
  username: string;
  password: string;
  realm?: string;
  ssl_verify?: boolean;
  status?: string;
  cluster_type?: string;
  company_id?: number;
}

interface SSHKeyHealth {
  keysGenerated: boolean;
  fingerprint?: string;
  keyAge?: {
    days: number;
    generatedAt: string;
    lastRotatedAt: string | null;
    rotationCount: number;
  };
  expiration?: {
    expiresAt: string | null;
    daysUntilExpiration: number | null;
    hasExpiration: boolean;
    isExpired: boolean;
  };
  clusters?: {
    total: number;
    configured: number;
    working: number;
    notConfigured: number;
    configurationRate: number;
  };
  health?: {
    status: 'excellent' | 'good' | 'warning' | 'critical';
    warnings: string[];
  };
  lastUsed?: string | null;
}

export const ClustersPage: React.FC = () => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCluster, setEditingCluster] = useState<Cluster | null>(null);
  const [formData, setFormData] = useState<ClusterFormData>({
    name: '',
    location: '',
    host: '',
    port: 8006,
    username: 'root@pam',
    password: '',
    realm: 'pam',
    ssl_verify: false,
    status: 'active',
    cluster_type: 'shared',
  });
  const [versionCache, setVersionCache] = useState<{[key: number]: string}>({});
  const [fetchingVersion, setFetchingVersion] = useState<number | null>(null);
  const [testingConnection, setTestingConnection] = useState<number | null>(null);
  const [sshKeyStatuses, setSSHKeyStatuses] = useState<{[key: number]: any}>({});
  const [pushingSSHKey, setPushingSSHKey] = useState<number | null>(null);
  const [pushingBulk, setPushingBulk] = useState(false);
  const [rotatingKeys, setRotatingKeys] = useState(false);
  const [sshKeyHealth, setSSHKeyHealth] = useState<SSHKeyHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [expirationDialog, setExpirationDialog] = useState({
    open: false,
    expirationDays: 90
  });
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadClusters();
  }, []);
  useEffect(() => {    if (currentUser?.role === 'super_admin') {      loadSSHKeyHealth();    }  }, [currentUser]);

  const loadClusters = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clusters');
      const clustersList = response.data.data || [];
      setClusters(clustersList);
      // Load SSH key status for each cluster
      clustersList.forEach((cluster: Cluster) => {
        checkSSHKeyStatus(cluster.id);
      });

      // Load SSH Key Health Dashboard
      await loadSSHKeyHealth();
    } catch (error) {
      showSnackbar('Failed to load clusters', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersion = async (clusterId: number) => {
    try {
      setFetchingVersion(clusterId);
      const response = await api.get(`/clusters?include_version=true&cluster_id=${clusterId}`);
      const cluster = response.data.data[0];
      if (cluster && cluster.proxmox_version) {
        setVersionCache(prev => ({ ...prev, [clusterId]: cluster.proxmox_version }));
        setClusters(prev => prev.map(c =>
          c.id === clusterId
            ? { ...c, proxmox_version: cluster.proxmox_version, proxmox_release: cluster.proxmox_release }
            : c
        ));
        showSnackbar('Version fetched successfully', 'success');
      }
    } catch (error) {
      showSnackbar('Failed to fetch version', 'error');
    } finally {
      setFetchingVersion(null);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (cluster?: Cluster) => {
    if (cluster) {
      setEditingCluster(cluster);
      setFormData({
        name: cluster.name,
        location: cluster.location || '',
        host: cluster.host,
        port: cluster.port || 8006,
        username: cluster.username,
        password: '',
        realm: cluster.realm || 'pam',
        ssl_verify: cluster.ssl_verify || false,
        status: cluster.status || 'active',
        cluster_type: cluster.cluster_type || 'shared',
      });
    } else {
      setEditingCluster(null);
      setFormData({
        name: '',
        location: '',
        host: '',
        port: 8006,
        username: 'root@pam',
        password: '',
        realm: 'pam',
        ssl_verify: false,
        status: 'active',
        cluster_type: 'shared',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCluster(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingCluster) {
        await api.put(`/clusters/${editingCluster.id}`, formData);
        showSnackbar('Cluster updated successfully', 'success');
      } else {
        await api.post('/clusters', formData);
        showSnackbar('Cluster created successfully', 'success');
      }
      handleCloseDialog();
      await loadClusters();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (cluster: Cluster) => {
    if (!window.confirm(`Are you sure you want to delete cluster "${cluster.name}"?`)) {
      return;
    }

    try {
      await api.delete(`/clusters/${cluster.id}`);
      showSnackbar('Cluster deleted successfully', 'success');
      await loadClusters();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to delete cluster', 'error');
    }
  };

  const testConnection = async (clusterId: number) => {
    try {
      setTestingConnection(clusterId);
      const response = await api.post(`/clusters/${clusterId}/test-connection`);
      if (response.data.success) {
        const { version, node_count } = response.data.data;
        showSnackbar(`Connection successful! Version: ${version}, Nodes: ${node_count}`, 'success');
        // Update cluster in list with new status and version
        setClusters(prev => prev.map(c =>
          c.id === clusterId
            ? { ...c, status: 'active', proxmox_version: version }
            : c
        ));
        setVersionCache(prev => ({ ...prev, [clusterId]: version }));
      }
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Connection test failed', 'error');
    } finally {
      setTestingConnection(null);
    }
  };

  const checkSSHKeyStatus = async (clusterId: number) => {
    try {
      const response = await api.get(`/clusters/${clusterId}/ssh-key-status`);
      if (response.data.success) {
        setSSHKeyStatuses(prev => ({ ...prev, [clusterId]: response.data.data }));
      }
    } catch (error) {
      console.error(`Failed to check SSH key status for cluster ${clusterId}:`, error);
    }
  };

  const pushSSHKey = async (clusterId: number, clusterName: string) => {
    if (!window.confirm(`Push SSH public key to "${clusterName}"?\n\nThis will:\n- Connect to Proxmox via SSH using password\n- Add the backend's SSH public key to authorized_keys\n- Enable password-less SSH authentication\n\nNote: Requires correct password in cluster configuration.`)) {
      return;
    }

    try {
      setPushingSSHKey(clusterId);
      const response = await api.post(`/clusters/${clusterId}/push-ssh-key`);
      if (response.data.success) {
        showSnackbar(`✅ SSH key pushed successfully! Auth method: ${response.data.data.authMethod}`, 'success');
        // Refresh SSH key status
        setTimeout(() => checkSSHKeyStatus(clusterId), 2000);
      }
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to push SSH key', 'error');
    } finally {
      setPushingSSHKey(null);
    }
  };

  const getSSHKeyStatusChip = (clusterId: number) => {
    const status = sshKeyStatuses[clusterId];
    if (!status) {
      return <Chip label="Checking..." size="small" color="default" />;
    }

    if (status.keyAuthWorking) {
      return <Chip label="✅ Working" size="small" color="success" />;
    } else if (status.keysGenerated) {
      return <Chip label="⚠️ Not Configured" size="small" color="warning" />;
    } else {
      return <Chip label="❌ Not Generated" size="small" color="error" />;
    }
  };

  const getSSHKeyStats = () => {
    let working = 0;
    let notConfigured = 0;
    let notGenerated = 0;

    clusters.forEach(cluster => {
      const status = sshKeyStatuses[cluster.id];
      if (status) {
        if (status.keyAuthWorking) {
          working++;
        } else if (status.keysGenerated) {
          notConfigured++;
        } else {
          notGenerated++;
        }
      }
    });

    return { working, notConfigured, notGenerated, total: clusters.length };
  };

  const pushSSHKeyToAll = async () => {
    const stats = getSSHKeyStats();

    if (stats.notConfigured === 0) {
      showSnackbar('No clusters need SSH key configuration', 'success');
      return;
    }

    if (!window.confirm(`Push SSH keys to ${stats.notConfigured} unconfigured cluster(s)?\n\nThis will:\n- Connect to each Proxmox cluster via SSH\n- Add the backend's SSH public key\n- Enable password-less authentication\n\nThis may take a few minutes.`)) {
      return;
    }

    setPushingBulk(true);
    let successCount = 0;
    let failCount = 0;

    for (const cluster of clusters) {
      const status = sshKeyStatuses[cluster.id];
      if (status && !status.keyAuthWorking && status.keysGenerated) {
        try {
          const response = await api.post(`/clusters/${cluster.id}/push-ssh-key`);
          if (response.data.success) {
            successCount++;
            // Refresh status
            await checkSSHKeyStatus(cluster.id);
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }
    }

    setPushingBulk(false);

    if (failCount === 0) {
      showSnackbar(`✅ Successfully pushed SSH keys to all ${successCount} clusters!`, 'success');
    } else {
      showSnackbar(`⚠️ Pushed to ${successCount} clusters, ${failCount} failed. Check individual cluster statuses.`, 'error');
    }
  };

  const rotateSSHKeys = async () => {
    if (!window.confirm(`⚠️ ROTATE SSH KEYS - WARNING ⚠️\n\nThis will:\n1. Generate NEW SSH keys on the backend\n2. Backup existing keys to /root/.ssh/id_rsa.backup\n3. Push new keys to ALL active clusters\n4. Old keys will no longer work\n\nThis operation may take several minutes.\n\nAre you sure you want to proceed?`)) {
      return;
    }

    setRotatingKeys(true);

    try {
      const response = await api.post('/clusters/rotate-ssh-keys');
      if (response.data.success) {
        const data = response.data.data;
        showSnackbar(
          `✅ SSH keys rotated successfully!\n\n` +
          `New Fingerprint: ${data.newFingerprint}\n` +
          `Pushed to: ${data.successCount}/${data.totalClusters} clusters\n` +
          `Backup saved to: ${data.backupKeyPath}`,
          'success'
        );

        // Refresh all SSH key statuses
        clusters.forEach(cluster => checkSSHKeyStatus(cluster.id));
      } else {
        showSnackbar(`❌ Failed to rotate SSH keys: ${response.data.message}`, 'error');
      }
    } catch (error: any) {
      showSnackbar(`❌ Failed to rotate SSH keys: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setRotatingKeys(false);
    }
  };

  const loadSSHKeyHealth = async () => {
    if (currentUser?.role !== 'super_admin') return;
    try {
      setLoadingHealth(true);
      const response = await api.get('/clusters/ssh-keys/health');
      if (response.data.success) {
        setSSHKeyHealth(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to load SSH key health:', error);
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleSetExpiration = async () => {
    try {
      const response = await api.post('/clusters/ssh-keys/set-expiration', {
        expirationDays: expirationDialog.expirationDays
      });
      if (response.data.success) {
        showSnackbar(`SSH key expiration set to ${expirationDialog.expirationDays} days`, 'success');
        setExpirationDialog({ ...expirationDialog, open: false });
        await loadSSHKeyHealth();
      }
    } catch (error: any) {
      showSnackbar(`Failed to set expiration: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'default';
    }
  };


  const getStatusChip = (status: string | null) => {
    const statusColors: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
      active: 'success',
      maintenance: 'warning',
      offline: 'error',
    };
    return (
      <Chip
        label={status || 'unknown'}
        color={statusColors[status || ''] || 'default'}
        size="small"
      />
    );
  };

  const columns: Column[] = [
    { id: 'name', label: 'Name', minWidth: 150 },
    { id: 'location', label: 'Location', minWidth: 120, format: (value) => (value as string) || 'N/A' },
    { id: 'host', label: 'Host', minWidth: 150 },
    {
      id: 'proxmox_version',
      label: 'Version',
      minWidth: 150,
      format: (_value, row: any) => {
        const cachedVersion = versionCache[row.id] || row.proxmox_version;
        if (cachedVersion) {
          return cachedVersion as string;
        }
        return (
          <Button
            size="small"
            onClick={() => fetchVersion(row.id)}
            disabled={fetchingVersion === row.id}
            startIcon={fetchingVersion === row.id ? <CircularProgress size={16} /> : <RefreshIcon />}
          >
            Fetch Version
          </Button>
        );
      },
    },
    {
      id: 'status',
      label: 'Status',
      minWidth: 100,
      format: (value) => getStatusChip(value as string),
    },
    {
      id: 'cluster_type',
      label: 'Type',
      minWidth: 100,
      format: (value) => (value as string) || 'shared',
    },
    {
      id: 'ssh_key_status',
      label: 'SSH Key Auth',
      minWidth: 150,
      format: (_value, row: any) => getSSHKeyStatusChip(row.id),
    },
  ];

  if (currentUser?.role === 'super_admin') {
    columns.push({
      id: 'actions',
      label: 'Actions',
      minWidth: 250,
      format: (_value, row: any) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Test Connection">
            <IconButton
              size="small"
              color="success"
              onClick={() => testConnection(row.id)}
              disabled={testingConnection === row.id}
            >
              {testingConnection === row.id ? (
                <CircularProgress size={16} />
              ) : (
                <CheckCircleIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenDialog(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {sshKeyStatuses[row.id] && !sshKeyStatuses[row.id].keyAuthWorking && sshKeyStatuses[row.id].keysGenerated && (
            <Tooltip title="Push SSH Key">
              <IconButton
                size="small"
                color="warning"
                onClick={() => pushSSHKey(row.id, row.name)}
                disabled={pushingSSHKey === row.id}
              >
                {pushingSSHKey === row.id ? (
                  <CircularProgress size={16} />
                ) : (
                  <VpnKeyIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    });
  }

  if (loading) {
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
          <Typography variant="h4">Proxmox Clusters</Typography>
          {currentUser?.role === 'super_admin' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Cluster
            </Button>
          )}
        </Box>

        {/* SSH Key Status Dashboard */}
        {currentUser?.role === 'super_admin' && (
          <Card sx={{ mb: 3, bgcolor: '#f5f5f5' }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <Typography variant="h6" gutterBottom>
                    📊 SSH Key Status Overview
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">Total Clusters</Typography>
                      <Typography variant="h5">{getSSHKeyStats().total}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="success.main">Configured</Typography>
                      <Typography variant="h5" color="success.main">
                        ✅ {getSSHKeyStats().working}
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="warning.main">Need Configuration</Typography>
                      <Typography variant="h5" color="warning.main">
                        ⚠️ {getSSHKeyStats().notConfigured}
                      </Typography>
                    </Grid>
                  </Grid>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {getSSHKeyStats().notConfigured > 0 && (
                      <Button
                        variant="contained"
                        color="warning"
                        fullWidth
                        size="large"
                        startIcon={pushingBulk ? <CircularProgress size={20} color="inherit" /> : <VpnKeyIcon />}
                        onClick={pushSSHKeyToAll}
                        disabled={pushingBulk || rotatingKeys}
                      >
                        {pushingBulk ? 'Pushing Keys...' : 'Push to All Unconfigured'}
                      </Button>
                    )}
                    <Button
                      variant="outlined"
                      color="error"
                      fullWidth
                      size="medium"
                      startIcon={rotatingKeys ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                      onClick={rotateSSHKeys}
                      disabled={rotatingKeys || pushingBulk}
                    >
                      {rotatingKeys ? 'Rotating Keys...' : '🔄 Rotate SSH Keys'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

        )}
        {/* SSH Key Health Monitoring Dashboard */}
        {currentUser?.role === 'super_admin' && (
          <Card sx={{ mb: 3, bgcolor: '#fff', border: '1px solid #e0e0e0' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HealthAndSafetyIcon /> SSH Key Health Monitoring
                </Typography>
                <Button size="small" startIcon={<RefreshIcon />} onClick={loadSSHKeyHealth} disabled={loadingHealth}>
                  Refresh
                </Button>
              </Box>

              {loadingHealth ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress />
                </Box>
              ) : sshKeyHealth && sshKeyHealth.keysGenerated ? (
                <Grid container spacing={3}>
                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Overall Health</Typography>
                    <Chip
                      label={sshKeyHealth.health?.status?.toUpperCase() || 'UNKNOWN'}
                      color={getHealthStatusColor(sshKeyHealth.health?.status || 'good') as any}
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Key Age</Typography>
                    <Typography variant="h6">{sshKeyHealth.keyAge?.days || 0} days</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Rotation Count: {sshKeyHealth.keyAge?.rotationCount || 0}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Expiration</Typography>
                    {sshKeyHealth.expiration?.hasExpiration ? (
                      <Box>
                        <Typography variant="h6" color={sshKeyHealth.expiration.daysUntilExpiration! < 30 ? 'warning.main' : 'text.primary'}>
                          {sshKeyHealth.expiration.daysUntilExpiration} days
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(sshKeyHealth.expiration.expiresAt!).toLocaleDateString()}
                        </Typography>
                      </Box>
                    ) : (
                      <Box>
                        <Typography variant="body2" color="text.secondary">Not Set</Typography>
                        <Button size="small" variant="outlined" onClick={() => setExpirationDialog({ ...expirationDialog, open: true })} sx={{ mt: 0.5 }}>
                          Set Expiration
                        </Button>
                      </Box>
                    )}
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>Cluster Coverage</Typography>
                    <Typography variant="h6">{sshKeyHealth.clusters?.working || 0}/{sshKeyHealth.clusters?.total || 0}</Typography>
                    <LinearProgress variant="determinate" value={sshKeyHealth.clusters?.configurationRate || 0}
                      sx={{ mt: 1, height: 8, borderRadius: 4 }}
                      color={(sshKeyHealth.clusters?.configurationRate || 0) === 100 ? 'success' : 'warning'}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {sshKeyHealth.clusters?.configurationRate.toFixed(0)}% configured
                    </Typography>
                  </Grid>

                  {sshKeyHealth.health?.warnings && sshKeyHealth.health.warnings.length > 0 && (
                    <Grid item xs={12}>
                      <Alert severity="warning">
                        <Typography variant="body2" fontWeight="bold" gutterBottom>Attention Required:</Typography>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {sshKeyHealth.health.warnings.map((warning, index) => (
                            <li key={index}><Typography variant="body2">{warning}</Typography></li>
                          ))}
                        </ul>
                      </Alert>
                    </Grid>
                  )}

                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Fingerprint: {sshKeyHealth.fingerprint}</Typography>
                  </Grid>
                </Grid>
              ) : (
                <Alert severity="warning">SSH keys not generated on backend. Please generate keys first.</Alert>
              )}
            </CardContent>
          </Card>
        )}


        <Alert severity="info" sx={{ mb: 3 }}>
          Found {clusters.length} Proxmox clusters. Click "Fetch Version" to get cluster version information.
        </Alert>

        <DataTable
          columns={columns}
          rows={clusters}
          emptyMessage="No clusters found"
        />

        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{editingCluster ? 'Edit Cluster' : 'Add Cluster'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                fullWidth
              />
              <TextField
                label="Host"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                required
                fullWidth
                placeholder="192.168.1.100"
              />
              <TextField
                label="Port"
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                fullWidth
              />
              <TextField
                label="Username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                fullWidth
                placeholder="root@pam"
              />
              <TextField
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingCluster}
                fullWidth
                helperText={editingCluster ? 'Leave blank to keep current password' : ''}
              />
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                  <MenuItem value="offline">Offline</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Cluster Type</InputLabel>
                <Select
                  value={formData.cluster_type}
                  onChange={(e) => setFormData({ ...formData, cluster_type: e.target.value })}
                  label="Cluster Type"
                >
                  <MenuItem value="shared">Shared</MenuItem>
                  <MenuItem value="dedicated">Dedicated</MenuItem>
                  <MenuItem value="dr_only">DR Only</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              {editingCluster ? 'Update' : 'Create'}
            </Button>
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
    

      {/* Set Expiration Dialog */}
      <Dialog open={expirationDialog.open} onClose={() => setExpirationDialog({ ...expirationDialog, open: false })} maxWidth="sm" fullWidth>
        <DialogTitle>Set SSH Key Expiration</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Set an expiration date for the SSH keys. You will receive warnings 30 days before expiration.
          </Typography>
          <TextField
            label="Expiration (days from now)"
            type="number"
            fullWidth
            value={expirationDialog.expirationDays}
            onChange={(e) => setExpirationDialog({ ...expirationDialog, expirationDays: parseInt(e.target.value) || 90 })}
            inputProps={{ min: 1, max: 365 }}
            helperText="Recommended: 90 days"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExpirationDialog({ ...expirationDialog, open: false })}>Cancel</Button>
          <Button onClick={handleSetExpiration} variant="contained" color="primary">Set Expiration</Button>
        </DialogActions>
      </Dialog>

      </Container>
  );
};
