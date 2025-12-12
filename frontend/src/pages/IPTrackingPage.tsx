/**
 * IP Tracking & Monitoring Dashboard
 * Phase 1.4: Real-time IP analytics and monitoring
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Tabs,
  Tab,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../services/api';

interface IPRangeUtilization {
  id: number;
  subnet: string;
  description: string | null;
  vlan_id: number | null;
  company: { id: number; name: string } | null;
  cluster: { id: number; name: string } | null;
  total_ips: number;
  used_ips: number;
  available_ips: number;
  utilization_percent: number;
  status: 'critical' | 'warning' | 'moderate' | 'healthy';
  ip_type_breakdown: {
    internal: number;
    external: number;
  };
}

interface IPConflict {
  type: 'duplicate_ip' | 'reserved_ip' | 'out_of_range';
  severity: 'critical' | 'error' | 'warning';
  ip_address: string;
  message: string;
  affected_vms?: any[];
  vm?: any;
  subnet?: string;
}

interface Analytics {
  total_assignments: number;
  by_ip_type: {
    internal: number;
    external: number;
  };
  by_company: Record<string, number>;
  by_cluster: Record<string, number>;
  by_vlan: Record<string, number>;
  by_interface: Record<string, number>;
  primary_ips: number;
  recent_assignments: {
    last_24h: number;
    last_7d: number;
    last_30d: number;
  };
}

export const IPTrackingDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [utilization, setUtilization] = useState<IPRangeUtilization[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [conflicts, setConflicts] = useState<IPConflict[]>([]);
  const [conflictSummary, setConflictSummary] = useState<any>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadUtilization(), loadConflicts(), loadAnalytics()]);
    } catch (error: any) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUtilization = async () => {
    try {
      const response = await api.get(`/ip-tracking/utilization`);
      if (response.data.success) {
        setUtilization(response.data.data.ranges);
        setSummary(response.data.data.summary);
      }
    } catch (error: any) {
      console.error('Load utilization error:', error);
    }
  };

  const loadConflicts = async () => {
    try {
      const response = await api.get('/ip-tracking/conflicts');
      if (response.data.success) {
        setConflicts(response.data.data.conflicts);
        setConflictSummary(response.data.data.summary);
      }
    } catch (error: any) {
      console.error('Load conflicts error:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await api.get('/ip-tracking/analytics');
      if (response.data.success) {
        setAnalytics(response.data.data);
      }
    } catch (error: any) {
      console.error('Load analytics error:', error);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const response = await api.get(`/ip-tracking/export?format=${format}`, {
        responseType: format === 'csv' ? 'blob' : 'json',
      });

      if (format === 'csv') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ip-assignments-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
      } else {
        const dataStr = JSON.stringify(response.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ip-assignments-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      console.error('Export error:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'moderate':
        return 'info';
      case 'healthy':
        return 'success';
      default:
        return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'error':
        return <WarningIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <CheckCircleIcon color="success" />;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">IP Tracking & Monitoring</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('csv')}
            variant="outlined"
          >
            Export CSV
          </Button>
          <Button
            startIcon={<DownloadIcon />}
            onClick={() => handleExport('json')}
            variant="outlined"
          >
            Export JSON
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total IP Ranges
                </Typography>
                <Typography variant="h4">{summary.total_ranges}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total IPs
                </Typography>
                <Typography variant="h4">{summary.total_ips.toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Used IPs
                </Typography>
                <Typography variant="h4" color="primary">
                  {summary.total_used.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {summary.average_utilization}% average utilization
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Available IPs
                </Typography>
                <Typography variant="h4" color="success.main">
                  {summary.total_available.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Conflicts Alert */}
      {conflictSummary && conflictSummary.total_conflicts > 0 && (
        <Alert severity="error" sx={{ mb: 3 }} icon={<WarningIcon />}>
          <Typography variant="subtitle1">
            <strong>{conflictSummary.total_conflicts} IP Conflicts Detected</strong>
          </Typography>
          <Typography variant="body2">
            Critical: {conflictSummary.by_severity.critical} | Errors:{' '}
            {conflictSummary.by_severity.error} | Warnings: {conflictSummary.by_severity.warning}
          </Typography>
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Utilization" />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Conflicts
                {conflictSummary && conflictSummary.total_conflicts > 0 && (
                  <Chip
                    label={conflictSummary.total_conflicts}
                    size="small"
                    color="error"
                  />
                )}
              </Box>
            }
          />
          <Tab label="Analytics" />
        </Tabs>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Utilization Tab */}
      {tabValue === 0 && (
        <Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Subnet</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Cluster</TableCell>
                  <TableCell align="right">Total IPs</TableCell>
                  <TableCell align="right">Used</TableCell>
                  <TableCell align="right">Available</TableCell>
                  <TableCell>Utilization</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {utilization.map((range) => (
                  <TableRow key={range.id}>
                    <TableCell>
                      <strong>{range.subnet}</strong>
                      {range.vlan_id && (
                        <Chip label={`VLAN ${range.vlan_id}`} size="small" sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell>{range.description || '-'}</TableCell>
                    <TableCell>{range.company?.name || '-'}</TableCell>
                    <TableCell>{range.cluster?.name || '-'}</TableCell>
                    <TableCell align="right">{range.total_ips}</TableCell>
                    <TableCell align="right">
                      <Typography color="primary">{range.used_ips}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {range.ip_type_breakdown.internal}i / {range.ip_type_breakdown.external}e
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{range.available_ips}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 100 }}>
                          <LinearProgress
                            variant="determinate"
                            value={range.utilization_percent}
                            color={getStatusColor(range.status) as any}
                          />
                        </Box>
                        <Typography variant="body2">{range.utilization_percent}%</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={range.status}
                        color={getStatusColor(range.status) as any}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Conflicts Tab */}
      {tabValue === 1 && (
        <Box>
          {conflicts.length === 0 ? (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              No IP conflicts detected. All IP assignments are valid.
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Severity</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>IP Address</TableCell>
                    <TableCell>Details</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {conflicts.map((conflict, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{getSeverityIcon(conflict.severity)}</TableCell>
                      <TableCell>
                        <Chip
                          label={conflict.type.replace('_', ' ')}
                          size="small"
                          color={conflict.severity === 'critical' ? 'error' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>
                        <strong>{conflict.ip_address}</strong>
                      </TableCell>
                      <TableCell>
                        {conflict.affected_vms && (
                          <Box>
                            {conflict.affected_vms.map((vm) => (
                              <Chip
                                key={vm.id}
                                label={`${vm.name} (${vm.vmid})`}
                                size="small"
                                sx={{ mr: 0.5, mb: 0.5 }}
                              />
                            ))}
                          </Box>
                        )}
                        {conflict.vm && (
                          <Chip
                            label={`${conflict.vm.name} (${conflict.vm.vmid})`}
                            size="small"
                          />
                        )}
                        {conflict.subnet && (
                          <Typography variant="caption">Subnet: {conflict.subnet}</Typography>
                        )}
                      </TableCell>
                      <TableCell>{conflict.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Analytics Tab */}
      {tabValue === 2 && analytics && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  IP Type Distribution
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Internal
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {analytics.by_ip_type.internal}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      External
                    </Typography>
                    <Typography variant="h4" color="secondary">
                      {analytics.by_ip_type.external}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Activity
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Last 24 hours</Typography>
                    <Chip label={analytics.recent_assignments.last_24h} size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Last 7 days</Typography>
                    <Chip label={analytics.recent_assignments.last_7d} size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Last 30 days</Typography>
                    <Chip label={analytics.recent_assignments.last_30d} size="small" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Distribution by Company
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Company</TableCell>
                        <TableCell align="right">IP Assignments</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(analytics.by_company).map(([company, count]) => (
                        <TableRow key={company}>
                          <TableCell>{company}</TableCell>
                          <TableCell align="right">
                            <Chip label={count} size="small" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export const IPTrackingPage = IPTrackingDashboard;
export default IPTrackingDashboard;
