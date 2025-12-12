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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,

  Paper,
  LinearProgress,
} from '@mui/material';
import {
  
  Business as CompanyIcon,
  People as PeopleIcon,
  Computer as VMIcon,
  Storage as ClusterIcon,
  Folder as ProjectIcon,
  NetworkCheck as NetworkIcon,
  
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  
} from '@mui/icons-material';
import {
   useAuthStore } from '../store/authStore';
import {
   useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Stats {
  companies?: {
    total: number;
    active: number;
  };
  users: {
    total: number;
  };
  clusters: {
    total: number;
    active?: number;
    offline?: number;
  };
  vms: {
    total: number;
    running: number;
    stopped: number;
  };
  projects: {
    total: number;
  };
  ipRanges: {
    total: number;
  };
}

interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  roles?: string[];
}

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color, onClick }) => (
  <Card
    sx={{
      height: '100%',
      position: 'relative',
      overflow: 'visible',
      cursor: onClick ? 'pointer' : 'default',
      '&:hover': onClick ? {
        boxShadow: 6,
        transform: 'translateY(-4px)',
        transition: 'all 0.3s'
      } : {}
    }}
    onClick={onClick}
  >
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h3" component="div">
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            backgroundColor: color,
            borderRadius: '50%',
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export const DashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stats');
      setStats(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const quickActions: QuickAction[] = [
    {
      title: 'Create VM',
      description: 'Deploy a new virtual machine',
      icon: <VMIcon />,
      path: '/vms',
      color: '#9C27B0',
      roles: ['super_admin'],
    },
    {
      title: 'Add Cluster',
      description: 'Connect a Proxmox cluster',
      icon: <ClusterIcon />,
      path: '/clusters',
      color: '#FF9800',
      roles: ['super_admin'],
    },
    {
      title: 'Create Project',
      description: 'Organize your VMs',
      icon: <ProjectIcon />,
      path: '/projects',
      color: '#00BCD4',
    },
    {
      title: 'Add User',
      description: 'Create a new user account',
      icon: <PeopleIcon />,
      path: '/users',
      color: '#2196F3',
    },
  ];

  const filteredActions = quickActions.filter(
    action => !action.roles || action.roles.includes(user?.role || '')
  );

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      </Container>
    );
  }

  const vmRunningPercentage = stats?.vms.total ? (stats.vms.running / stats.vms.total) * 100 : 0;
  const clusterHealthPercentage = stats?.clusters.active !== undefined && stats?.clusters.total
    ? (stats.clusters.active / stats.clusters.total) * 100
    : 100;

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
          Welcome back, {user?.username}!
        </Typography>

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {stats?.companies && (
            <Grid item xs={12} sm={6} md={4}>
              <StatCard
                title="Companies"
                value={stats.companies.total}
                subtitle={`${stats.companies.active} active`}
                icon={<CompanyIcon sx={{ color: 'white', fontSize: 32 }} />}
                color="#4CAF50"
                onClick={() => navigate('/companies')}
              />
            </Grid>
          )}

          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Users"
              value={stats?.users.total || 0}
              icon={<PeopleIcon sx={{ color: 'white', fontSize: 32 }} />}
              color="#2196F3"
              onClick={() => navigate('/users')}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Clusters"
              value={stats?.clusters.total || 0}
              subtitle={
                stats?.clusters.active !== undefined
                  ? `${stats.clusters.active} active, ${stats.clusters.offline || 0} offline`
                  : undefined
              }
              icon={<ClusterIcon sx={{ color: 'white', fontSize: 32 }} />}
              color="#FF9800"
              onClick={() => navigate('/clusters')}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Virtual Machines"
              value={stats?.vms.total || 0}
              subtitle={`${stats?.vms.running || 0} running, ${stats?.vms.stopped || 0} stopped`}
              icon={<VMIcon sx={{ color: 'white', fontSize: 32 }} />}
              color="#9C27B0"
              onClick={() => navigate('/vms')}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="Projects"
              value={stats?.projects.total || 0}
              icon={<ProjectIcon sx={{ color: 'white', fontSize: 32 }} />}
              color="#00BCD4"
              onClick={() => navigate('/projects')}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <StatCard
              title="IP Ranges"
              value={stats?.ipRanges.total || 0}
              icon={<NetworkIcon sx={{ color: 'white', fontSize: 32 }} />}
              color="#795548"
              onClick={() => navigate('/ip-ranges')}
            />
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {/* System Health */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Health
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      {clusterHealthPercentage >= 80 ? (
                        <CheckCircleIcon color="success" />
                      ) : clusterHealthPercentage >= 50 ? (
                        <WarningIcon color="warning" />
                      ) : (
                        <ErrorIcon color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary="Cluster Health"
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2">
                              {stats?.clusters.active || 0} / {stats?.clusters.total || 0} online
                            </Typography>
                            <Typography variant="body2">{clusterHealthPercentage.toFixed(0)}%</Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={clusterHealthPercentage}
                            color={clusterHealthPercentage >= 80 ? 'success' : clusterHealthPercentage >= 50 ? 'warning' : 'error'}
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      {vmRunningPercentage >= 70 ? (
                        <CheckCircleIcon color="success" />
                      ) : vmRunningPercentage >= 40 ? (
                        <WarningIcon color="warning" />
                      ) : (
                        <ErrorIcon color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary="VM Status"
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2">
                              {stats?.vms.running || 0} / {stats?.vms.total || 0} running
                            </Typography>
                            <Typography variant="body2">{vmRunningPercentage.toFixed(0)}%</Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={vmRunningPercentage}
                            color={vmRunningPercentage >= 70 ? 'success' : vmRunningPercentage >= 40 ? 'warning' : 'error'}
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Grid container spacing={2}>
                  {filteredActions.map((action, index) => (
                    <Grid item xs={12} sm={6} key={index}>
                      <Paper
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          '&:hover': {
                            boxShadow: 4,
                            transform: 'translateY(-2px)',
                            transition: 'all 0.2s',
                          },
                        }}
                        onClick={() => navigate(action.path)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Box
                            sx={{
                              backgroundColor: action.color,
                              borderRadius: '50%',
                              p: 1,
                              mr: 2,
                              display: 'flex',
                            }}
                          >
                            {React.cloneElement(action.icon as React.ReactElement, {
                              sx: { color: 'white', fontSize: 24 },
                            })}
                          </Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {action.title}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="textSecondary">
                          {action.description}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 4 }}>
          <Alert severity="info">
            You are logged in as <strong>{user?.role}</strong>
            {user?.company_id && ` for company ID ${user.company_id}`}.
          </Alert>
        </Box>
      </Box>
    </Container>
  );
};
