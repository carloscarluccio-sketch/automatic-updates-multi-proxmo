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
  FormControlLabel,
  Switch,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { DataTable, Column } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface APIToken {
  id: number;
  user_id: number;
  company_id: number;
  name: string;
  token_prefix: string;
  scopes: string;
  ip_whitelist: string | null;
  rate_limit: number;
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  request_count: number;
  is_active: boolean;
  created_at: string;
  revoked_at: string | null;
}

interface TokenCreationResponse {
  id: number;
  name: string;
  token_prefix: string;
  token: string;
  scopes: string;
  rate_limit: number;
  expires_at: string | null;
  created_at: string;
}

export const APITokensPage: React.FC = () => {
  const [tokens, setTokens] = useState<APIToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDialog, setOpenDialog] = useState(false);
  const [openTokenDialog, setOpenTokenDialog] = useState(false);
  const [editingToken, setEditingToken] = useState<APIToken | null>(null);
  const [newTokenData, setNewTokenData] = useState<TokenCreationResponse | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    scopes: 'read',
    ip_whitelist: '',
    rate_limit: '100',
    expires_at: '',
    is_active: true,
  });
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tokens');
      setTokens(response.data.data || []);
    } catch (error) {
      console.error('Failed to load tokens:', error);
      showSnackbar('Failed to load tokens', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (token?: APIToken) => {
    if (token) {
      setEditingToken(token);
      const scopes = JSON.parse(token.scopes || '["read"]');
      setFormData({
        name: token.name,
        scopes: scopes.join(', '),
        ip_whitelist: token.ip_whitelist || '',
        rate_limit: token.rate_limit.toString(),
        expires_at: token.expires_at ? token.expires_at.split('T')[0] : '',
        is_active: token.is_active,
      });
    } else {
      setEditingToken(null);
      setFormData({
        name: '',
        scopes: 'read',
        ip_whitelist: '',
        rate_limit: '100',
        expires_at: '',
        is_active: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingToken(null);
  };

  const handleCloseTokenDialog = () => {
    setOpenTokenDialog(false);
    setNewTokenData(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const submitData: any = {
        name: formData.name,
        scopes: formData.scopes.split(',').map((s) => s.trim()),
        rate_limit: parseInt(formData.rate_limit),
        expires_at: formData.expires_at || null,
      };

      if (formData.ip_whitelist) {
        submitData.ip_whitelist = formData.ip_whitelist.split(',').map((ip) => ip.trim());
      }

      if (editingToken) {
        submitData.is_active = formData.is_active;
        await api.put(`/tokens/${editingToken.id}`, submitData);
        showSnackbar('Token updated successfully', 'success');
        handleCloseDialog();
      } else {
        const response = await api.post('/tokens', submitData);
        setNewTokenData(response.data.data);
        showSnackbar('Token created successfully', 'success');
        handleCloseDialog();
        setOpenTokenDialog(true);
      }
      await loadTokens();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (token: APIToken) => {
    if (!window.confirm(`Are you sure you want to revoke token "${token.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.post(`/tokens/${token.id}/revoke`);
      showSnackbar('Token revoked successfully', 'success');
      await loadTokens();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to revoke token', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (token: APIToken) => {
    if (!window.confirm(`Are you sure you want to delete token "${token.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/tokens/${token.id}`);
      showSnackbar('Token deleted successfully', 'success');
      await loadTokens();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to delete token', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSnackbar('Copied to clipboard', 'success');
  };

  const formatDate = (date: string | null): string => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const columns: Column[] = [
    {
      id: 'name',
      label: 'Name',
      minWidth: 200,
      format: (_value, row: any) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {row.name}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {row.token_prefix}***
          </Typography>
        </Box>
      ),
    },
    {
      id: 'scopes',
      label: 'Scopes',
      minWidth: 150,
      format: (value) => {
        const scopes = JSON.parse(value as string || '[]');
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {scopes.map((scope: string) => (
              <Chip key={scope} label={scope} size="small" variant="outlined" />
            ))}
          </Box>
        );
      },
    },
    {
      id: 'rate_limit',
      label: 'Rate Limit',
      minWidth: 100,
      format: (value) => `${value}/min`,
    },
    {
      id: 'request_count',
      label: 'Requests',
      minWidth: 100,
    },
    {
      id: 'last_used_at',
      label: 'Last Used',
      minWidth: 150,
      format: (value) => formatDate(value as string | null),
    },
    {
      id: 'is_active',
      label: 'Status',
      minWidth: 100,
      format: (value, row: any) => (
        <Chip
          label={value ? 'Active' : row.revoked_at ? 'Revoked' : 'Inactive'}
          color={value ? 'success' : 'error'}
          size="small"
        />
      ),
    },
  ];

  if (currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin') {
    columns.push({
      id: 'actions',
      label: 'Actions',
      minWidth: 200,
      format: (_value, row: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenDialog(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {row.is_active && (
            <Tooltip title="Revoke">
              <IconButton size="small" color="warning" onClick={() => handleRevoke(row)}>
                <BlockIcon fontSize="small" />
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

  if (loading && tokens.length === 0) {
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
              API Tokens
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Manage API access tokens for programmatic access
            </Typography>
          </Box>
          {(currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin') && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()} disabled={loading}>
              Generate Token
            </Button>
          )}
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Found {tokens.length} API tokens. Tokens provide programmatic access to the API with customizable
          permissions.
        </Alert>

        <DataTable columns={columns} rows={tokens} emptyMessage="No API tokens found" />

        {/* Create/Edit Token Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VpnKeyIcon />
              {editingToken ? 'Edit API Token' : 'Generate New API Token'}
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Token Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                fullWidth
                helperText="Descriptive name for this token"
              />
              <TextField
                label="Scopes"
                value={formData.scopes}
                onChange={(e) => setFormData({ ...formData, scopes: e.target.value })}
                required
                fullWidth
                helperText="Comma-separated permissions (e.g., read, write, delete)"
              />
              <TextField
                label="Rate Limit (requests per minute)"
                type="number"
                value={formData.rate_limit}
                onChange={(e) => setFormData({ ...formData, rate_limit: e.target.value })}
                required
                fullWidth
                helperText="Maximum API requests per minute"
              />
              <TextField
                label="IP Whitelist (optional)"
                value={formData.ip_whitelist}
                onChange={(e) => setFormData({ ...formData, ip_whitelist: e.target.value })}
                fullWidth
                helperText="Comma-separated IPs (e.g., 192.168.1.1, 10.0.0.1). Leave empty for no restriction."
              />
              <TextField
                label="Expiration Date (optional)"
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Token will become inactive after this date"
              />
              {editingToken && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} variant="contained" disabled={loading || !formData.name}>
              {editingToken ? 'Update' : 'Generate'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* New Token Display Dialog */}
        <Dialog open={openTokenDialog} onClose={handleCloseTokenDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            <Alert severity="warning">Token Generated Successfully</Alert>
          </DialogTitle>
          <DialogContent>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.100', mt: 2 }}>
              <Typography variant="body2" color="error" gutterBottom fontWeight="bold">
                IMPORTANT: Save this token now. You will not be able to see it again!
              </Typography>
              <Divider sx={{ my: 2 }} />
              {newTokenData && (
                <List>
                  <ListItem>
                    <ListItemText primary="Token Name" secondary={newTokenData.name} />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Full Token"
                      secondary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                          <TextField
                            value={newTokenData.token}
                            fullWidth
                            multiline
                            rows={2}
                            InputProps={{
                              readOnly: true,
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton onClick={() => copyToClipboard(newTokenData.token)} edge="end">
                                    <ContentCopyIcon />
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Token Prefix"
                      secondary={`${newTokenData.token_prefix}*** (use this to identify the token later)`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Rate Limit" secondary={`${newTokenData.rate_limit} requests/minute`} />
                  </ListItem>
                </List>
              )}
            </Paper>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseTokenDialog} variant="contained">
              I Have Saved The Token
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
