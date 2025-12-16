import React, { useState, useEffect } from 'react';
import {
  Box, Button, Card, CardContent, Grid, Paper,
  Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography, Alert, Snackbar, Tabs, Tab
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Email as EmailIcon,
  Webhook as WebhookIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface NotificationSetting {
  id: number;
  user_id: number;
  notification_type: string;
  email_enabled: boolean;
  webhook_enabled: boolean;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}


const NotificationSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [filteredSettings, setFilteredSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [categorySummary, setCategorySummary] = useState<any>(null);

  useEffect(() => {
    loadSettings();
    loadCategories();
  }, []);

  useEffect(() => {
    filterSettings();
  }, [activeTab, settings]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notification-settings');
      setSettings(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/notification-settings/categories');
      setCategorySummary(response.data.data.summary);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
    }
  };

  const filterSettings = () => {
    let filtered: NotificationSetting[] = [];

    switch (activeTab) {
      case 0: // All
        filtered = settings;
        break;
      case 1: // Tickets
        filtered = settings.filter(s => s.notification_type.startsWith('ticket_'));
        break;
      case 2: // VMs
        filtered = settings.filter(s => s.notification_type.startsWith('vm_'));
        break;
      case 3: // Users
        filtered = settings.filter(s => s.notification_type.startsWith('user_'));
        break;
      case 4: // Subscriptions
        filtered = settings.filter(s => s.notification_type.startsWith('subscription_'));
        break;
      case 5: // System
        filtered = settings.filter(s => ['webhook_failed', 'rate_limit_exceeded'].includes(s.notification_type));
        break;
    }

    setFilteredSettings(filtered);
  };

  const handleToggleEmail = async (settingId: number, enabled: boolean) => {
    try {
      await api.patch(`/notification-settings/${settingId}`, { email_enabled: enabled });
      setSettings(settings.map(s => s.id === settingId ? { ...s, email_enabled: enabled } : s));
      setSuccess('Email notification updated');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update setting');
    }
  };

  const handleToggleWebhook = async (settingId: number, enabled: boolean) => {
    try {
      await api.patch(`/notification-settings/${settingId}`, { webhook_enabled: enabled });
      setSettings(settings.map(s => s.id === settingId ? { ...s, webhook_enabled: enabled } : s));
      setSuccess('Webhook notification updated');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update setting');
    }
  };

  const handleWebhookUrlChange = async (settingId: number, url: string) => {
    try {
      await api.patch(`/notification-settings/${settingId}`, { webhook_url: url });
      setSettings(settings.map(s => s.id === settingId ? { ...s, webhook_url: url } : s));
      setSuccess('Webhook URL updated');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update webhook URL');
    }
  };

  const handleToggleAllEmail = async (enabled: boolean) => {
    try {
      await api.post('/notification-settings/toggle-all-email', { enabled });
      loadSettings();
      loadCategories();
      setSuccess(`All email notifications ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle all email');
    }
  };

  const formatNotificationType = (type: string): string => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getCategoryIcon = (type: string) => {
    if (type.startsWith('ticket_')) return '🎫';
    if (type.startsWith('vm_')) return '💻';
    if (type.startsWith('user_')) return '👤';
    if (type.startsWith('subscription_')) return '💳';
    return '⚙️';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Notification Settings
        </Typography>
        <Box>
          <Button
            variant="outlined"
            color="success"
            onClick={() => handleToggleAllEmail(true)}
            sx={{ mr: 1 }}
          >
            Enable All Email
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => handleToggleAllEmail(false)}
          >
            Disable All Email
          </Button>
        </Box>
      </Box>

      {categorySummary && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Tickets</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Box>
                    <EmailIcon fontSize="small" color="primary" />
                    <Typography variant="h6">{categorySummary.tickets.email_enabled}/{categorySummary.tickets.total}</Typography>
                  </Box>
                  <Box>
                    <WebhookIcon fontSize="small" color="secondary" />
                    <Typography variant="h6">{categorySummary.tickets.webhook_enabled}/{categorySummary.tickets.total}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>VMs</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Box>
                    <EmailIcon fontSize="small" color="primary" />
                    <Typography variant="h6">{categorySummary.vms.email_enabled}/{categorySummary.vms.total}</Typography>
                  </Box>
                  <Box>
                    <WebhookIcon fontSize="small" color="secondary" />
                    <Typography variant="h6">{categorySummary.vms.webhook_enabled}/{categorySummary.vms.total}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Users</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Box>
                    <EmailIcon fontSize="small" color="primary" />
                    <Typography variant="h6">{categorySummary.users.email_enabled}/{categorySummary.users.total}</Typography>
                  </Box>
                  <Box>
                    <WebhookIcon fontSize="small" color="secondary" />
                    <Typography variant="h6">{categorySummary.users.webhook_enabled}/{categorySummary.users.total}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>Subscriptions</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Box>
                    <EmailIcon fontSize="small" color="primary" />
                    <Typography variant="h6">{categorySummary.subscriptions.email_enabled}/{categorySummary.subscriptions.total}</Typography>
                  </Box>
                  <Box>
                    <WebhookIcon fontSize="small" color="secondary" />
                    <Typography variant="h6">{categorySummary.subscriptions.webhook_enabled}/{categorySummary.subscriptions.total}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>System</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Box>
                    <EmailIcon fontSize="small" color="primary" />
                    <Typography variant="h6">{categorySummary.system.email_enabled}/{categorySummary.system.total}</Typography>
                  </Box>
                  <Box>
                    <WebhookIcon fontSize="small" color="secondary" />
                    <Typography variant="h6">{categorySummary.system.webhook_enabled}/{categorySummary.system.total}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(_e, v) => setActiveTab(v)}>
          <Tab label="All" />
          <Tab label="Tickets" />
          <Tab label="VMs" />
          <Tab label="Users" />
          <Tab label="Subscriptions" />
          <Tab label="System" />
        </Tabs>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Notification Type</TableCell>
              <TableCell align="center">Email</TableCell>
              <TableCell align="center">Webhook</TableCell>
              <TableCell>Webhook URL</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSettings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography color="textSecondary">{loading ? 'Loading...' : 'No notification settings found'}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredSettings.map((setting) => (
                <TableRow key={setting.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{getCategoryIcon(setting.notification_type)}</span>
                      <Typography variant="body2">{formatNotificationType(setting.notification_type)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={setting.email_enabled}
                      onChange={(e) => handleToggleEmail(setting.id, e.target.checked)}
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={setting.webhook_enabled}
                      onChange={(e) => handleToggleWebhook(setting.id, e.target.checked)}
                      color="secondary"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="https://webhook.example.com"
                      value={setting.webhook_url || ''}
                      onChange={(e) => handleWebhookUrlChange(setting.id, e.target.value)}
                      disabled={!setting.webhook_enabled}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess('')}>
        <Alert onClose={() => setSuccess('')} severity="success">{success}</Alert>
      </Snackbar>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error">{error}</Alert>
      </Snackbar>
    </Box>
  );
};

export default NotificationSettingsPage;
