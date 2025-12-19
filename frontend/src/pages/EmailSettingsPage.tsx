import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Grid,
  Divider,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Send as SendIcon,
  CheckCircle,
  Error as ErrorIcon,
  Pending,
  Refresh as RefreshIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import api from '../services/api';

interface SMTPSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

interface EmailFromSettings {
  email: string;
  name: string;
}

interface QueueStatus {
  statusCounts: {
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    cancelled?: number;
  };
  recentActivity: {
    sent24h: number;
    failed24h: number;
  };
  recentEmails?: Array<{
    id: number;
    recipient_email: string;
    subject: string;
    status: string;
    created_at: string;
    sent_at: string | null;
    error_message: string | null;
  }>;
}

const EmailSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);

  const [smtpSettings, setSmtpSettings] = useState<SMTPSettings>({
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: ''
  });

  const [fromSettings, setFromSettings] = useState<EmailFromSettings>({
    email: 'noreply@proxmox-multi-tenant.local',
    name: 'Proxmox Multi-Tenant'
  });

  const [testEmail, setTestEmail] = useState('');
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
    loadQueueStatus();

    // Refresh queue status every 30 seconds
    const interval = setInterval(loadQueueStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      // Load SMTP settings
      const smtpResponse = await api.get('/email/smtp/settings');
      if (smtpResponse.data.data) {
        setSmtpSettings({ ...smtpSettings, ...smtpResponse.data.data, password: '' });
      }

      // Load From settings
      const fromResponse = await api.get('/email/from/settings');
      if (fromResponse.data.data) {
        setFromSettings(fromResponse.data.data);
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      showAlert('error', 'Failed to load email settings');
    } finally {
      setLoading(false);
    }
  };

  const loadQueueStatus = async () => {
    try {
      const response = await api.get('/email/queue/status');
      setQueueStatus(response.data.data);
    } catch (error) {
      console.error('Error loading queue status:', error);
    }
  };

  const handleSaveSMTP = async () => {
    try {
      setLoading(true);
      await api.put('/email/smtp/settings', smtpSettings);
      showAlert('success', 'SMTP settings saved successfully');
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to save SMTP settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFrom = async () => {
    try {
      setLoading(true);
      await api.put('/email/from/settings', fromSettings);
      showAlert('success', 'Email from settings saved successfully');
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to save email from settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const response = await api.post('/email/smtp/test', smtpSettings);
      if (response.data.success) {
        showAlert('success', 'SMTP connection successful!');
      } else {
        showAlert('error', `Connection failed: ${response.data.message}`);
      }
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      showAlert('error', 'Please enter a recipient email address');
      return;
    }

    try {
      setSendingTest(true);
      const response = await api.post('/email/send-test', { recipient: testEmail });
      showAlert('success', response.data.message || 'Test email sent successfully!');
      setTestEmail('');
      // Refresh queue status to show the new email
      setTimeout(loadQueueStatus, 1000);
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  const handleProcessQueue = async () => {
    try {
      setProcessingQueue(true);
      const response = await api.post('/email/queue/process');
      showAlert('success', response.data.message);
      loadQueueStatus();
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to process queue');
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      const response = await api.post('/email/queue/retry-failed');
      showAlert('success', response.data.message);
      loadQueueStatus();
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to retry failed emails');
    }
  };

  const handleCleanup = async () => {
    try {
      const response = await api.post('/email/queue/cleanup');
      showAlert('success', response.data.message);
      loadQueueStatus();
    } catch (error: any) {
      showAlert('error', error.response?.data?.message || 'Failed to cleanup old emails');
    }
  };

  const showAlert = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        <EmailIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Email Settings
      </Typography>

      {alert && (
        <Alert severity={alert.type} sx={{ mb: 3 }} onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* SMTP Configuration */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                SMTP Server Configuration
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="SMTP Host"
                    value={smtpSettings.host}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    helperText="SMTP server hostname"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Port"
                    type="number"
                    value={smtpSettings.port}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, port: parseInt(e.target.value) })}
                    helperText="587 for TLS, 465 for SSL"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={smtpSettings.secure}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                      />
                    }
                    label="Use SSL/TLS (Port 465)"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={smtpSettings.username}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, username: e.target.value })}
                    placeholder="your-email@example.com"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={smtpSettings.password}
                    onChange={(e) => setSmtpSettings({ ...smtpSettings, password: e.target.value })}
                    placeholder="Enter password (or leave empty to keep existing)"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleSaveSMTP}
                      disabled={loading || !smtpSettings.host || !smtpSettings.username}
                    >
                      {loading ? <CircularProgress size={24} /> : 'Save SMTP Settings'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleTestConnection}
                      disabled={testingConnection || !smtpSettings.host || !smtpSettings.username}
                      startIcon={<SendIcon />}
                    >
                      {testingConnection ? <CircularProgress size={24} /> : 'Test Connection'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Default From Settings */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Default From Email
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="From Email"
                    type="email"
                    value={fromSettings.email}
                    onChange={(e) => setFromSettings({ ...fromSettings, email: e.target.value })}
                    placeholder="noreply@example.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="From Name"
                    value={fromSettings.name}
                    onChange={(e) => setFromSettings({ ...fromSettings, name: e.target.value })}
                    placeholder="System Name"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    onClick={handleSaveFrom}
                    disabled={loading || !fromSettings.email || !fromSettings.name}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Save From Settings'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Test Email */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Send Test Email
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Recipient Email"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    onClick={handleSendTest}
                    disabled={sendingTest || !testEmail}
                    startIcon={<SendIcon />}
                    sx={{ height: '56px' }}
                  >
                    {sendingTest ? <CircularProgress size={24} /> : 'Send Test'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Queue Status */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Email Queue Status
                </Typography>
                <Button size="small" onClick={loadQueueStatus} startIcon={<RefreshIcon />}>
                  Refresh
                </Button>
              </Box>
              <Divider sx={{ mb: 3 }} />

              {queueStatus && (
                <Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip icon={<Pending />} label="Pending" size="small" />
                      <Typography variant="h6">{queueStatus.statusCounts.pending}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip icon={<SendIcon />} label="Sending" size="small" color="info" />
                      <Typography variant="h6">{queueStatus.statusCounts.sending}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip icon={<CheckCircle />} label="Sent" size="small" color="success" />
                      <Typography variant="h6">{queueStatus.statusCounts.sent}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip icon={<ErrorIcon />} label="Failed" size="small" color="error" />
                      <Typography variant="h6">{queueStatus.statusCounts.failed}</Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" gutterBottom>
                    Last 24 Hours
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Sent:</Typography>
                    <Typography variant="body2" color="success.main">
                      {queueStatus.recentActivity.sent24h}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant="body2">Failed:</Typography>
                    <Typography variant="body2" color="error.main">
                      {queueStatus.recentActivity.failed24h}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      size="small"
                      onClick={handleProcessQueue}
                      disabled={processingQueue}
                      startIcon={<SendIcon />}
                    >
                      {processingQueue ? <CircularProgress size={20} /> : 'Process Queue Now'}
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={handleRetryFailed}
                    >
                      Retry Failed
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      color="warning"
                      onClick={handleCleanup}
                    >
                      Cleanup Old Emails
                    </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Emails */}
        {queueStatus?.recentEmails && queueStatus.recentEmails.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Emails
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Recipient</TableCell>
                        <TableCell>Subject</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Sent</TableCell>
                        <TableCell>Error</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {queueStatus.recentEmails.map((email) => (
                        <TableRow key={email.id}>
                          <TableCell>{email.recipient_email}</TableCell>
                          <TableCell>{email.subject}</TableCell>
                          <TableCell>
                            <Chip
                              label={email.status}
                              size="small"
                              color={
                                email.status === 'sent' ? 'success' :
                                email.status === 'failed' ? 'error' :
                                email.status === 'sending' ? 'info' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>{formatDate(email.created_at)}</TableCell>
                          <TableCell>{formatDate(email.sent_at)}</TableCell>
                          <TableCell>
                            {email.error_message && (
                              <Typography variant="caption" color="error">
                                {email.error_message.substring(0, 50)}...
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default EmailSettingsPage;
