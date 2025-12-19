import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  Divider
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Computer as ComputerIcon,
  Support as SupportIcon,
  Person as PersonIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Info as InfoIcon,
  Pause as PauseIcon,
  RestartAlt as RestartIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface VM {
  id: number;
  name: string;
  status: string;
  vmid: number;
  node: string;
  cluster_name: string;
  cores: number;
  memory: number;
  disk: number;
  primary_ip_internal: string | null;
  primary_ip_external: string | null;
  project_name: string | null;
}

export const MobileVMsPage: React.FC = () => {
  const navigate = useNavigate();
  const [navValue, setNavValue] = useState(1);
  const [loading, setLoading] = useState(true);
  const [vms, setVMs] = useState<VM[]>([]);
  const [filteredVMs, setFilteredVMs] = useState<VM[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVM, setSelectedVM] = useState<VM | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    loadVMs();
  }, []);

  useEffect(() => {
    // Filter VMs based on search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredVMs(
        vms.filter((vm) =>
          vm.name.toLowerCase().includes(query) ||
          vm.vmid.toString().includes(query) ||
          vm.node.toLowerCase().includes(query) ||
          (vm.primary_ip_internal && vm.primary_ip_internal.includes(query))
        )
      );
    } else {
      setFilteredVMs(vms);
    }
  }, [searchQuery, vms]);

  const loadVMs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/vms');
      const vmsData = response.data.data || [];
      setVMs(vmsData);
      setFilteredVMs(vmsData);
    } catch (error) {
      console.error('Load VMs error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVMAction = async (vmId: number, action: 'start' | 'stop' | 'shutdown' | 'reboot') => {
    try {
      setActionLoading(vmId);
      await api.post(`/vms/${vmId}/control`, { action });
      // Wait a moment then reload
      setTimeout(() => {
        loadVMs();
        setActionLoading(null);
      }, 1000);
    } catch (error) {
      console.error(`VM ${action} error:`, error);
      setActionLoading(null);
    }
  };

  const handleViewDetails = (vm: VM) => {
    setSelectedVM(vm);
    setDetailsDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'success';
      case 'stopped': return 'error';
      case 'paused': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <PlayIcon fontSize="small" />;
      case 'stopped': return <StopIcon fontSize="small" />;
      case 'paused': return <PauseIcon fontSize="small" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const runningCount = vms.filter(vm => vm.status === 'running').length;
  const stoppedCount = vms.filter(vm => vm.status === 'stopped').length;

  return (
    <Box sx={{ pb: 7 }}>
      {/* Header */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          mb: 2,
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white'
        }}
      >
        <Typography variant="h5" fontWeight="bold">
          Virtual Machines
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          {runningCount} running | {stoppedCount} stopped
        </Typography>
      </Paper>

      <Container maxWidth="sm" sx={{ pb: 2 }}>
        {/* Search */}
        <TextField
          fullWidth
          placeholder="Search VMs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            )
          }}
        />

        {/* Refresh Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <IconButton size="small" onClick={loadVMs}>
            <RefreshIcon />
          </IconButton>
        </Box>

        {/* VMs List */}
        {filteredVMs.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary" align="center">
                {searchQuery ? 'No VMs match your search' : 'No VMs found'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          filteredVMs.map((vm) => (
            <Card key={vm.id} sx={{ mb: 2 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {vm.name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(vm)}
                        sx={{ ml: 'auto' }}
                      >
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    <Typography variant="caption" color="text.secondary" display="block">
                      Cluster: {vm.cluster_name} | Node: {vm.node}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      VMID: {vm.vmid} | {vm.cores} CPU | {(vm.memory / 1024).toFixed(1)}GB RAM
                    </Typography>
                    {vm.primary_ip_internal && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        IP: {vm.primary_ip_internal}
                      </Typography>
                    )}
                    {vm.project_name && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Project: {vm.project_name}
                      </Typography>
                    )}

                    <Chip
                      label={vm.status.toUpperCase()}
                      size="small"
                      color={getStatusColor(vm.status) as any}
                      icon={getStatusIcon(vm.status) || undefined}
                      sx={{ mt: 1 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {actionLoading === vm.id ? (
                      <CircularProgress size={24} />
                    ) : (
                      <>
                        {vm.status === 'stopped' ? (
                          <IconButton
                            color="success"
                            size="small"
                            onClick={() => handleVMAction(vm.id, 'start')}
                          >
                            <PlayIcon />
                          </IconButton>
                        ) : (
                          <>
                            <IconButton
                              color="warning"
                              size="small"
                              onClick={() => handleVMAction(vm.id, 'shutdown')}
                              title="Graceful Shutdown"
                            >
                              <PauseIcon />
                            </IconButton>
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => handleVMAction(vm.id, 'stop')}
                              title="Force Stop"
                            >
                              <StopIcon />
                            </IconButton>
                            <IconButton
                              color="info"
                              size="small"
                              onClick={() => handleVMAction(vm.id, 'reboot')}
                              title="Reboot"
                            >
                              <RestartIcon />
                            </IconButton>
                          </>
                        )}
                      </>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))
        )}
      </Container>

      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        {selectedVM && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6">{selectedVM.name}</Typography>
                <Chip
                  label={selectedVM.status.toUpperCase()}
                  size="small"
                  color={getStatusColor(selectedVM.status) as any}
                  icon={getStatusIcon(selectedVM.status) || undefined}
                />
              </Box>
            </DialogTitle>
            <DialogContent>
              <List disablePadding>
                <ListItem sx={{ px: 0, py: 1 }}>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="caption" color="text.secondary">
                      VM ID
                    </Typography>
                    <Typography variant="body2">{selectedVM.vmid}</Typography>
                  </Box>
                </ListItem>
                <Divider />

                <ListItem sx={{ px: 0, py: 1 }}>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="caption" color="text.secondary">
                      Cluster
                    </Typography>
                    <Typography variant="body2">{selectedVM.cluster_name}</Typography>
                  </Box>
                </ListItem>
                <Divider />

                <ListItem sx={{ px: 0, py: 1 }}>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="caption" color="text.secondary">
                      Node
                    </Typography>
                    <Typography variant="body2">{selectedVM.node}</Typography>
                  </Box>
                </ListItem>
                <Divider />

                <ListItem sx={{ px: 0, py: 1 }}>
                  <Box sx={{ width: '100%' }}>
                    <Typography variant="caption" color="text.secondary">
                      Resources
                    </Typography>
                    <Typography variant="body2">
                      {selectedVM.cores} CPU Cores | {(selectedVM.memory / 1024).toFixed(1)}GB RAM |{' '}
                      {(selectedVM.disk / 1024).toFixed(1)}GB Disk
                    </Typography>
                  </Box>
                </ListItem>
                <Divider />

                {selectedVM.primary_ip_internal && (
                  <>
                    <ListItem sx={{ px: 0, py: 1 }}>
                      <Box sx={{ width: '100%' }}>
                        <Typography variant="caption" color="text.secondary">
                          Internal IP
                        </Typography>
                        <Typography variant="body2">{selectedVM.primary_ip_internal}</Typography>
                      </Box>
                    </ListItem>
                    <Divider />
                  </>
                )}

                {selectedVM.primary_ip_external && (
                  <>
                    <ListItem sx={{ px: 0, py: 1 }}>
                      <Box sx={{ width: '100%' }}>
                        <Typography variant="caption" color="text.secondary">
                          External IP
                        </Typography>
                        <Typography variant="body2">{selectedVM.primary_ip_external}</Typography>
                      </Box>
                    </ListItem>
                    <Divider />
                  </>
                )}

                {selectedVM.project_name && (
                  <>
                    <ListItem sx={{ px: 0, py: 1 }}>
                      <Box sx={{ width: '100%' }}>
                        <Typography variant="caption" color="text.secondary">
                          Project
                        </Typography>
                        <Typography variant="body2">{selectedVM.project_name}</Typography>
                      </Box>
                    </ListItem>
                    <Divider />
                  </>
                )}
              </List>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

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

export default MobileVMsPage;
