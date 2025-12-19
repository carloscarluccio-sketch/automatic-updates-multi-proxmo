import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  IconButton,
  BottomNavigation,
  BottomNavigationAction,
  Paper
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Computer as ComputerIcon,
  Support as SupportIcon,
  Person as PersonIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface VM {
  id: number;
  name: string;
  status: string;
  vmid: number;
  node: string;
  cores: number;
  memory: number;
  primary_ip_internal: string | null;
}

interface DashboardStats {
  totalVMs: number;
  runningVMs: number;
  stoppedVMs: number;
  openTickets: number;
}

export const MobileDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [navValue, setNavValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalVMs: 0,
    runningVMs: 0,
    stoppedVMs: 0,
    openTickets: 0
  });
  const [recentVMs, setRecentVMs] = useState<VM[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load VMs
      const vmsResponse = await api.get('/vms');
      const vms = vmsResponse.data.data || [];

      // Load tickets
      const ticketsResponse = await api.get('/support-tickets');
      const tickets = ticketsResponse.data.data || [];
      const openTickets = tickets.filter((t: any) =>
        ['open', 'in_progress'].includes(t.status)
      );

      // Calculate stats
      setStats({
        totalVMs: vms.length,
        runningVMs: vms.filter((v: VM) => v.status === 'running').length,
        stoppedVMs: vms.filter((v: VM) => v.status === 'stopped').length,
        openTickets: openTickets.length
      });

      // Get recent VMs (max 5)
      setRecentVMs(vms.slice(0, 5));
    } catch (error) {
      console.error('Load dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVMAction = async (vmId: number, action: 'start' | 'stop') => {
    try {
      await api.post(`/vms/${vmId}/control`, { action });
      loadDashboardData();
    } catch (error) {
      console.error(`VM ${action} error:`, error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'success';
      case 'stopped': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 7 }}>
      {/* Header */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          mb: 2,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}
      >
        <Typography variant="h5" fontWeight="bold">
          Dashboard
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          Welcome, {currentUser?.username || 'User'}
        </Typography>
      </Paper>

      <Container maxWidth="sm" sx={{ pb: 2 }}>
        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6}>
            <Card sx={{ bgcolor: '#667eea', color: 'white' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <ComputerIcon sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">
                  {stats.totalVMs}
                </Typography>
                <Typography variant="body2">Total VMs</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6}>
            <Card sx={{ bgcolor: '#f093fb', color: 'white' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <SupportIcon sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">
                  {stats.openTickets}
                </Typography>
                <Typography variant="body2">Open Tickets</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6}>
            <Card sx={{ bgcolor: '#4facfe', color: 'white' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <PlayIcon sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">
                  {stats.runningVMs}
                </Typography>
                <Typography variant="body2">Running</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6}>
            <Card sx={{ bgcolor: '#fa709a', color: 'white' }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <StopIcon sx={{ fontSize: 32, mb: 1 }} />
                <Typography variant="h4" fontWeight="bold">
                  {stats.stoppedVMs}
                </Typography>
                <Typography variant="body2">Stopped</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Recent VMs */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              Recent VMs
            </Typography>
            <IconButton size="small" onClick={loadDashboardData}>
              <RefreshIcon />
            </IconButton>
          </Box>

          {recentVMs.length === 0 ? (
            <Card>
              <CardContent>
                <Typography color="text.secondary" align="center">
                  No VMs found
                </Typography>
              </CardContent>
            </Card>
          ) : (
            recentVMs.map((vm) => (
              <Card key={vm.id} sx={{ mb: 2 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {vm.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Node: {vm.node} | VMID: {vm.vmid}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {vm.cores} CPU | {(vm.memory / 1024).toFixed(1)}GB RAM
                      </Typography>
                      {vm.primary_ip_internal && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          IP: {vm.primary_ip_internal}
                        </Typography>
                      )}
                      <Chip
                        label={vm.status.toUpperCase()}
                        size="small"
                        color={getStatusColor(vm.status) as any}
                        sx={{ mt: 1 }}
                      />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {vm.status === 'stopped' ? (
                        <IconButton
                          color="success"
                          size="small"
                          onClick={() => handleVMAction(vm.id, 'start')}
                        >
                          <PlayIcon />
                        </IconButton>
                      ) : (
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() => handleVMAction(vm.id, 'stop')}
                        >
                          <StopIcon />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      </Container>

      {/* Bottom Navigation */}
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
        <BottomNavigation
          value={navValue}
          onChange={(_event, newValue) => {
            setNavValue(newValue);
            switch(newValue) {
              case 0:
                navigate('/mobile');
                break;
              case 1:
                navigate('/mobile/vms');
                break;
              case 2:
                navigate('/mobile/support');
                break;
              case 3:
                navigate('/mobile/profile');
                break;
            }
          }}
        >
          <BottomNavigationAction label="Dashboard" icon={<DashboardIcon />} />
          <BottomNavigationAction label="VMs" icon={<ComputerIcon />} />
          <BottomNavigationAction label="Support" icon={<SupportIcon />} />
          <BottomNavigationAction label="Profile" icon={<PersonIcon />} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
};

export default MobileDashboard;
