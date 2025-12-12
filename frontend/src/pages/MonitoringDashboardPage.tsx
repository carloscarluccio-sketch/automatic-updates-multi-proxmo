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
  MenuItem,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface MonitoringStats {
  total_rules: number;
  enabled_rules: number;
  triggered_alerts_24h: number;
  active_alerts: number;
  resolved_alerts_24h: number;
  severity_breakdown: {
    info: number;
    warning: number;
    critical: number;
    emergency: number;
  };
  metric_type_breakdown: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
    uptime: number;
  };
}

interface Alert {
  id: number;
  alert_rule_id: number;
  company_id: number | null;
  target_type: string;
  target_id: number;
  target_name: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  metric_type: string;
  current_value: number;
  threshold_value: number;
  message: string;
  status: 'triggered' | 'acknowledged' | 'resolved' | 'auto_resolved';
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by: number | null;
  resolved_at: string | null;
  resolved_by: number | null;
  resolution_note: string | null;
  notifications_sent: boolean | null;
  alert_rules?: {
    id: number;
    name: string;
    description: string | null;
  };
  acknowledged_user?: {
    id: number;
    email: string;
  };
  resolved_user?: {
    id: number;
    email: string;
  };
}

const MonitoringDashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolvingAlert, setResolvingAlert] = useState<Alert | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  }, [filterStatus, filterSeverity]);

  const loadData = async () => {
    try {
      setRefreshing(true);
      const [statsRes, alertsRes] = await Promise.all([
        api.get<{ success: boolean; data: MonitoringStats }>('/monitoring/stats'),
        api.get<{ success: boolean; data: Alert[] }>('/monitoring/recent-alerts', {
          params: {
            status: filterStatus === 'all' ? undefined : filterStatus,
            severity: filterSeverity || undefined,
            limit: 100,
          },
        }),
      ]);

      setStats(statsRes.data.data);
      setAlerts(alertsRes.data.data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error loading monitoring data:', err);
      setError(err.response?.data?.message || 'Failed to load monitoring data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualTrigger = async () => {
    if (!user || user.role !== 'super_admin') {
      setError('Only super administrators can manually trigger monitoring');
      return;
    }

    try {
      setTriggering(true);
      const res = await api.post<{ success: boolean; message: string }>('/monitoring/trigger');
      setSuccessMessage(res.data.message || 'Monitoring cycle started');
      setTimeout(() => loadData(), 3000); // Refresh after 3 seconds
    } catch (err: any) {
      console.error('Error triggering monitoring:', err);
      setError(err.response?.data?.message || 'Failed to trigger monitoring');
    } finally {
      setTriggering(false);
    }
  };

  const handleAcknowledge = async (alertId: number) => {
    try {
      await api.patch(`/monitoring/alerts/${alertId}/acknowledge`);
      setSuccessMessage('Alert acknowledged successfully');
      loadData();
    } catch (err: any) {
      console.error('Error acknowledging alert:', err);
      setError(err.response?.data?.message || 'Failed to acknowledge alert');
    }
  };

  const handleResolveClick = (alert: Alert) => {
    setResolvingAlert(alert);
    setResolutionNote('');
    setResolveDialogOpen(true);
  };

  const handleResolveConfirm = async () => {
    if (!resolvingAlert) return;

    try {
      await api.patch(`/monitoring/alerts/${resolvingAlert.id}/resolve`, {
        resolution_note: resolutionNote || 'Manually resolved',
      });
      setSuccessMessage('Alert resolved successfully');
      setResolveDialogOpen(false);
      setResolvingAlert(null);
      setResolutionNote('');
      loadData();
    } catch (err: any) {
      console.error('Error resolving alert:', err);
      setError(err.response?.data?.message || 'Failed to resolve alert');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'info':
        return <InfoIcon color="info" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'emergency':
        return <ErrorIcon sx={{ color: '#d32f2f' }} />;
      default:
        return <InfoIcon />;
    }
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'warning' => {
    switch (status) {
      case 'triggered':
        return 'warning';
      case 'acknowledged':
        return 'primary';
      case 'resolved':
      case 'auto_resolved':
        return 'success';
      default:
        return 'default';
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
          <NotificationsActiveIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Resource Monitoring Dashboard
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
          {user?.role === 'super_admin' && (
            <Button
              variant="contained"
              color="primary"
              startIcon={triggering ? <CircularProgress size={20} /> : <PlayArrowIcon />}
              onClick={handleManualTrigger}
              disabled={triggering}
            >
              Trigger Monitoring
            </Button>
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

      {/* Statistics Cards */}
      {stats && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Total Alert Rules
                </Typography>
                <Typography variant="h4">{stats.total_rules}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {stats.enabled_rules} enabled
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Active Alerts
                </Typography>
                <Typography variant="h4" color="error">
                  {stats.active_alerts}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Requiring attention
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Triggered (24h)
                </Typography>
                <Typography variant="h4">{stats.triggered_alerts_24h}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Last 24 hours
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom variant="body2">
                  Resolved (24h)
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.resolved_alerts_24h}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Last 24 hours
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Status Filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              size="small"
            >
              <MenuItem value="all">All Alerts</MenuItem>
              <MenuItem value="active">Active (Triggered + Acknowledged)</MenuItem>
              <MenuItem value="triggered">Triggered Only</MenuItem>
              <MenuItem value="acknowledged">Acknowledged Only</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Severity Filter"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              size="small"
            >
              <MenuItem value="">All Severities</MenuItem>
              <MenuItem value="info">Info</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="emergency">Emergency</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="body2" color="textSecondary">
              Showing {alerts.length} alert(s)
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Alerts Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Severity</TableCell>
              <TableCell>Alert Rule</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Metric</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Triggered</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="textSecondary" py={3}>
                    No alerts found matching the selected filters
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              alerts.map((alert) => (
                <TableRow key={alert.id} hover>
                  <TableCell>
                    <Tooltip title={alert.severity.toUpperCase()}>
                      {getSeverityIcon(alert.severity)}
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {alert.alert_rules?.name || `Rule #${alert.alert_rule_id}`}
                    </Typography>
                    {alert.message && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        {alert.message}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {alert.target_type}: {alert.target_name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={alert.metric_type.toUpperCase()} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium" color="error">
                      {alert.current_value.toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Threshold: {alert.threshold_value}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={alert.status.toUpperCase()}
                      size="small"
                      color={getStatusColor(alert.status)}
                    />
                    {alert.notifications_sent && (
                      <Tooltip title="Email notification sent">
                        <CheckCircleIcon fontSize="small" color="success" sx={{ ml: 0.5 }} />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatDate(alert.triggered_at)}</Typography>
                    {alert.acknowledged_at && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        Ack: {formatDate(alert.acknowledged_at)}
                      </Typography>
                    )}
                    {alert.resolved_at && (
                      <Typography variant="caption" color="success.main" display="block">
                        Resolved: {formatDate(alert.resolved_at)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5}>
                      {alert.status === 'triggered' && (
                        <Tooltip title="Acknowledge">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleAcknowledge(alert.id)}
                          >
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(alert.status === 'triggered' || alert.status === 'acknowledged') && (
                        <Tooltip title="Resolve">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleResolveClick(alert)}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onClose={() => setResolveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Resolve Alert</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" mb={2}>
            Are you sure you want to resolve this alert? You can optionally add a resolution note.
          </Typography>
          {resolvingAlert && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium">
                {resolvingAlert.alert_rules?.name || `Alert #${resolvingAlert.id}`}
              </Typography>
              <Typography variant="caption">{resolvingAlert.message}</Typography>
            </Alert>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Resolution Note (Optional)"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="e.g., Issue fixed, VM resources optimized, false positive"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleResolveConfirm} variant="contained" color="success">
            Resolve Alert
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MonitoringDashboardPage;
