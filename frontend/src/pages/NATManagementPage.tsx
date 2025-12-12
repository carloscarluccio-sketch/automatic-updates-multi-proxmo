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
  Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import { DataTable, Column } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface NATRule {
  id: number;
  company_id: number;
  cluster_id: number;
  vm_id: number | null;
  nat_type: string;
  rule_name: string;
  external_ip: string;
  external_port: number | null;
  internal_ip: string;
  internal_port: number | null;
  protocol: string;
  status: string;
  enabled: boolean;
  description: string | null;
  created_at: string;
  virtual_machines?: {
    id: number;
    name: string;
    vmid: number;
  } | null;
  companies?: {
    id: number;
    name: string;
  };
}

export const NATManagementPage: React.FC = () => {
  const [rules, setRules] = useState<NATRule[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [vms, setVMs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<NATRule | null>(null);
  const [formData, setFormData] = useState({
    cluster_id: '',
    vm_id: '',
    rule_name: '',
    external_ip: '',
    external_port: '',
    internal_ip: '',
    internal_port: '',
    protocol: 'tcp',
    nat_type: 'port_forward',
    description: '',
    enabled: true,
  });
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadRules(), loadClusters(), loadVMs()]);
    } catch (error) {
      showSnackbar('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    try {
      const response = await api.get('/nat');
      setRules(response.data.data || []);
    } catch (error) {
      console.error('Failed to load NAT rules:', error);
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

  const loadVMs = async () => {
    try {
      const response = await api.get('/vms');
      setVMs(response.data.data || []);
    } catch (error) {
      console.error('Failed to load VMs:', error);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (rule?: NATRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        cluster_id: rule.cluster_id.toString(),
        vm_id: rule.vm_id ? rule.vm_id.toString() : '',
        rule_name: rule.rule_name,
        external_ip: rule.external_ip,
        external_port: rule.external_port ? rule.external_port.toString() : '',
        internal_ip: rule.internal_ip,
        internal_port: rule.internal_port ? rule.internal_port.toString() : '',
        protocol: rule.protocol,
        nat_type: rule.nat_type,
        description: rule.description || '',
        enabled: rule.enabled,
      });
    } else {
      setEditingRule(null);
      setFormData({
        cluster_id: '',
        vm_id: '',
        rule_name: '',
        external_ip: '',
        external_port: '',
        internal_ip: '',
        internal_port: '',
        protocol: 'tcp',
        nat_type: 'port_forward',
        description: '',
        enabled: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRule(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const submitData: any = {
        cluster_id: parseInt(formData.cluster_id),
        rule_name: formData.rule_name,
        external_ip: formData.external_ip,
        internal_ip: formData.internal_ip,
        protocol: formData.protocol,
        nat_type: formData.nat_type,
        description: formData.description || null,
        enabled: formData.enabled,
      };

      if (formData.vm_id) {
        submitData.vm_id = parseInt(formData.vm_id);
      }

      if (formData.external_port) {
        submitData.external_port = parseInt(formData.external_port);
      }

      if (formData.internal_port) {
        submitData.internal_port = parseInt(formData.internal_port);
      }

      if (editingRule) {
        await api.put(`/nat/${editingRule.id}`, submitData);
        showSnackbar('NAT rule updated successfully', 'success');
      } else {
        await api.post('/nat', submitData);
        showSnackbar('NAT rule created successfully', 'success');
      }
      handleCloseDialog();
      await loadRules();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (rule: NATRule) => {
    if (!window.confirm(`Are you sure you want to delete NAT rule "${rule.rule_name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/nat/${rule.id}`);
      showSnackbar('NAT rule deleted successfully', 'success');
      await loadRules();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to delete NAT rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (rule: NATRule) => {
    try {
      await api.post(`/nat/${rule.id}/toggle`);
      showSnackbar(`NAT rule ${rule.enabled ? 'disabled' : 'enabled'} successfully`, 'success');
      await loadRules();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to toggle NAT rule', 'error');
    }
  };

  const handleDeploy = async (rule: NATRule) => {
    try {
      setLoading(true);
      await api.post(`/nat/${rule.id}/deploy`);
      showSnackbar('NAT rule deployed successfully', 'success');
      await loadRules();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to deploy NAT rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUndeploy = async (rule: NATRule) => {
    try {
      setLoading(true);
      await api.post(`/nat/${rule.id}/undeploy`);
      showSnackbar('NAT rule undeployed successfully', 'success');
      await loadRules();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to undeploy NAT rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (rule: NATRule) => {
    try {
      setLoading(true);
      const response = await api.post(`/nat/${rule.id}/test-connection`);
      showSnackbar(response.data.message, 'success');
      
      // Show output in console for debugging
      if (response.data.data?.output) {
        console.log('Connection Test Output:', response.data.data.output);
      }
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to test connection', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (rule: NATRule) => {
    try {
      setLoading(true);
      const response = await api.post(`/nat/${rule.id}/verify`);
      
      if (response.data.success) {
        showSnackbar(`${response.data.message} (${response.data.data.executionTimeMs}ms)`, 'success');
        
        // Show iptables output in console
        if (response.data.data?.output) {
          console.log('Verification Output:', response.data.data.output);
        }
      } else {
        showSnackbar(response.data.message, 'error');
      }
      
      await loadRules();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to verify deployment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const columns: Column[] = [
    { id: 'rule_name', label: 'Rule Name', minWidth: 150 },
    {
      id: 'external_ip',
      label: 'External',
      minWidth: 180,
      format: (_value, row: any) => `${row.external_ip}${row.external_port ? ':' + row.external_port : ''} (${row.protocol?.toUpperCase()})`
    },
    {
      id: 'internal_ip',
      label: 'Internal',
      minWidth: 180,
      format: (_value, row: any) => `${row.internal_ip}${row.internal_port ? ':' + row.internal_port : ''}`
    },
    {
      id: 'virtual_machines',
      label: 'VM',
      minWidth: 150,
      format: (value: any) => value ? `${value.name} (${value.vmid})` : 'N/A'
    },
    {
      id: 'status',
      label: 'Status',
      minWidth: 100,
      format: (value) => (
        <Chip
          label={value || 'pending'}
          color={value === 'active' ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      id: 'enabled',
      label: 'Enabled',
      minWidth: 100,
      format: (value) => (
        <Chip
          label={value ? 'Yes' : 'No'}
          color={value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
  ];

  if (currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin') {
    columns.push({
      id: 'actions',
      label: 'Actions',
      minWidth: 180,
      format: (_value, row: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {row.status === 'pending' && (
            <Tooltip title="Deploy">
              <IconButton size="small" color="primary" onClick={() => handleDeploy(row)}>
                <PlayArrowIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {row.status === 'active' && (
            <>
              <Tooltip title="Verify Deployment">
                <IconButton size="small" color="success" onClick={() => handleVerify(row)}>
                  <CheckCircleIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Undeploy">
                <IconButton size="small" color="warning" onClick={() => handleUndeploy(row)}>
                  <StopIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="Test Connection">
            <IconButton size="small" color="info" onClick={() => handleTestConnection(row)}>
              <NetworkCheckIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={row.enabled ? 'Disable' : 'Enable'}>
            <IconButton size="small" onClick={() => handleToggle(row)}>
              {row.enabled ? <ToggleOnIcon fontSize="small" color="success" /> : <ToggleOffIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenDialog(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    });
  }

  if (loading && rules.length === 0) {
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
              NAT Management
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Manage Network Address Translation rules and port forwarding
            </Typography>
          </Box>
          {(currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin') && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} disabled={loading}>
              Create NAT Rule
            </Button>
          )}
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Found {rules.length} NAT rules. Manage port forwarding and network address translation for your VMs.
        </Alert>

        <DataTable columns={columns} rows={rules} emptyMessage="No NAT rules found" />

        {/* NAT Rule Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>{editingRule ? 'Edit NAT Rule' : 'Create NAT Rule'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Rule Name"
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                required
                fullWidth
              />

              <TextField
                select
                label="Cluster"
                value={formData.cluster_id}
                onChange={(e) => setFormData({ ...formData, cluster_id: e.target.value })}
                required
                fullWidth
                disabled={!!editingRule}
              >
                {clusters.map((cluster) => (
                  <MenuItem key={cluster.id} value={cluster.id.toString()}>
                    {cluster.name} ({cluster.host})
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Virtual Machine (Optional)"
                value={formData.vm_id}
                onChange={(e) => setFormData({ ...formData, vm_id: e.target.value })}
                fullWidth
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {vms.map((vm) => (
                  <MenuItem key={vm.id} value={vm.id.toString()}>
                    {vm.name} ({vm.vmid})
                  </MenuItem>
                ))}
              </TextField>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="External IP"
                  value={formData.external_ip}
                  onChange={(e) => setFormData({ ...formData, external_ip: e.target.value })}
                  required
                  fullWidth
                  placeholder="192.168.1.100"
                />
                <TextField
                  label="External Port"
                  type="number"
                  value={formData.external_port}
                  onChange={(e) => setFormData({ ...formData, external_port: e.target.value })}
                  fullWidth
                  placeholder="8080"
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Internal IP"
                  value={formData.internal_ip}
                  onChange={(e) => setFormData({ ...formData, internal_ip: e.target.value })}
                  required
                  fullWidth
                  placeholder="10.0.1.100"
                />
                <TextField
                  label="Internal Port"
                  type="number"
                  value={formData.internal_port}
                  onChange={(e) => setFormData({ ...formData, internal_port: e.target.value })}
                  fullWidth
                  placeholder="80"
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  select
                  label="Protocol"
                  value={formData.protocol}
                  onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
                  required
                  fullWidth
                >
                  <MenuItem value="tcp">TCP</MenuItem>
                  <MenuItem value="udp">UDP</MenuItem>
                  <MenuItem value="both">Both (TCP/UDP)</MenuItem>
                </TextField>

                <TextField
                  select
                  label="NAT Type"
                  value={formData.nat_type}
                  onChange={(e) => setFormData({ ...formData, nat_type: e.target.value })}
                  fullWidth
                >
                  <MenuItem value="port_forward">Port Forward</MenuItem>
                  <MenuItem value="dnat">DNAT</MenuItem>
                  <MenuItem value="snat">SNAT</MenuItem>
                </TextField>
              </Box>

              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
                fullWidth
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
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
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={loading || !formData.rule_name || !formData.cluster_id || !formData.external_ip || !formData.internal_ip}
            >
              {editingRule ? 'Update' : 'Create'}
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
    </Container>
  );
};
