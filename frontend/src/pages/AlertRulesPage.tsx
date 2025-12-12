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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Grid,
  FormControlLabel,
  Switch,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import EmergencyIcon from '@mui/icons-material/LocalHospital';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface AlertRule {
  id: number;
  name: string;
  description: string | null;
  company_id: number | null;
  rule_type: 'threshold' | 'anomaly' | 'availability' | 'performance';
  metric_type: 'cpu' | 'memory' | 'disk' | 'network' | 'load' | 'uptime';
  condition_operator: 'GT' | 'LT' | 'GTE' | 'LTE' | 'EQ' | 'NE';
  threshold_value: number;
  duration_minutes: number | null;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  target_type: 'vm' | 'cluster' | 'node' | 'company';
  target_id: number | null;
  enabled: boolean | null;
  notify_email: boolean | null;
  notify_slack: boolean | null;
  notify_webhook: boolean | null;
  notify_sms: boolean | null;
  notification_channels: string | null;
  cooldown_minutes: number | null;
  created_at: string;
  updated_at: string;
  companies?: {
    id: number;
    name: string;
  };
  users?: {
    id: number;
    email: string;
  };
  alert_history?: Array<{
    id: number;
    triggered_at: string;
    resolved_at: string | null;
    status: string;
    current_value: number;
    threshold_value: number;
    message: string;
  }>;
}

const AlertRulesPage: React.FC = () => {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [filteredRules, setFilteredRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<AlertRule | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set());

  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterTargetType, setFilterTargetType] = useState<string>('');
  const [filterMetricType, setFilterMetricType] = useState<string>('');
  const [filterEnabled, setFilterEnabled] = useState<string>('');

  const [companies, setCompanies] = useState<any[]>([]);
  const [availableTargets, setAvailableTargets] = useState<any[]>([]);

  const user = useAuthStore((state) => state.user);
  const userRole = user?.role || 'user';

  const [formData, setFormData] = useState<any>({
    target_company_id: '',
    name: '',
    description: '',
    rule_type: 'threshold',
    metric_type: 'cpu',
    condition_operator: 'GT',
    threshold_value: 80,
    duration_minutes: 5,
    severity: 'warning',
    target_type: 'vm',
    target_id: '',
    enabled: true,
    notify_email: true,
    notify_slack: false,
    notify_webhook: false,
    notify_sms: false,
    notification_channels: '',
    cooldown_minutes: 60,
  });

  useEffect(() => {
    loadRules();
    if (userRole === 'super_admin') {
      loadCompanies();
    }
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rules, filterSeverity, filterTargetType, filterMetricType, filterEnabled]);

  useEffect(() => {
    if (formData.target_type) {
      loadAvailableTargets(formData.target_type);
    }
  }, [formData.target_type]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/alert-rules');
      setRules(response.data.data || []);
    } catch (error: any) {
      console.error('Error loading alert rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies/list');
      setCompanies(response.data.data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const loadAvailableTargets = async (targetType: string) => {
    try {
      const response = await api.get(`/alert-rules/available-targets?target_type=${targetType}`);
      setAvailableTargets(response.data.data || []);
    } catch (error) {
      console.error('Error loading targets:', error);
      setAvailableTargets([]);
    }
  };

  const applyFilters = () => {
    let filtered = [...rules];

    if (filterSeverity) {
      filtered = filtered.filter((rule) => rule.severity === filterSeverity);
    }

    if (filterTargetType) {
      filtered = filtered.filter((rule) => rule.target_type === filterTargetType);
    }

    if (filterMetricType) {
      filtered = filtered.filter((rule) => rule.metric_type === filterMetricType);
    }

    if (filterEnabled !== '') {
      const isEnabled = filterEnabled === 'true';
      filtered = filtered.filter((rule) => rule.enabled === isEnabled);
    }

    setFilteredRules(filtered);
  };

  const handleOpenDialog = (rule?: AlertRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        target_company_id: rule.company_id || '',
        name: rule.name,
        description: rule.description || '',
        rule_type: rule.rule_type,
        metric_type: rule.metric_type,
        condition_operator: rule.condition_operator,
        threshold_value: rule.threshold_value,
        duration_minutes: rule.duration_minutes || 5,
        severity: rule.severity,
        target_type: rule.target_type,
        target_id: rule.target_id || '',
        enabled: rule.enabled || false,
        notify_email: rule.notify_email || false,
        notify_slack: rule.notify_slack || false,
        notify_webhook: rule.notify_webhook || false,
        notify_sms: rule.notify_sms || false,
        notification_channels: rule.notification_channels || '',
        cooldown_minutes: rule.cooldown_minutes || 60,
      });
    } else {
      setEditingRule(null);
      setFormData({
        target_company_id: '',
        name: '',
        description: '',
        rule_type: 'threshold',
        metric_type: 'cpu',
        condition_operator: 'GT',
        threshold_value: 80,
        duration_minutes: 5,
        severity: 'warning',
        target_type: 'vm',
        target_id: '',
        enabled: true,
        notify_email: true,
        notify_slack: false,
        notify_webhook: false,
        notify_sms: false,
        notification_channels: '',
        cooldown_minutes: 60,
      });
    }
    setOpenDialog(true);
    setActiveTab(0);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRule(null);
  };

  const handleSaveRule = async () => {
    try {
      if (editingRule) {
        await api.put(`/alert-rules/${editingRule.id}`, formData);
      } else {
        await api.post('/alert-rules', formData);
      }
      loadRules();
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error saving alert rule:', error);
      alert(error.message || 'Failed to save alert rule');
    }
  };

  const handleDeleteClick = (rule: AlertRule) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!ruleToDelete) return;

    try {
      await api.delete(`/alert-rules/${ruleToDelete.id}`);
      loadRules();
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    } catch (error: any) {
      console.error('Error deleting alert rule:', error);
      alert(error.message || 'Failed to delete alert rule');
    }
  };

  const handleToggleEnabled = async (rule: AlertRule) => {
    try {
      await api.patch(`/alert-rules/${rule.id}/toggle-enabled`);
      loadRules();
    } catch (error: any) {
      console.error('Error toggling alert rule:', error);
      alert(error.message || 'Failed to toggle alert rule');
    }
  };

  const toggleExpanded = (ruleId: number) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
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
        return <EmergencyIcon sx={{ color: '#d32f2f' }} />;
      default:
        return <InfoIcon />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info':
        return 'info';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      case 'emergency':
        return 'error';
      default:
        return 'default';
    }
  };

  const getOperatorLabel = (operator: string) => {
    const labels: any = {
      GT: '>',
      LT: '<',
      GTE: '>=',
      LTE: '<=',
      EQ: '==',
      NE: '!=',
    };
    return labels[operator] || operator;
  };

  const getMetricLabel = (metric: string) => {
    const labels: any = {
      cpu: 'CPU Usage',
      memory: 'Memory Usage',
      disk: 'Disk Usage',
      network: 'Network Traffic',
      load: 'System Load',
      uptime: 'Uptime',
    };
    return labels[metric] || metric.toUpperCase();
  };

  const getMetricUnit = (metric: string) => {
    const units: any = {
      cpu: '%',
      memory: '%',
      disk: '%',
      network: 'MB/s',
      load: '',
      uptime: 'hours',
    };
    return units[metric] || '';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Alert Rules</Typography>
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Create Alert Rule
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Severity</InputLabel>
              <Select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} label="Severity">
                <MenuItem value="">All</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
                <MenuItem value="emergency">Emergency</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Target Type</InputLabel>
              <Select value={filterTargetType} onChange={(e) => setFilterTargetType(e.target.value)} label="Target Type">
                <MenuItem value="">All</MenuItem>
                <MenuItem value="vm">Virtual Machine</MenuItem>
                <MenuItem value="cluster">Cluster</MenuItem>
                <MenuItem value="node">Node</MenuItem>
                <MenuItem value="company">Company</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Metric Type</InputLabel>
              <Select value={filterMetricType} onChange={(e) => setFilterMetricType(e.target.value)} label="Metric Type">
                <MenuItem value="">All</MenuItem>
                <MenuItem value="cpu">CPU</MenuItem>
                <MenuItem value="memory">Memory</MenuItem>
                <MenuItem value="disk">Disk</MenuItem>
                <MenuItem value="network">Network</MenuItem>
                <MenuItem value="load">Load</MenuItem>
                <MenuItem value="uptime">Uptime</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={filterEnabled} onChange={(e) => setFilterEnabled(e.target.value)} label="Status">
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Enabled</MenuItem>
                <MenuItem value="false">Disabled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Alert Rules Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="50"></TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Metric</TableCell>
              <TableCell>Condition</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Severity</TableCell>
              {userRole === 'super_admin' && <TableCell>Company</TableCell>}
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={userRole === 'super_admin' ? 9 : 8} align="center">
                  {loading ? 'Loading...' : 'No alert rules found'}
                </TableCell>
              </TableRow>
            ) : (
              filteredRules.map((rule) => (
                <React.Fragment key={rule.id}>
                  <TableRow>
                    <TableCell>
                      <IconButton size="small" onClick={() => toggleExpanded(rule.id)}>
                        <ExpandMoreIcon
                          sx={{
                            transform: expandedRules.has(rule.id) ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: '0.3s',
                          }}
                        />
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {rule.name}
                      </Typography>
                      {rule.description && (
                        <Typography variant="caption" color="text.secondary">
                          {rule.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={getMetricLabel(rule.metric_type)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {getOperatorLabel(rule.condition_operator)} {rule.threshold_value}
                      {getMetricUnit(rule.metric_type)}
                    </TableCell>
                    <TableCell>
                      <Chip label={rule.target_type.toUpperCase()} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getSeverityIcon(rule.severity)}
                        label={rule.severity.toUpperCase()}
                        size="small"
                        color={getSeverityColor(rule.severity) as any}
                      />
                    </TableCell>
                    {userRole === 'super_admin' && <TableCell>{rule.companies?.name || 'All Companies'}</TableCell>}
                    <TableCell>
                      <IconButton size="small" onClick={() => handleToggleEnabled(rule)} color={rule.enabled ? 'success' : 'default'}>
                        {rule.enabled ? <NotificationsActiveIcon /> : <NotificationsOffIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleOpenDialog(rule)} color="primary">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteClick(rule)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  {expandedRules.has(rule.id) && (
                    <TableRow>
                      <TableCell colSpan={userRole === 'super_admin' ? 9 : 8}>
                        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                              <Typography variant="subtitle2" gutterBottom>
                                Alert Configuration
                              </Typography>
                              <Typography variant="body2">Duration: {rule.duration_minutes || 5} minutes</Typography>
                              <Typography variant="body2">Cooldown: {rule.cooldown_minutes || 60} minutes</Typography>
                              <Typography variant="body2">Rule Type: {rule.rule_type}</Typography>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Typography variant="subtitle2" gutterBottom>
                                Notification Channels
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {rule.notify_email && <Chip label="Email" size="small" color="primary" />}
                                {rule.notify_slack && <Chip label="Slack" size="small" color="secondary" />}
                                {rule.notify_webhook && <Chip label="Webhook" size="small" color="info" />}
                                {rule.notify_sms && <Chip label="SMS" size="small" color="warning" />}
                              </Box>
                            </Grid>
                            {rule.alert_history && rule.alert_history.length > 0 && (
                              <Grid item xs={12}>
                                <Typography variant="subtitle2" gutterBottom>
                                  Recent Alerts (Last 5)
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  {rule.alert_history.map((alert) => (
                                    <Typography key={alert.id} variant="caption">
                                      {new Date(alert.triggered_at).toLocaleString()} - Current: {alert.current_value} / Threshold: {alert.threshold_value} - {alert.status}
                                    </Typography>
                                  ))}
                                </Box>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}</DialogTitle>
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)} sx={{ mb: 2, mt: 1 }}>
            <Tab label="Basic Info" />
            <Tab label="Condition" />
            <Tab label="Notifications" />
          </Tabs>

          {/* Tab 0: Basic Info */}
          {activeTab === 0 && (
            <Grid container spacing={2}>
              {userRole === 'super_admin' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Company (Optional)</InputLabel>
                    <Select
                      value={formData.target_company_id}
                      onChange={(e) => setFormData({ ...formData, target_company_id: e.target.value })}
                      label="Company (Optional)"
                    >
                      <MenuItem value="">All Companies</MenuItem>
                      {companies.map((company) => (
                        <MenuItem key={company.id} value={company.id}>
                          {company.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  label="Rule Name"
                  fullWidth
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Rule Type</InputLabel>
                  <Select
                    value={formData.rule_type}
                    onChange={(e) => setFormData({ ...formData, rule_type: e.target.value })}
                    label="Rule Type"
                  >
                    <MenuItem value="threshold">Threshold</MenuItem>
                    <MenuItem value="anomaly">Anomaly Detection</MenuItem>
                    <MenuItem value="availability">Availability</MenuItem>
                    <MenuItem value="performance">Performance</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    label="Severity"
                  >
                    <MenuItem value="info">Info</MenuItem>
                    <MenuItem value="warning">Warning</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                    <MenuItem value="emergency">Emergency</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    />
                  }
                  label="Enable Alert Rule"
                />
              </Grid>
            </Grid>
          )}

          {/* Tab 1: Condition */}
          {activeTab === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Metric Type</InputLabel>
                  <Select
                    value={formData.metric_type}
                    onChange={(e) => setFormData({ ...formData, metric_type: e.target.value })}
                    label="Metric Type"
                  >
                    <MenuItem value="cpu">CPU Usage (%)</MenuItem>
                    <MenuItem value="memory">Memory Usage (%)</MenuItem>
                    <MenuItem value="disk">Disk Usage (%)</MenuItem>
                    <MenuItem value="network">Network Traffic (MB/s)</MenuItem>
                    <MenuItem value="load">System Load</MenuItem>
                    <MenuItem value="uptime">Uptime (hours)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Condition</InputLabel>
                  <Select
                    value={formData.condition_operator}
                    onChange={(e) => setFormData({ ...formData, condition_operator: e.target.value })}
                    label="Condition"
                  >
                    <MenuItem value="GT">Greater Than (&gt;)</MenuItem>
                    <MenuItem value="GTE">Greater Than or Equal (&gt;=)</MenuItem>
                    <MenuItem value="LT">Less Than (&lt;)</MenuItem>
                    <MenuItem value="LTE">Less Than or Equal (&lt;=)</MenuItem>
                    <MenuItem value="EQ">Equal (==)</MenuItem>
                    <MenuItem value="NE">Not Equal (!=)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Threshold Value"
                  type="number"
                  fullWidth
                  required
                  value={formData.threshold_value}
                  onChange={(e) => setFormData({ ...formData, threshold_value: parseFloat(e.target.value) })}
                  inputProps={{ step: 0.1 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Duration (minutes)"
                  type="number"
                  fullWidth
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                  helperText="Alert triggers after condition persists for this duration"
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Target Type</InputLabel>
                  <Select
                    value={formData.target_type}
                    onChange={(e) => setFormData({ ...formData, target_type: e.target.value, target_id: '' })}
                    label="Target Type"
                  >
                    <MenuItem value="vm">Virtual Machine</MenuItem>
                    <MenuItem value="cluster">Cluster</MenuItem>
                    <MenuItem value="node">Node</MenuItem>
                    <MenuItem value="company">Company</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Target (Optional)</InputLabel>
                  <Select
                    value={formData.target_id}
                    onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                    label="Target (Optional)"
                  >
                    <MenuItem value="">All {formData.target_type}s</MenuItem>
                    {availableTargets.map((target) => (
                      <MenuItem key={target.id} value={target.id}>
                        {target.name || target.host || `ID: ${target.id}`}
                        {target.companies?.name && ` (${target.companies.name})`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Cooldown Period (minutes)"
                  type="number"
                  fullWidth
                  value={formData.cooldown_minutes}
                  onChange={(e) => setFormData({ ...formData, cooldown_minutes: parseInt(e.target.value) })}
                  helperText="Minimum time between alert notifications for the same condition"
                  inputProps={{ min: 1 }}
                />
              </Grid>
            </Grid>
          )}

          {/* Tab 2: Notifications */}
          {activeTab === 2 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notify_email}
                      onChange={(e) => setFormData({ ...formData, notify_email: e.target.checked })}
                    />
                  }
                  label="Send Email Notifications"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notify_slack}
                      onChange={(e) => setFormData({ ...formData, notify_slack: e.target.checked })}
                    />
                  }
                  label="Send Slack Notifications"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notify_webhook}
                      onChange={(e) => setFormData({ ...formData, notify_webhook: e.target.checked })}
                    />
                  }
                  label="Send Webhook Notifications"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.notify_sms}
                      onChange={(e) => setFormData({ ...formData, notify_sms: e.target.checked })}
                    />
                  }
                  label="Send SMS Notifications"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Notification Channels (JSON)"
                  fullWidth
                  multiline
                  rows={4}
                  value={formData.notification_channels}
                  onChange={(e) => setFormData({ ...formData, notification_channels: e.target.value })}
                  helperText='Example: {"slack_webhook":"https://...","email":"admin@example.com"}'
                />
              </Grid>
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    Configure notification endpoints in the system settings. Alerts will be sent via enabled channels when the rule triggers.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveRule} variant="contained" color="primary">
            {editingRule ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete the alert rule "{ruleToDelete?.name}"?</Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. Alert history will be preserved.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AlertRulesPage;
