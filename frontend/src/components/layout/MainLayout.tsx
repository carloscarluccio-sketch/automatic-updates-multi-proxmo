import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  
  const handleLogout = async () => {
    await authService.logout();
    logout();
    navigate('/login');
  };

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Proxmox Multi-Tenant</Typography>
          <Button color="inherit" onClick={() => navigate('/dashboard')}>Dashboard</Button>
          <Button color="inherit" onClick={() => navigate('/users')}>Users</Button>
          <Button color="inherit" onClick={() => navigate('/companies')}>Companies</Button>
          <Button color="inherit" onClick={handleLogout}>Logout</Button>
        </Toolbar>
      </AppBar>
      <Box><Outlet /></Box>
    </Box>
  );
};
