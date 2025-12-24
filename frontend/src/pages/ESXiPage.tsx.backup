import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  PlayArrow as TestIcon,
  Search as DiscoverIcon,
  CloudUpload as ImportIcon,
  Visibility as ViewIcon,
  VisibilityOff as VisibilityOffIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface Company {
  id: number;
  name: string;
}

interface ESXiHost {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  password_encrypted: string;
  company_id: number | null;
  status: 'active' | 'inactive' | 'error';
  last_tested: string | null;
  last_test_message: string | null;
  notes: string | null;
  created_at: string;
  companies?: { id: number; name: string };
}

interface DiscoveredVM {
  id: number;
  vm_name: string;
  vm_path: string;
  power_state: string;
  cpu_cores: number;
  memory_mb: number;
  disk_gb: number;
  guest_os: string;
  network_adapters: string;
  discovered_at: string;
}

interface Cluster {
  id: number;
  name: string;
  host: string;
}

const ESXiPage: React.FC = () => {
  const [hosts, setHosts] = useState<ESXiHost[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [user, setUser] = useState<any>(null);

  // Dialog states
  const [hostDialogOpen, setHostDialogOpen] = useState(false);
  const [discoverDialogOpen, setDiscoverDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedHost, setSelectedHost] = useState<ESXiHost | null>(null);
  const [discoveredVMs, setDiscoveredVMs] = useState<DiscoveredVM[]>([]);
  const [selectedVMs, setSelectedVMs] = useState<number[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 443,
    username: '',
    password: '',
    target_company_id: null as number | null,
    notes: '',
  });

  // Import form states
  const [importData, setImportData] = useState({
    target_cluster_id: null as number | null,
    target_node: '',
    target_storage: '',
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    loadHosts();
    loadCompanies();
    loadClusters();
  }, []);

  const loadHosts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/esxi-hosts');
      if (response.data.success) {
        setHosts(response.data.data || []);
      }
    } catch (error: any) {
      console.error('Failed to load ESXi hosts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      if (response.data.success) {
        setCompanies(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loadClusters = async () => {
    try {
      const response = await api.get('/clusters');
      if (response.data.success) {
        setClusters(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load clusters:', error);
    }
  };

  const handleOpenHostDialog = (host?: ESXiHost) => {
    if (host) {
      setSelectedHost(host);
      setFormData({
        name: host.name,
        host: host.host,
        port: host.port,
        username: host.username,
        password: '••••••••',
        target_company_id: host.company_id,
        notes: host.notes || '',
      });
    } else {
      setSelectedHost(null);
      setFormData({
        name: '',
        host: '',
        port: 443,
        username: '',
        password: '',
        target_company_id: null,
        notes: '',
      });
    }
    setHostDialogOpen(true);
  };

  const handleCloseHostDialog = () => {
    setHostDialogOpen(false);
    setSelectedHost(null);
    setShowPassword(false);
  };

  const handleSaveHost = async () => {
    try {
      setLoading(true);
      const payload: any = {
        name: formData.name,
        host: formData.host,
        port: formData.port,
        username: formData.username,
        notes: formData.notes,
      };

      // Only include password if it's not the masked value
      if (formData.password !== '••••••••') {
        payload.password = formData.password;
      }

      if (user?.role === 'super_admin') {
        payload.target_company_id = formData.target_company_id;
      }

      if (selectedHost) {
        await api.put(`/esxi-hosts/${selectedHost.id}`, payload);
      } else {
        await api.post('/esxi-hosts', payload);
      }

      loadHosts();
      handleCloseHostDialog();
    } catch (error: any) {
      console.error('Failed to save ESXi host:', error);
      alert(error.response?.data?.message || 'Failed to save ESXi host');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHost = async (host: ESXiHost) => {
    if (!confirm(`Delete ESXi host "${host.name}"?\n\nThis will also delete all discovered VMs for this host.`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/esxi-hosts/${host.id}`);
      loadHosts();
    } catch (error: any) {
      console.error('Failed to delete ESXi host:', error);
      alert(error.response?.data?.message || 'Failed to delete ESXi host');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (host: ESXiHost) => {
    try {
      setLoading(true);
      const response = await api.post(`/esxi-hosts/${host.id}/test`);
      if (response.data.success) {
        alert(`Connection test successful!\n\nStatus: ${response.data.data.status}`);
        loadHosts();
      }
    } catch (error: any) {
      console.error('Failed to test connection:', error);
      alert(error.response?.data?.message || 'Connection test failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverVMs = async (host: ESXiHost) => {
    try {
      setLoading(true);
      setSelectedHost(host);
      const response = await api.post(`/esxi-hosts/${host.id}/discover`);
      if (response.data.success) {
        setDiscoveredVMs(response.data.data.vms || []);
        setDiscoverDialogOpen(true);
      }
    } catch (error: any) {
      console.error('Failed to discover VMs:', error);
      alert(error.response?.data?.message || 'Failed to discover VMs');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDiscoveredVMs = async (host: ESXiHost) => {
    try {
      setLoading(true);
      setSelectedHost(host);
      const response = await api.get(`/esxi-hosts/${host.id}/discovered-vms`);
      if (response.data.success) {
        setDiscoveredVMs(response.data.data.vms || []);
        setDiscoverDialogOpen(true);
      }
    } catch (error: any) {
      console.error('Failed to load discovered VMs:', error);
      alert(error.response?.data?.message || 'Failed to load discovered VMs');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenImportDialog = () => {
    if (selectedVMs.length === 0) {
      alert('Please select VMs to import');
      return;
    }
    setDiscoverDialogOpen(false);
    setImportDialogOpen(true);
  };

  const handleImportVMs = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/esxi-hosts/${selectedHost?.id}/import`, {
        vm_ids: selectedVMs,
        target_cluster_id: importData.target_cluster_id,
        target_node: importData.target_node,
        target_storage: importData.target_storage,
      });
      if (response.data.success) {
        alert(`Import initiated for ${selectedVMs.length} VMs\n\nStatus: ${response.data.data.status}`);
        setImportDialogOpen(false);
        setSelectedVMs([]);
        setImportData({
          target_cluster_id: null,
          target_node: '',
          target_storage: '',
        });
      }
    } catch (error: any) {
      console.error('Failed to import VMs:', error);
      alert(error.response?.data?.message || 'Failed to import VMs');
    } finally {
      setLoading(false);
    }
  };

  const toggleVMSelection = (vmId: number) => {
    setSelectedVMs((prev) =>
      prev.includes(vmId) ? prev.filter((id) => id !== vmId) : [...prev, vmId]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">ESXi Import & Discovery</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadHosts}
            sx={{ mr: 2 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenHostDialog()}
          >
            Add ESXi Host
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Paper>
        <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
          <Tab label="ESXi Hosts" />
          <Tab label="Import Wizard" />
        </Tabs>

        {currentTab === 0 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Host</TableCell>
                  <TableCell>Port</TableCell>
                  <TableCell>Username</TableCell>
                  {user?.role === 'super_admin' && <TableCell>Company</TableCell>}
                  <TableCell>Status</TableCell>
                  <TableCell>Last Tested</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {hosts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={user?.role === 'super_admin' ? 8 : 7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No ESXi hosts configured. Click "Add ESXi Host" to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  hosts.map((host) => (
                    <TableRow key={host.id}>
                      <TableCell>{host.name}</TableCell>
                      <TableCell>{host.host}</TableCell>
                      <TableCell>{host.port}</TableCell>
                      <TableCell>{host.username}</TableCell>
                      {user?.role === 'super_admin' && (
                        <TableCell>{host.companies?.name || 'Global'}</TableCell>
                      )}
                      <TableCell>
                        <Chip
                          label={host.status}
                          color={getStatusColor(host.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {host.last_tested
                          ? new Date(host.last_tested).toLocaleString()
                          : 'Never'}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Test Connection">
                          <IconButton
                            size="small"
                            onClick={() => handleTestConnection(host)}
                            color="primary"
                          >
                            <TestIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Discover VMs">
                          <IconButton
                            size="small"
                            onClick={() => handleDiscoverVMs(host)}
                            color="secondary"
                          >
                            <DiscoverIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Discovered VMs">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDiscoveredVMs(host)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenHostDialog(host)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteHost(host)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {currentTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Import Wizard
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              The Import Wizard will be available after VMware vSphere library integration.
              <br />
              Steps: 1. Discover VMs → 2. Select VMs → 3. Choose Target Cluster → 4. Import
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Add/Edit Host Dialog */}
      <Dialog open={hostDialogOpen} onClose={handleCloseHostDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedHost ? 'Edit ESXi Host' : 'Add ESXi Host'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Host Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                label="Host/IP Address"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Port"
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!selectedHost}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOffIcon /> : <ViewIcon />}
                    </IconButton>
                  ),
                }}
                helperText={selectedHost ? 'Leave as ••••••••  to keep current password' : ''}
              />
            </Grid>
            {user?.role === 'super_admin' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Company (Optional)</InputLabel>
                  <Select
                    value={formData.target_company_id || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, target_company_id: e.target.value as number })
                    }
                  >
                    <MenuItem value="">Global (No Company)</MenuItem>
                    {companies.map((company) => (
                      <MenuItem key={company.id} value={company.id}>
                        {company.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Assign to company or leave global for all companies</FormHelperText>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHostDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveHost}
            disabled={!formData.name || !formData.host || !formData.username || (!selectedHost && !formData.password)}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Discovered VMs Dialog */}
      <Dialog open={discoverDialogOpen} onClose={() => setDiscoverDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Discovered VMs - {selectedHost?.name}
          <Typography variant="caption" display="block" color="text.secondary">
            {discoveredVMs.length} VMs found
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"></TableCell>
                  <TableCell>VM Name</TableCell>
                  <TableCell>Power State</TableCell>
                  <TableCell align="center">CPU</TableCell>
                  <TableCell align="center">Memory (GB)</TableCell>
                  <TableCell align="center">Disk (GB)</TableCell>
                  <TableCell>Guest OS</TableCell>
                  <TableCell>Discovered</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {discoveredVMs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                        No VMs discovered yet. Click "Discover VMs" to scan this ESXi host.
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          Note: VM discovery requires VMware vSphere library integration.
                        </Typography>
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  discoveredVMs.map((vm) => (
                    <TableRow key={vm.id} hover>
                      <TableCell padding="checkbox">
                        <IconButton
                          size="small"
                          onClick={() => toggleVMSelection(vm.id)}
                          color={selectedVMs.includes(vm.id) ? 'primary' : 'default'}
                        >
                          {selectedVMs.includes(vm.id) ? <CheckIcon /> : <CloseIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>{vm.vm_name}</TableCell>
                      <TableCell>
                        <Chip label={vm.power_state} size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <MemoryIcon fontSize="small" />
                          {vm.cpu_cores}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <StorageIcon fontSize="small" />
                          {(vm.memory_mb / 1024).toFixed(1)}
                        </Box>
                      </TableCell>
                      <TableCell align="center">{vm.disk_gb}</TableCell>
                      <TableCell>{vm.guest_os}</TableCell>
                      <TableCell>{new Date(vm.discovered_at).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Typography variant="body2" sx={{ mr: 'auto', ml: 2 }}>
            {selectedVMs.length} VMs selected
          </Typography>
          <Button onClick={() => setDiscoverDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<ImportIcon />}
            onClick={handleOpenImportDialog}
            disabled={selectedVMs.length === 0}
          >
            Import Selected VMs
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import VMs Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import VMs to Proxmox</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph sx={{ mt: 2 }}>
            Importing {selectedVMs.length} VMs from {selectedHost?.name}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Target Cluster</InputLabel>
                <Select
                  value={importData.target_cluster_id || ''}
                  onChange={(e) =>
                    setImportData({ ...importData, target_cluster_id: e.target.value as number })
                  }
                >
                  {clusters.map((cluster) => (
                    <MenuItem key={cluster.id} value={cluster.id}>
                      {cluster.name} ({cluster.host})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Target Node"
                value={importData.target_node}
                onChange={(e) => setImportData({ ...importData, target_node: e.target.value })}
                required
                helperText="Proxmox node name (e.g., pve1)"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Target Storage"
                value={importData.target_storage}
                onChange={(e) => setImportData({ ...importData, target_storage: e.target.value })}
                required
                helperText="Proxmox storage name (e.g., local-lvm)"
              />
            </Grid>
          </Grid>
          <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 2 }}>
            Note: VM import requires VMware vSphere library integration and will be available in a future update.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleImportVMs}
            disabled={!importData.target_cluster_id || !importData.target_node || !importData.target_storage}
          >
            Start Import
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ESXiPage;
