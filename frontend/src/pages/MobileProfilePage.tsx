import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,

  Divider,
  Button,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Avatar,
  Chip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Computer as ComputerIcon,
  Support as SupportIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export const MobileProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [navValue, setNavValue] = useState(3);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'error';
      case 'company_admin': return 'warning';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin': return 'Super Admin';
      case 'company_admin': return 'Company Admin';
      case 'salesperson': return 'Salesperson';
      default: return 'User';
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <Box sx={{ pb: 7 }}>
      {/* Header */}
      <Paper
        elevation={2}
        sx={{
          p: 3,
          mb: 2,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          textAlign: 'center'
        }}
      >
        <Avatar
          sx={{
            width: 80,
            height: 80,
            margin: '0 auto 16px',
            bgcolor: 'white',
            color: '#667eea',
            fontSize: '2rem',
            fontWeight: 'bold'
          }}
        >
          {currentUser.username?.charAt(0).toUpperCase()}
        </Avatar>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {currentUser.username}
        </Typography>
        <Chip
          label={getRoleLabel(currentUser.role)}
          color={getRoleColor(currentUser.role) as any}
          size="small"
          sx={{ mt: 1 }}
        />
      </Paper>

      <Container maxWidth="sm" sx={{ pb: 2 }}>
        {/* Account Information */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Account Information
            </Typography>
            <List disablePadding>
              <ListItem sx={{ px: 0 }}>
                <ListItemText
                  primary="Username"
                  secondary={currentUser.username}
                  primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                  secondaryTypographyProps={{ variant: 'body1', color: 'text.primary' }}
                />
              </ListItem>
              <Divider />

              <ListItem sx={{ px: 0 }}>
                <ListItemText
                  primary="Email"
                  secondary={currentUser.email || 'Not set'}
                  primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                  secondaryTypographyProps={{ variant: 'body1', color: 'text.primary' }}
                />
              </ListItem>
              <Divider />

              <ListItem sx={{ px: 0 }}>
                <ListItemText
                  primary="Role"
                  secondary={getRoleLabel(currentUser.role)}
                  primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                  secondaryTypographyProps={{ variant: 'body1', color: 'text.primary' }}
                />
              </ListItem>
              <Divider />

              {currentUser.company_name && (
                <>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText
                      primary="Company"
                      secondary={currentUser.company_name}
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      secondaryTypographyProps={{ variant: 'body1', color: 'text.primary' }}
                    />
                  </ListItem>
                  <Divider />
                </>
              )}

              <ListItem sx={{ px: 0 }}>
                <ListItemText
                  primary="User ID"
                  secondary={currentUser.id}
                  primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                  secondaryTypographyProps={{ variant: 'body1', color: 'text.primary' }}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              Quick Actions
            </Typography>

            {['super_admin', 'company_admin'].includes(currentUser.role) && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AdminIcon />}
                onClick={() => navigate('/dashboard')}
                sx={{ mb: 1, justifyContent: 'flex-start' }}
              >
                Go to Admin Dashboard
              </Button>
            )}

            <Button
              fullWidth
              variant="outlined"
              startIcon={<ComputerIcon />}
              onClick={() => navigate('/mobile/vms')}
              sx={{ mb: 1, justifyContent: 'flex-start' }}
            >
              Manage VMs
            </Button>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<SupportIcon />}
              onClick={() => navigate('/mobile/support')}
              sx={{ mb: 1, justifyContent: 'flex-start' }}
            >
              Support Tickets
            </Button>

            <Button
              fullWidth
              variant="contained"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{ justifyContent: 'flex-start' }}
            >
              Logout
            </Button>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              About
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Proxmox Multi-Tenant Platform
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Version 1.5.0
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Mobile Interface
            </Typography>
          </CardContent>
        </Card>
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

export default MobileProfilePage;
