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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import TestIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import { DataTable, Column } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface SSOConfig {
  id: number;
  company_id: number;
  provider: string;
  client_id: string;
  tenant_id: string | null;
  authority_url: string | null;
  redirect_uri: string;
  scopes: string;
  enabled: boolean;
  auto_provision: boolean;
  default_role: string;
  require_domain_match: boolean;
  allowed_domains: string;
  created_at: string;
  updated_at: string;
  last_tested_at: string | null;
  last_test_status: string | null;
  last_test_message: string | null;
  companies?: {
    id: number;
    name: string;
  };
}

interface SSOAuditLog {
  id: number;
  company_id: number;
  email: string;
  provider: string;
  status: string;
  failure_reason: string | null;
  user_provisioned: boolean;
  ip_address: string | null;
  created_at: string;
  companies?: {
    id: number;
    name: string;
  };
}

export const SSOConfigPage: React.FC = () => {
  const [configs, setConfigs] = useState<SSOConfig[]>([]);
  const [auditLogs, setAuditLogs] = useState<SSOAuditLog[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDialog, setOpenDialog] = useState(false);
  const [openAuditDialog, setOpenAuditDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SSOConfig | null>(null);
  const [formData, setFormData] = useState({
    company_id: '',
    provider: 'microsoft',
    client_id: '',
    client_secret: '',
    tenant_id: '',
    authority_url: '',
    redirect_uri: '',
    scopes: 'openid profile email User.Read',
    enabled: true,
    auto_provision: true,
    default_role: 'user',
    require_domain_match: true,
    allowed_domains: '',
  });
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadConfigs(), loadCompanies()]);
    } catch (error) {
      showSnackbar('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadConfigs = async () => {
    try {
      const response = await api.get('/sso/config');
      setConfigs(response.data.data || []);
    } catch (error) {
      console.error('Failed to load SSO configs:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      if (currentUser?.role === 'super_admin') {
        const response = await api.get('/companies');
        setCompanies(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/sso/audit?limit=100');
      setAuditLogs(response.data.data || []);
      setOpenAuditDialog(true);
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (config?: SSOConfig) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        company_id: config.company_id.toString(),
        provider: config.provider,
        client_id: config.client_id,
        client_secret: '', // Don't populate for security
        tenant_id: config.tenant_id || '',
        authority_url: config.authority_url || '',
        redirect_uri: config.redirect_uri,
        scopes: config.scopes,
        enabled: config.enabled,
        auto_provision: config.auto_provision,
        default_role: config.default_role,
        require_domain_match: config.require_domain_match,
        allowed_domains: config.allowed_domains || '',
      });
    } else {
      setEditingConfig(null);
      setFormData({
        company_id: currentUser?.role === 'super_admin' ? '' : currentUser?.company_id?.toString() || '',
        provider: 'microsoft',
        client_id: '',
        client_secret: '',
        tenant_id: '',
        authority_url: '',
        redirect_uri: `${window.location.origin}/api/auth/sso/callback`,
        scopes: 'openid profile email User.Read',
        enabled: true,
        auto_provision: true,
        default_role: 'user',
        require_domain_match: true,
        allowed_domains: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingConfig(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const submitData: any = {
        provider: formData.provider,
        client_id: formData.client_id,
        client_secret: formData.client_secret,
        tenant_id: formData.tenant_id || null,
        authority_url: formData.authority_url || null,
        redirect_uri: formData.redirect_uri,
        scopes: formData.scopes,
        enabled: formData.enabled,
        auto_provision: formData.auto_provision,
        default_role: formData.default_role,
        require_domain_match: formData.require_domain_match,
        allowed_domains: formData.allowed_domains,
      };

      if (currentUser?.role === 'super_admin' && formData.company_id) {
        submitData.company_id = parseInt(formData.company_id);
      }

      await api.post('/sso/config', submitData);
      showSnackbar('SSO configuration saved successfully', 'success');
      handleCloseDialog();
      await loadConfigs();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (config: SSOConfig) => {
    if (!window.confirm(`Are you sure you want to delete SSO configuration for ${config.provider}?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/sso/config/${config.id}`);
      showSnackbar('SSO configuration deleted successfully', 'success');
      await loadConfigs();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to delete SSO configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (config: SSOConfig) => {
    try {
      setLoading(true);
      const response = await api.post(`/sso/test/${config.id}`);
      showSnackbar(response.data.message || 'SSO connection test successful', 'success');
      await loadConfigs();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'SSO connection test failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const columns: Column[] = [
    {
      id: 'provider',
      label: 'Provider',
      minWidth: 120,
      format: (value) => (
        <Chip label={value.toUpperCase()} color="primary" size="small" />
      ),
    },
    { id: 'client_id', label: 'Client ID', minWidth: 200 },
    {
      id: 'tenant_id',
      label: 'Tenant ID',
      minWidth: 150,
      format: (value) => value || 'N/A',
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
    {
      id: 'last_test_status',
      label: 'Last Test',
      minWidth: 120,
      format: (value) => {
        if (!value) return <Chip label="Not Tested" size="small" />;
        return (
          <Chip
            label={value}
            color={value === 'success' ? 'success' : 'error'}
            size="small"
          />
        );
      },
    },
  ];

  if (currentUser?.role === 'super_admin') {
    columns.unshift({
      id: 'companies',
      label: 'Company',
      minWidth: 150,
      format: (value: any) => value?.name || 'N/A',
    });

    columns.push({
      id: 'actions',
      label: 'Actions',
      minWidth: 200,
      format: (_value, row: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Test Connection">
            <IconButton size="small" color="primary" onClick={() => handleTest(row)}>
              <TestIcon fontSize="small" />
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
  } else {
    columns.push({
      id: 'actions',
      label: 'Actions',
      minWidth: 150,
      format: (_value, row: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Test Connection">
            <IconButton size="small" color="primary" onClick={() => handleTest(row)}>
              <TestIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenDialog(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    });
  }

  const auditColumns: Column[] = [
    { id: 'email', label: 'Email', minWidth: 200 },
    {
      id: 'provider',
      label: 'Provider',
      minWidth: 100,
      format: (value) => <Chip label={value.toUpperCase()} size="small" />,
    },
    {
      id: 'status',
      label: 'Status',
      minWidth: 100,
      format: (value) => (
        <Chip
          label={value}
          color={value === 'success' ? 'success' : value === 'failed' ? 'error' : 'warning'}
          size="small"
        />
      ),
    },
    {
      id: 'user_provisioned',
      label: 'Provisioned',
      minWidth: 100,
      format: (value) => (
        <Chip label={value ? 'Yes' : 'No'} color={value ? 'success' : 'default'} size="small" />
      ),
    },
    { id: 'ip_address', label: 'IP Address', minWidth: 130 },
    {
      id: 'created_at',
      label: 'Date',
      minWidth: 150,
      format: (value) => new Date(value).toLocaleString(),
    },
  ];

  if (currentUser?.role === 'super_admin') {
    auditColumns.unshift({
      id: 'companies',
      label: 'Company',
      minWidth: 150,
      format: (value: any) => value?.name || 'N/A',
    });
  }

  if (loading && configs.length === 0) {
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
              SSO Configuration
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Configure Single Sign-On integration for Microsoft Azure AD / Office 365
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" startIcon={<HistoryIcon />} onClick={loadAuditLogs}>
              View Audit Logs
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} disabled={loading}>
              Configure SSO
            </Button>
          </Box>
        </Box>

        {configs.length === 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            No SSO configurations found. Click "Configure SSO" to set up Single Sign-On for your company.
          </Alert>
        )}

        {configs.length > 0 && (
          <>
            <Alert severity="info" sx={{ mb: 3 }}>
              Found {configs.length} SSO configuration(s). Users can sign in with Microsoft when SSO is enabled.
            </Alert>
            <DataTable columns={columns} rows={configs} emptyMessage="No SSO configurations found" />
          </>
        )}

        {/* SSO Configuration Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>{editingConfig ? 'Edit SSO Configuration' : 'Configure SSO'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {currentUser?.role === 'super_admin' && !editingConfig && (
                <TextField
                  select
                  label="Company"
                  value={formData.company_id}
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  required
                  fullWidth
                >
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id.toString()}>
                      {company.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              <TextField
                select
                label="Provider"
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                required
                fullWidth
                disabled={!!editingConfig}
              >
                <MenuItem value="microsoft">Microsoft Azure AD / Office 365</MenuItem>
                <MenuItem value="google" disabled>Google (Coming Soon)</MenuItem>
                <MenuItem value="okta" disabled>Okta (Coming Soon)</MenuItem>
              </TextField>

              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Azure AD Application Settings</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      label="Application (Client) ID"
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      required
                      fullWidth
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />

                    <TextField
                      label="Client Secret"
                      type="password"
                      value={formData.client_secret}
                      onChange={(e) => setFormData({ ...formData, client_secret: e.target.value })}
                      required={!editingConfig}
                      fullWidth
                      placeholder={editingConfig ? 'Leave blank to keep current secret' : 'Enter client secret'}
                      helperText={editingConfig ? 'Only enter if you want to update the secret' : ''}
                    />

                    <TextField
                      label="Directory (Tenant) ID"
                      value={formData.tenant_id}
                      onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                      fullWidth
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />

                    <TextField
                      label="Redirect URI"
                      value={formData.redirect_uri}
                      onChange={(e) => setFormData({ ...formData, redirect_uri: e.target.value })}
                      required
                      fullWidth
                      helperText="Add this URI to your Azure AD app's redirect URIs"
                    />

                    <TextField
                      label="OAuth Scopes"
                      value={formData.scopes}
                      onChange={(e) => setFormData({ ...formData, scopes: e.target.value })}
                      fullWidth
                      helperText="Space-separated list of scopes"
                    />
                  </Box>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">User Provisioning Settings</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.auto_provision}
                          onChange={(e) => setFormData({ ...formData, auto_provision: e.target.checked })}
                        />
                      }
                      label="Auto-provision users on first login"
                    />

                    <TextField
                      select
                      label="Default Role for New Users"
                      value={formData.default_role}
                      onChange={(e) => setFormData({ ...formData, default_role: e.target.value })}
                      fullWidth
                    >
                      <MenuItem value="user">User</MenuItem>
                      <MenuItem value="company_admin">Company Admin</MenuItem>
                    </TextField>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.require_domain_match}
                          onChange={(e) => setFormData({ ...formData, require_domain_match: e.target.checked })}
                        />
                      }
                      label="Require email domain match"
                    />

                    <TextField
                      label="Allowed Email Domains (comma-separated)"
                      value={formData.allowed_domains}
                      onChange={(e) => setFormData({ ...formData, allowed_domains: e.target.value })}
                      fullWidth
                      placeholder="example.com, company.com"
                      helperText="Leave blank to allow all domains"
                    />
                  </Box>
                </AccordionDetails>
              </Accordion>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  />
                }
                label="Enable SSO"
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
              disabled={loading || !formData.client_id || (!editingConfig && !formData.client_secret)}
            >
              {editingConfig ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Audit Logs Dialog */}
        <Dialog open={openAuditDialog} onClose={() => setOpenAuditDialog(false)} maxWidth="lg" fullWidth>
          <DialogTitle>SSO Login Audit Logs</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <DataTable columns={auditColumns} rows={auditLogs} emptyMessage="No audit logs found" />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAuditDialog(false)}>Close</Button>
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
