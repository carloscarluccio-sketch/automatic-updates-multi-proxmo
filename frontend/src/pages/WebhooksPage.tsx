import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Divider,
  Switch,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Tooltip,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Send as TestIcon,
  Webhook as WebhookIcon
} from '@mui/icons-material';
import api from '../services/api';

interface Webhook {
  id: number;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  custom_headers: Record<string, string> | null;
  timeout_seconds: number;
  is_active: boolean;
  created_at: string;
  companies: {
    id: number;
    name: string;
  };
  users: {
    id: number;
    username: string;
    email: string;
  };
  _count: {
    webhook_deliveries: number;
  };
}

interface WebhookDelivery {
  id: number;
  event_type: string;
  payload: string;
  response_status_code: number | null;
  response_body: string | null;
  delivery_status: string;
  attempts: number;
  error_message: string | null;
  delivered_at: string;
}

interface WebhookStats {
  total_webhooks: number;
  active_webhooks: number;
  inactive_webhooks: number;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  success_rate: number;
}

const WEBHOOK_EVENTS = [
  { value: 'vm.created', label: 'VM Created' },
  { value: 'vm.deleted', label: 'VM Deleted' },
  { value: 'vm.started', label: 'VM Started' },
  { value: 'vm.stopped', label: 'VM Stopped' },
  { value: 'vm.restarted', label: 'VM Restarted' },
  { value: 'ticket.created', label: 'Ticket Created' },
  { value: 'ticket.updated', label: 'Ticket Updated' },
  { value: 'ticket.closed', label: 'Ticket Closed' },
  { value: 'user.created', label: 'User Created' },
  { value: 'company.created', label: 'Company Created' },
  { value: 'backup.completed', label: 'Backup Completed' },
  { value: 'backup.failed', label: 'Backup Failed' },
  { value: 'snapshot.created', label: 'Snapshot Created' },
  { value: 'alert.triggered', label: 'Alert Triggered' },
  { value: 'invoice.created', label: 'Invoice Created' },
  { value: 'payment.received', label: 'Payment Received' }
];

const WebhooksPage: React.FC = () => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
    timeout_seconds: 30,
    is_active: true
  });

  useEffect(() => {
    loadWebhooks();
    loadStats();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/webhooks');
      setWebhooks(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/webhooks/stats');
      setStats(response.data.data);
    } catch (err: any) {
      console.error('Failed to load webhook stats:', err);
    }
  };

  const handleCreateWebhook = async () => {
    try {
      setLoading(true);
      await api.post('/webhooks', formData);
      setSuccess('Webhook created successfully');
      setCreateDialogOpen(false);
      resetForm();
      loadWebhooks();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWebhook = async () => {
    if (!selectedWebhook) return;

    try {
      setLoading(true);
      await api.patch(`/webhooks/${selectedWebhook.id}`, formData);
      setSuccess('Webhook updated successfully');
      setEditDialogOpen(false);
      setSelectedWebhook(null);
      resetForm();
      loadWebhooks();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: number) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      setLoading(true);
      await api.delete(`/webhooks/${webhookId}`);
      setSuccess('Webhook deleted successfully');
      loadWebhooks();
      loadStats();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async (webhookId: number) => {
    try {
      setLoading(true);
      const response = await api.post(`/webhooks/${webhookId}/test`);
      if (response.data.success) {
        setSuccess(`Test webhook sent successfully (Status: ${response.data.data.statusCode})`);
      } else {
        setError(`Test webhook failed: ${response.data.data.error}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to test webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDeliveries = async (webhook: Webhook) => {
    try {
      setLoading(true);
      setSelectedWebhook(webhook);
      const response = await api.get(`/webhooks/${webhook.id}/deliveries`);
      setDeliveries(response.data.data || []);
      setDeliveryDialogOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  const handleEditWebhook = (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret || '',
      timeout_seconds: webhook.timeout_seconds,
      is_active: webhook.is_active
    });
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      events: [],
      secret: '',
      timeout_seconds: 30,
      is_active: true
    });
  };

  const handleEventToggle = (eventValue: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventValue)
        ? prev.events.filter(e => e !== eventValue)
        : [...prev.events, eventValue]
    }));
  };

  const getDeliveryStatusColor = (status: string) => {
    const colors: any = {
      success: 'success',
      failed: 'error',
      pending: 'warning'
    };
    return colors[status] || 'default';
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            <WebhookIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Webhooks
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            New Webhook
          </Button>
        </Box>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

        {/* Statistics */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Webhooks
                  </Typography>
                  <Typography variant="h3">{stats.total_webhooks}</Typography>
                  <Typography variant="body2" color="success.main">
                    {stats.active_webhooks} active
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Deliveries
                  </Typography>
                  <Typography variant="h3">{stats.total_deliveries}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stats.successful_deliveries} successful
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Success Rate
                  </Typography>
                  <Typography variant="h3">{stats.success_rate}%</Typography>
                  <Typography variant="body2" color={stats.success_rate >= 90 ? 'success.main' : 'warning.main'}>
                    {stats.failed_deliveries} failed
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Webhooks Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>URL</TableCell>
                <TableCell>Events</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Deliveries</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && webhooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center"><CircularProgress /></TableCell>
                </TableRow>
              ) : webhooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">No webhooks configured</TableCell>
                </TableRow>
              ) : (
                webhooks.map((webhook) => (
                  <TableRow key={webhook.id} hover>
                    <TableCell>{webhook.name}</TableCell>
                    <TableCell>
                      <Tooltip title={webhook.url}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {webhook.url}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {webhook.events.slice(0, 2).map(event => (
                          <Chip key={event} label={event.split('.')[1]} size="small" />
                        ))}
                        {webhook.events.length > 2 && (
                          <Chip label={`+${webhook.events.length - 2}`} size="small" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={webhook.is_active ? 'Active' : 'Inactive'}
                        color={webhook.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{webhook._count.webhook_deliveries}</TableCell>
                    <TableCell>{new Date(webhook.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Tooltip title="View Deliveries">
                        <IconButton size="small" onClick={() => handleViewDeliveries(webhook)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Test Webhook">
                        <IconButton size="small" onClick={() => handleTestWebhook(webhook.id)}>
                          <TestIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEditWebhook(webhook)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDeleteWebhook(webhook.id)} color="error">
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
      </Box>

      {/* Create Webhook Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Webhook</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="URL"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://your-server.com/webhook"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Secret (optional)"
              value={formData.secret}
              onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
              helperText="Secret key for webhook signature verification"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="number"
              label="Timeout (seconds)"
              value={formData.timeout_seconds}
              onChange={(e) => setFormData({ ...formData, timeout_seconds: parseInt(e.target.value) })}
              sx={{ mb: 2 }}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Events to Subscribe
            </Typography>
            <FormGroup>
              <Grid container spacing={1}>
                {WEBHOOK_EVENTS.map(event => (
                  <Grid item xs={12} sm={6} key={event.value}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.events.includes(event.value)}
                          onChange={() => handleEventToggle(event.value)}
                        />
                      }
                      label={event.label}
                    />
                  </Grid>
                ))}
              </Grid>
            </FormGroup>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Active"
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateWebhook}
            variant="contained"
            disabled={!formData.name || !formData.url || formData.events.length === 0}
          >
            Create Webhook
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Webhook Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Webhook</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="URL"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Secret (optional)"
              value={formData.secret}
              onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="number"
              label="Timeout (seconds)"
              value={formData.timeout_seconds}
              onChange={(e) => setFormData({ ...formData, timeout_seconds: parseInt(e.target.value) })}
              sx={{ mb: 2 }}
            />

            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Events to Subscribe
            </Typography>
            <FormGroup>
              <Grid container spacing={1}>
                {WEBHOOK_EVENTS.map(event => (
                  <Grid item xs={12} sm={6} key={event.value}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.events.includes(event.value)}
                          onChange={() => handleEventToggle(event.value)}
                        />
                      }
                      label={event.label}
                    />
                  </Grid>
                ))}
              </Grid>
            </FormGroup>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Active"
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateWebhook} variant="contained">
            Update Webhook
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delivery History Dialog */}
      <Dialog open={deliveryDialogOpen} onClose={() => setDeliveryDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Delivery History - {selectedWebhook?.name}
        </DialogTitle>
        <DialogContent>
          <List>
            {deliveries.length === 0 ? (
              <Typography align="center" color="text.secondary">No deliveries yet</Typography>
            ) : (
              deliveries.map((delivery) => (
                <React.Fragment key={delivery.id}>
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={delivery.event_type}
                            size="small"
                          />
                          <Chip
                            label={delivery.delivery_status}
                            color={getDeliveryStatusColor(delivery.delivery_status)}
                            size="small"
                          />
                          {delivery.response_status_code && (
                            <Chip label={`HTTP ${delivery.response_status_code}`} size="small" />
                          )}
                          <Typography variant="caption" color="text.secondary">
                            {delivery.attempts} attempt{delivery.attempts > 1 ? 's' : ''}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" display="block">
                            {new Date(delivery.delivered_at).toLocaleString()}
                          </Typography>
                          {delivery.error_message && (
                            <Typography variant="caption" color="error" display="block">
                              Error: {delivery.error_message}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeliveryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WebhooksPage;
