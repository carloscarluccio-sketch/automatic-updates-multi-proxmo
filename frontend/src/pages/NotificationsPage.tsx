import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmailIcon from '@mui/icons-material/Email';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import SettingsIcon from '@mui/icons-material/Settings';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface QueueItem {
  id: number;
  user_id: number;
  notification_type: string;
  recipient_email: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  priority: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  max_attempts: number;
  scheduled_for: string | null;
  sent_at: string | null;
  error_message: string | null;
  metadata: string | null;
  created_at: string;
  last_attempt: string | null;
}

interface QueueStatus {
  queue_items: QueueItem[];
  total_count: number;
  status_breakdown: {
    pending?: number;
    sending?: number;
    sent?: number;
    failed?: number;
    cancelled?: number;
  };
  limit: number;
  offset: number;
}

interface NotificationSetting {
  id: number;
  user_id: number;
  notification_type: string;
  email_enabled: boolean;
  webhook_url: string | null;
  webhook_enabled: boolean;
  created_at: string;
  updated_at: string;
}

const NotificationsPage: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // SMTP Test Dialog
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  // Settings
  const [alertEmailEnabled, setAlertEmailEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setRefreshing(true);

      if (activeTab === 0) {
        // Load queue status
        const res = await api.get<{ success: boolean; data: QueueStatus }>('/notifications/queue', {
          params: { limit: 100 },
        });
        setQueueStatus(res.data.data);
      } else {
        // Load notification settings
        const res = await api.get<{ success: boolean; data: NotificationSetting[] }>('/notifications/settings');

        // Set alert email toggle based on settings
        const alertSetting = res.data.data?.find((s: NotificationSetting) => s.notification_type === 'alert_triggered');
        if (alertSetting) {
          setAlertEmailEnabled(alertSetting.email_enabled);
        }
      }

      setError(null);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleTestSMTP = async () => {
    if (!user || user.role !== 'super_admin') {
      setError('Only super administrators can test SMTP connection');
      return;
    }

    try {
      setTesting(true);
      const res = await api.post<{ success: boolean; message: string }>('/notifications/test-smtp');
      setSuccessMessage(res.data.message || 'SMTP connection test successful');
    } catch (err: any) {
      console.error('Error testing SMTP:', err);
      setError(err.response?.data?.message || 'SMTP connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!user || user.role !== 'super_admin') {
      setError('Only super administrators can send test emails');
      return;
    }

    if (!testEmail) {
      setError('Please enter a recipient email address');
      return;
    }

    try {
      setTesting(true);
      const res = await api.post<{ success: boolean; message: string }>('/notifications/send-test-email', {
        recipient_email: testEmail,
      });
      setSuccessMessage(res.data.message || 'Test email sent successfully');
      setTestDialogOpen(false);
      setTestEmail('');
    } catch (err: any) {
      console.error('Error sending test email:', err);
      setError(err.response?.data?.message || 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  const handleProcessQueue = async () => {
    if (!user || user.role !== 'super_admin') {
      setError('Only super administrators can manually process queue');
      return;
    }

    try {
      const res = await api.post<{ success: boolean; message: string }>('/notifications/process-queue');
      setSuccessMessage(res.data.message || 'Email queue processing started');
      setTimeout(() => loadData(), 2000);
    } catch (err: any) {
      console.error('Error processing queue:', err);
      setError(err.response?.data?.message || 'Failed to process queue');
    }
  };

  const handleCancelQueueItem = async (itemId: number) => {
    try {
      await api.delete(`/notifications/queue/${itemId}`);
      setSuccessMessage('Queued email cancelled successfully');
      loadData();
    } catch (err: any) {
      console.error('Error cancelling queue item:', err);
      setError(err.response?.data?.message || 'Failed to cancel queued email');
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await api.post('/notifications/settings', {
        notification_type: 'alert_triggered',
        email_enabled: alertEmailEnabled,
      });
      setSuccessMessage('Notification settings saved successfully');
      loadData();
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'error' | 'warning' => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'sending':
        return 'primary';
      case 'sent':
        return 'success';
      case 'failed':
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <HourglassEmptyIcon fontSize="small" />;
      case 'sending':
        return <CircularProgress size={16} />;
      case 'sent':
        return <CheckCircleIcon fontSize="small" />;
      case 'failed':
        return <ErrorIcon fontSize="small" />;
      case 'cancelled':
        return <CancelIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          <EmailIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Email Notifications
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
            onClick={loadData}
            disabled={refreshing}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          {user?.role === 'super_admin' && activeTab === 0 && (
            <>
              <Button
                variant="outlined"
                color="primary"
                startIcon={<PlayArrowIcon />}
                onClick={handleProcessQueue}
                sx={{ mr: 1 }}
              >
                Process Queue
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SendIcon />}
                onClick={() => setTestDialogOpen(true)}
              >
                Send Test Email
              </Button>
            </>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" onClose={() => setSuccessMessage(null)} sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Email Queue" />
          <Tab label="Settings" />
          {user?.role === 'super_admin' && <Tab label="SMTP Test" />}
        </Tabs>
      </Box>

      {/* Email Queue Tab */}
      {activeTab === 0 && queueStatus && (
        <>
          {/* Queue Statistics */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4">{queueStatus.total_count}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {queueStatus.status_breakdown.pending || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Pending
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {queueStatus.status_breakdown.sending || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Sending
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {queueStatus.status_breakdown.sent || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Sent
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="error">
                    {queueStatus.status_breakdown.failed || 0}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Failed
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Queue Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Recipient</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Attempts</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {queueStatus.queue_items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="textSecondary" py={3}>
                        No emails in queue
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  queueStatus.queue_items.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getStatusIcon(item.status)}
                          <Chip
                            label={item.status.toUpperCase()}
                            size="small"
                            color={getStatusColor(item.status)}
                          />
                        </Box>
                        {item.error_message && (
                          <Tooltip title={item.error_message}>
                            <Typography variant="caption" color="error" display="block">
                              Error: {item.error_message.substring(0, 30)}...
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.recipient_email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.subject}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={item.notification_type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip label={item.priority.toUpperCase()} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.attempts} / {item.max_attempts}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDate(item.created_at)}</Typography>
                        {item.sent_at && (
                          <Typography variant="caption" color="success.main" display="block">
                            Sent: {formatDate(item.sent_at)}
                          </Typography>
                        )}
                        {item.last_attempt && !item.sent_at && (
                          <Typography variant="caption" color="textSecondary" display="block">
                            Last: {formatDate(item.last_attempt)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.status === 'pending' && (
                          <Tooltip title="Cancel">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleCancelQueueItem(item.id)}
                            >
                              <DeleteIcon fontSize="small" />
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
        </>
      )}

      {/* Settings Tab */}
      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Notification Preferences
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Box mb={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={alertEmailEnabled}
                  onChange={(_event, checked) => setAlertEmailEnabled(checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body1">Alert Email Notifications</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Receive email notifications when resource alerts are triggered
                  </Typography>
                </Box>
              }
            />
          </Box>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Email notifications require proper SMTP configuration. Contact your system administrator
              if emails are not being delivered.
            </Typography>
          </Alert>

          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveSettings}
            disabled={savingSettings}
            startIcon={savingSettings ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            Save Settings
          </Button>
        </Paper>
      )}

      {/* SMTP Test Tab */}
      {activeTab === 2 && user?.role === 'super_admin' && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            SMTP Connection Test
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Test the SMTP connection to ensure email delivery is working properly.
              This requires SMTP_HOST, SMTP_USER, SMTP_PASS environment variables to be configured.
            </Typography>
          </Alert>

          <Button
            variant="contained"
            color="primary"
            onClick={handleTestSMTP}
            disabled={testing}
            startIcon={testing ? <CircularProgress size={20} /> : <SendIcon />}
            fullWidth
          >
            Test SMTP Connection
          </Button>
        </Paper>
      )}

      {/* Test Email Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Test Email</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" mb={2}>
            Enter a recipient email address to send a test email and verify SMTP configuration.
          </Typography>
          <TextField
            fullWidth
            type="email"
            label="Recipient Email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="user@example.com"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSendTestEmail}
            variant="contained"
            color="primary"
            disabled={testing || !testEmail}
            startIcon={testing ? <CircularProgress size={20} /> : <SendIcon />}
          >
            Send Test Email
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotificationsPage;
