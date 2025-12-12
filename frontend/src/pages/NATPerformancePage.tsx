import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Card, CardContent, Grid, CircularProgress, Chip, Alert } from '@mui/material';
import SpeedIcon from '@mui/icons-material/Speed';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface NATPerformanceStats {
  overall: {
    totalDeployments: number;
    successfulDeployments: number;
    failedDeployments: number;
    successRate: number;
  };
  authMethodStats: {
    sshKey: {
      count: number;
      averageDurationMs: number;
      averageDurationSeconds: string;
    };
    password: {
      count: number;
      averageDurationMs: number;
      averageDurationSeconds: string;
    };
    performanceImprovement: {
      percentage: number;
      timeSavedMs: number;
      message: string;
    };
  };
  recentDeployments: any[];
}

export const NATPerformancePage: React.FC = () => {
  const [stats, setStats] = useState<NATPerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/nat/performance-stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load NAT performance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (currentUser?.role !== 'super_admin') {
    return (
      <Container>
        <Typography variant="h5" color="error">Access Denied</Typography>
        <Typography>Only super administrators can view NAT performance metrics.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SpeedIcon fontSize="large" /> NAT Deployment Performance
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Performance metrics and analytics for NAT rule deployments
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : stats ? (
        <Grid container spacing={3}>
          {/* Overall Stats */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Overall Deployment Statistics</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">Total Deployments</Typography>
                    <Typography variant="h4">{stats.overall.totalDeployments}</Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">Successful</Typography>
                    <Typography variant="h4" color="success.main">{stats.overall.successfulDeployments}</Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">Failed</Typography>
                    <Typography variant="h4" color="error.main">{stats.overall.failedDeployments}</Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body2" color="text.secondary">Success Rate</Typography>
                    <Typography variant="h4">{stats.overall.successRate.toFixed(1)}%</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Auth Method Comparison */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%', bgcolor: '#e8f5e9' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🔑 SSH Key Authentication
                </Typography>
                <Typography variant="h3" color="success.main">{stats.authMethodStats.sshKey.averageDurationSeconds}s</Typography>
                <Typography variant="body2" color="text.secondary">Average Deployment Time</Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>{stats.authMethodStats.sshKey.count} deployments</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%', bgcolor: '#fff3e0' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🔐 Password Authentication
                </Typography>
                <Typography variant="h3" color="warning.main">{stats.authMethodStats.password.averageDurationSeconds}s</Typography>
                <Typography variant="body2" color="text.secondary">Average Deployment Time</Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>{stats.authMethodStats.password.count} deployments</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Performance Improvement */}
          <Grid item xs={12}>
            <Card sx={{ bgcolor: '#f1f8ff', border: '2px solid #2196f3' }}>
              <CardContent>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🚀 {stats.authMethodStats.performanceImprovement.message}
                </Typography>
                <Typography variant="h3" color="primary.main">{stats.authMethodStats.performanceImprovement.percentage}%</Typography>
                <Typography variant="body1" color="text.secondary">
                  Time saved per deployment: {(stats.authMethodStats.performanceImprovement.timeSavedMs / 1000).toFixed(2)} seconds
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Deployments */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Recent Deployments (Last 7 Days)</Typography>
                {stats.recentDeployments.length === 0 ? (
                  <Alert severity="info">No recent deployments found</Alert>
                ) : (
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {stats.recentDeployments.map((deployment: any, index: number) => (
                      <Box key={index} sx={{ mb: 2, p: 2, bgcolor: deployment.success ? '#f1f8e9' : '#ffebee', borderRadius: 1 }}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={3}>
                            <Typography variant="body2" color="text.secondary">Cluster</Typography>
                            <Typography variant="body1">{deployment.cluster?.name || 'Unknown'}</Typography>
                          </Grid>
                          <Grid item xs={2}>
                            <Typography variant="body2" color="text.secondary">Type</Typography>
                            <Chip label={deployment.deploymentType} size="small" />
                          </Grid>
                          <Grid item xs={2}>
                            <Typography variant="body2" color="text.secondary">Auth Method</Typography>
                            <Chip label={deployment.authMethod === 'ssh_key' ? 'SSH Key' : 'Password'} size="small" color={deployment.authMethod === 'ssh_key' ? 'success' : 'warning'} />
                          </Grid>
                          <Grid item xs={2}>
                            <Typography variant="body2" color="text.secondary">Duration</Typography>
                            <Typography variant="body1">{deployment.durationSeconds}s</Typography>
                          </Grid>
                          <Grid item xs={2}>
                            <Typography variant="body2" color="text.secondary">Status</Typography>
                            <Chip label={deployment.success ? 'Success' : 'Failed'} size="small" color={deployment.success ? 'success' : 'error'} />
                          </Grid>
                          <Grid item xs={1}>
                            <Typography variant="caption" color="text.secondary">{new Date(deployment.deployedAt).toLocaleDateString()}</Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : (
        <Typography>No performance data available</Typography>
      )}
    </Container>
  );
};
