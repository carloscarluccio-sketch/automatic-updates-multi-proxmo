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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid,
  FormControlLabel,
  Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import SecurityIcon from '@mui/icons-material/Security';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface OPNsenseInstance {
  id: number;
  name: string;
  hostname: string;
  company_id: number;
  project_id?: number;
  cluster_id: number;
  vm_id?: number;
  vmid: number;
  node: string;
  wan_ip?: string;
  lan_subnet: string;
  deployment_status: string;
  nat_enabled: boolean;
  dhcp_server_enabled: boolean;
  admin_password?: string;
  created_at: string;
  companies?: { id: number; name: string };
  proxmox_clusters?: { id: number; name: string; host: string };
  virtual_machines?: { id: number; name: string; status: string };
}

export const OPNsensePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<OPNsenseInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<OPNsenseInstance | null>(null);
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const instancesRes = await api.get('/opnsense');
      setInstances(instancesRes.data.data || []);
    } catch (error: any) {
      console.error('Failed to load OPNsense data:', error);
      showSnackbar(error.response?.data?.message || 'Failed to load OPNsense data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleViewDetails = (instance: OPNsenseInstance) => {
    setSelectedInstance(instance);
    setOpenDetailsDialog(true);
  };

  const handleCloseDetailsDialog = () => {
    setOpenDetailsDialog(false);
    setSelectedInstance(null);
  };

  const handleDeleteInstance = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this OPNsense instance? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/opnsense/${id}`);
      showSnackbar('OPNsense instance deleted successfully', 'success');
      await loadData();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to delete OPNsense instance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'deploying':
        return 'warning';
      case 'configuring':
        return 'info';
      case 'failed':
        return 'error';
      case 'stopped':
        return 'default';
      default:
        return 'default';
    }
  };

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              OPNsense Firewall Instances
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Manage OPNsense firewall deployments for network security and routing
            </Typography>
          </Box>
          <Box>
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadData}
              sx={{ mr: 1 }}
            >
              Refresh
            </Button>
            {user?.role === 'super_admin' && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setSnackbar({ open: true, message: 'OPNsense deployment is available through the VM creation workflow. Go to VMs > Create VM and select an OPNsense template.', severity: 'info' as 'success' | 'error' })}
              >
                Deploy OPNsense
              </Button>
            )}
          </Box>
        </Box>

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Instances
                </Typography>
                <Typography variant="h3">
                  {instances.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Active
                </Typography>
                <Typography variant="h3" color="success.main">
                  {instances.filter(i => i.deployment_status === 'active').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Deploying
                </Typography>
                <Typography variant="h3" color="warning.main">
                  {instances.filter(i => i.deployment_status === 'deploying').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Failed
                </Typography>
                <Typography variant="h3" color="error.main">
                  {instances.filter(i => i.deployment_status === 'failed').length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Instances Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Cluster</TableCell>
                <TableCell>Node / VMID</TableCell>
                <TableCell>WAN IP</TableCell>
                <TableCell>LAN Subnet</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Features</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {instances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Box sx={{ py: 4 }}>
                      <SecurityIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="body1" color="textSecondary">
                        No OPNsense instances found
                      </Typography>
                      {user?.role === 'super_admin' && (
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                          Click "Deploy OPNsense" to create your first firewall instance
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                instances.map((instance) => (
                  <TableRow key={instance.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {instance.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {instance.hostname}
                      </Typography>
                    </TableCell>
                    <TableCell>{instance.companies?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {instance.proxmox_clusters?.name || 'N/A'}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {instance.proxmox_clusters?.host || ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {instance.node} / {instance.vmid}
                    </TableCell>
                    <TableCell>{instance.wan_ip || 'DHCP'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {instance.lan_subnet}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={instance.deployment_status || 'Unknown'}
                        color={getStatusColor(instance.deployment_status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {instance.nat_enabled && (
                          <Tooltip title="NAT Enabled">
                            <Chip label="NAT" size="small" variant="outlined" />
                          </Tooltip>
                        )}
                        {instance.dhcp_server_enabled && (
                          <Tooltip title="DHCP Server Enabled">
                            <Chip label="DHCP" size="small" variant="outlined" />
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(instance)}
                        >
                          <InfoIcon />
                        </IconButton>
                      </Tooltip>
                      {user?.role === 'super_admin' && (
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteInstance(instance.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Details Dialog */}
        <Dialog
          open={openDetailsDialog}
          onClose={handleCloseDetailsDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon />
              OPNsense Instance Details
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedInstance && (
              <Box sx={{ pt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="textSecondary">
                      Instance Name
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedInstance.name}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="textSecondary">
                      Hostname
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedInstance.hostname}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="textSecondary">
                      Company
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedInstance.companies?.name || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="textSecondary">
                      Deployment Status
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={selectedInstance.deployment_status}
                        color={getStatusColor(selectedInstance.deployment_status)}
                        size="small"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                      Network Configuration
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="textSecondary">
                      WAN IP Address
                    </Typography>
                    <Typography variant="body1" gutterBottom sx={{ fontFamily: 'monospace' }}>
                      {selectedInstance.wan_ip || 'DHCP'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="textSecondary">
                      LAN Subnet
                    </Typography>
                    <Typography variant="body1" gutterBottom sx={{ fontFamily: 'monospace' }}>
                      {selectedInstance.lan_subnet}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                      Services
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={<Switch checked={selectedInstance.nat_enabled} disabled />}
                      label="NAT Enabled"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={<Switch checked={selectedInstance.dhcp_server_enabled} disabled />}
                      label="DHCP Server Enabled"
                    />
                  </Grid>
                  {selectedInstance.admin_password && (
                    <>
                      <Grid item xs={12}>
                        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                          Admin Credentials
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Alert severity="info">
                          <Typography variant="body2">
                            <strong>Username:</strong> root
                          </Typography>
                          <Typography variant="body2">
                            <strong>Password:</strong> {selectedInstance.admin_password}
                          </Typography>
                        </Alert>
                      </Grid>
                    </>
                  )}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDetailsDialog}>Close</Button>
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
