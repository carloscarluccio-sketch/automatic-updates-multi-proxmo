import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  SelectChangeEvent,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MemoryIcon from '@mui/icons-material/Memory';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import ComputerIcon from '@mui/icons-material/Computer';
import api from '../services/api';

interface VMMetric {
  vm_id: number;
  vm_name: string;
  vmid: number;
  company_name: string;
  cpu_usage: number;
  memory_usage: number;
  memory_used_mb: number;
  memory_total_mb: number;
  disk_used_gb: number;
  disk_total_gb: number;
  network_in_mb: number;
  network_out_mb: number;
  status: string;
  collected_at: string;
}

interface AnalyticsSummary {
  total_vms: number;
  running_vms: number;
  stopped_vms: number;
  avg_cpu_usage: number;
  avg_memory_usage: number;
  total_network_in_gb: number;
  total_network_out_gb: number;
}

interface ClusterAnalytics {
  total_vms: number;
  avg_cpu_usage: number;
  avg_memory_usage: number;
  total_disk_used_gb: number;
  total_network_in_gb: number;
  total_network_out_gb: number;
}

export const AnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedCluster, setSelectedCluster] = useState<string>('');
  const [clusters, setClusters] = useState<any[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [clusterAnalytics, setClusterAnalytics] = useState<ClusterAnalytics | null>(null);
  const [topConsumers, setTopConsumers] = useState<VMMetric[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [timeRange, selectedCluster]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      await Promise.all([
        loadClusters(),
        loadSummary(),
        selectedCluster ? loadClusterAnalytics() : Promise.resolve(),
        loadTopConsumers()
      ]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
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

  const loadSummary = async () => {
    try {
      const response = await api.get(`/analytics/vm/summary?timeRange=${timeRange}`);
      setSummary(response.data.data.summary || null);
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  };

  const loadClusterAnalytics = async () => {
    if (!selectedCluster) return;
    try {
      const response = await api.get(`/analytics/cluster/${selectedCluster}?timeRange=${timeRange}`);
      setClusterAnalytics(response.data.data.summary || null);
    } catch (error) {
      console.error('Failed to load cluster analytics:', error);
    }
  };

  const loadTopConsumers = async () => {
    try {
      const response = await api.get(`/analytics/top-consumers?metric=cpu&limit=10`);
      setTopConsumers(response.data.data.consumers || []);
    } catch (error) {
      console.error('Failed to load top consumers:', error);
    }
  };

  const handleTimeRangeChange = (event: SelectChangeEvent) => {
    setTimeRange(event.target.value);
  };

  const handleClusterChange = (event: SelectChangeEvent) => {
    setSelectedCluster(event.target.value);
  };

  if (loading && !summary) {
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
              Analytics Dashboard
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Real-time resource usage and performance metrics
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Cluster</InputLabel>
              <Select value={selectedCluster} label="Cluster" onChange={handleClusterChange}>
                <MenuItem value="">
                  <em>All Clusters</em>
                </MenuItem>
                {clusters.map((cluster) => (
                  <MenuItem key={cluster.id} value={cluster.id.toString()}>
                    {cluster.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Time Range</InputLabel>
              <Select value={timeRange} label="Time Range" onChange={handleTimeRangeChange}>
                <MenuItem value="1h">Last Hour</MenuItem>
                <MenuItem value="24h">Last 24 Hours</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* VM Analytics Summary */}
        {summary && (
          <>
            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              VM Resource Usage Summary
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle2" color="textSecondary">
                        CPU Usage
                      </Typography>
                    </Box>
                    <Typography variant="h4">{(Number(summary.avg_cpu_usage) || 0).toFixed(2)}%</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Average CPU Usage
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <MemoryIcon color="secondary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle2" color="textSecondary">
                        Memory Usage
                      </Typography>
                    </Box>
                    <Typography variant="h4">{(Number(summary.avg_memory_usage) || 0).toFixed(2)}%</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Average Memory Usage
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <NetworkCheckIcon color="info" sx={{ mr: 1 }} />
                      <Typography variant="subtitle2" color="textSecondary">
                        Network Traffic
                      </Typography>
                    </Box>
                    <Typography variant="h6">
                      {(summary.total_network_in_gb + summary.total_network_out_gb).toFixed(2)} GB
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      In: {summary.total_network_in_gb.toFixed(2)} GB | Out: {summary.total_network_out_gb.toFixed(2)} GB
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}

        {/* Cluster Analytics */}
        {selectedCluster && clusterAnalytics && (
          <>
            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Cluster Resource Overview
            </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <ComputerIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle2" color="textSecondary">
                        Virtual Machines
                      </Typography>
                    </Box>
                    <Typography variant="h3">{clusterAnalytics.total_vms}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Active VMs in cluster
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle2" color="textSecondary">
                        CPU Allocation
                      </Typography>
                    </Box>
                    <Typography variant="h4">{(Number(clusterAnalytics.avg_cpu_usage) || 0).toFixed(2)}%</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Average CPU Usage
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <MemoryIcon color="secondary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle2" color="textSecondary">
                        Memory Allocation
                      </Typography>
                    </Box>
                    <Typography variant="h4">{(Number(clusterAnalytics.avg_memory_usage) || 0).toFixed(2)}%</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Average Memory Usage
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}

        {/* Top Resource Consumers */}
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          Top CPU Consumers
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>VM Name</TableCell>
                <TableCell>VMID</TableCell>
                <TableCell>Company</TableCell>
                <TableCell align="right">CPU Usage</TableCell>
                <TableCell align="right">Memory Usage</TableCell>
                <TableCell align="right">Last Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topConsumers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No metrics data available
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                topConsumers.map((metric) => (
                  <TableRow key={metric.vm_id}>
                    <TableCell>{metric.vm_name}</TableCell>
                    <TableCell>
                      <Chip label={metric.vmid} size="small" />
                    </TableCell>
                    <TableCell>{metric.company_name}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${Number(metric.cpu_usage).toFixed(2)}%`}
                        color={Number(metric.cpu_usage) > 80 ? 'error' : Number(metric.cpu_usage) > 60 ? 'warning' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${Number(metric.memory_usage).toFixed(2)}%`}
                        color={Number(metric.memory_usage) > 80 ? 'error' : Number(metric.memory_usage) > 60 ? 'warning' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {new Date(metric.collected_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {summary && summary.total_vms === 0 && (
          <Alert severity="info" sx={{ mt: 3 }}>
            No metrics data available for the selected time range. Metrics are collected every 5 minutes by the backend cron job.
          </Alert>
        )}
      </Box>
    </Container>
  );
};
