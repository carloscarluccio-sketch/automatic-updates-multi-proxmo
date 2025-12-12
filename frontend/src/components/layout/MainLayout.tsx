import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Button,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ComputerIcon from '@mui/icons-material/Computer';
import BusinessIcon from '@mui/icons-material/Business';
import GroupIcon from '@mui/icons-material/Group';
import StorageIcon from '@mui/icons-material/Storage';
import FolderIcon from '@mui/icons-material/Folder';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import BarChartIcon from '@mui/icons-material/BarChart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FeedbackIcon from '@mui/icons-material/Feedback';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import CloudIcon from '@mui/icons-material/Cloud';
import PaletteIcon from '@mui/icons-material/Palette';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import ShieldIcon from '@mui/icons-material/Shield';
import HistoryIcon from '@mui/icons-material/History';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReceiptIcon from '@mui/icons-material/Receipt';
import BackupIcon from '@mui/icons-material/Backup';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import EmailIcon from '@mui/icons-material/Email';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import SpeedIcon from '@mui/icons-material/Speed';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';

const drawerWidth = 260;

interface MenuItem {
  label: string;
  path?: string;
  icon: React.ReactElement;
  children?: MenuItem[];
  requiresRole?: string;
}

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    infrastructure: true,
    billing: false,
    network: false,
    security: false,
    administration: false,
    system: false,
  });

  const handleLogout = async () => {
    await authService.logout();
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const menuStructure: MenuItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
    { label: 'Analytics', path: '/analytics', icon: <BarChartIcon /> },
    { label: 'Usage Dashboard (PAYG)', path: '/usage-dashboard', icon: <TrendingUpIcon /> },
    {
      label: 'Billing',
      icon: <AttachMoneyIcon />,
      children: [
        { label: 'Billing Overview', path: '/billing', icon: <AttachMoneyIcon /> },
        { label: 'Invoices', path: '/invoices', icon: <ReceiptIcon /> },
      ],
    },
    {
      label: 'Infrastructure',
      icon: <CloudIcon />,
      children: [
        { label: 'Virtual Machines', path: '/vms', icon: <ComputerIcon /> },
        { label: 'Clusters', path: '/clusters', icon: <StorageIcon /> },
        { label: 'Projects', path: '/projects', icon: <FolderIcon /> },
        { label: 'Templates', path: '/templates', icon: <AssessmentIcon /> },
        { label: 'ISOs', path: '/isos', icon: <AssessmentIcon /> },
        { label: 'VM Import & Discovery', path: '/vm-import', icon: <CloudDownloadIcon /> },
        { label: 'ESXi Import', path: '/esxi-import', icon: <DesktopWindowsIcon /> },
        { label: 'Backup Schedules', path: '/backup-schedules', icon: <BackupIcon /> },
        { label: 'Snapshot Schedules', path: '/snapshot-schedules', icon: <CameraAltIcon /> },
        { label: 'DR Test Schedules', path: '/dr-test-schedules', icon: <HealthAndSafetyIcon /> },
        { label: 'DR Cluster Pairs', path: '/dr-cluster-pairs', icon: <HealthAndSafetyIcon /> },
        { label: 'Backup Policies', path: '/backup-policies', icon: <BackupIcon /> },
        { label: 'VM Templates', path: '/vm-templates', icon: <AssessmentIcon /> },
        { label: 'Alert Rules', path: '/alert-rules', icon: <NotificationsActiveIcon /> },
        { label: 'Monitoring Dashboard', path: '/monitoring', icon: <MonitorHeartIcon /> },
        { label: 'Email Notifications', path: '/notifications', icon: <EmailIcon /> },
      ],
    },
    {
      label: 'Network',
      icon: <NetworkCheckIcon />,
      children: [
        { label: 'IP Ranges', path: '/ip-ranges', icon: <NetworkCheckIcon /> },
        { label: 'IP Reservations', path: '/ip-reservations', icon: <BookmarkAddIcon /> },
        { label: 'IP Tracking & Monitoring', path: '/ip-tracking', icon: <TrackChangesIcon /> },
        { label: 'NAT Rules', path: '/nat', icon: <NetworkCheckIcon /> },
        { label: 'NAT Performance', path: '/nat-performance', icon: <SpeedIcon /> },
      ],
    },
    {
      label: 'Security',
      icon: <SecurityIcon />,
      children: [
        { label: 'OPNsense Firewalls', path: '/opnsense', icon: <SecurityIcon /> },
        { label: 'SSO Configuration', path: '/sso', icon: <ShieldIcon /> },
        { label: '2FA Settings', path: '/2fa', icon: <VpnKeyIcon /> },
        { label: 'API Tokens', path: '/api-tokens', icon: <VpnKeyIcon /> },
      ],
    },
    {
      label: 'Administration',
      icon: <SettingsIcon />,
      children: [
        { label: 'Companies', path: '/companies', icon: <BusinessIcon /> },
        { label: 'Users', path: '/users', icon: <GroupIcon /> },
        { label: 'Profiles', path: '/profiles', icon: <AssessmentIcon /> },
        { label: 'Branding', path: '/branding', icon: <PaletteIcon /> },
        {
          label: 'Pricing Management',
          path: '/pricing',
          icon: <PriceChangeIcon />,
          requiresRole: 'super_admin'
        },
      ],
    },
    {
      label: 'System',
      icon: <HistoryIcon />,
      children: [
        { label: 'Activity Logs', path: '/activity-logs', icon: <HistoryIcon /> },
        { label: 'Feedback', path: '/feedback', icon: <FeedbackIcon /> },
      ],
    },
  ];

  const renderMenuItem = (item: MenuItem) => {
    // Filter by role if required
    if (item.requiresRole && user?.role !== item.requiresRole) {
      return null;
    }

    if (item.children) {
      const sectionKey = item.label.toLowerCase().replace(/\s+/g, '');
      const isOpen = openSections[sectionKey] ?? false;

      // Filter children by role
      const visibleChildren = item.children.filter(
        (child) => !child.requiresRole || user?.role === child.requiresRole
      );

      if (visibleChildren.length === 0) {
        return null;
      }

      return (
        <React.Fragment key={item.label}>
          <ListItem disablePadding>
            <ListItemButton onClick={() => toggleSection(sectionKey)}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
              {isOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
          </ListItem>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {visibleChildren.map((child) => (
                <ListItem key={child.path} disablePadding>
                  <ListItemButton
                    sx={{ pl: 4 }}
                    selected={child.path ? isActive(child.path) : false}
                    onClick={() => child.path && navigate(child.path)}
                  >
                    <ListItemIcon>{child.icon}</ListItemIcon>
                    <ListItemText primary={child.label} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Collapse>
        </React.Fragment>
      );
    }

    return (
      <ListItem key={item.path} disablePadding>
        <ListItemButton
          selected={item.path ? isActive(item.path) : false}
          onClick={() => item.path && navigate(item.path)}
        >
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Proxmox Multi-Tenant
          </Typography>
          {user && (
            <Typography variant="body2" sx={{ mr: 2 }}>
              {user.email} ({user.role})
            </Typography>
          )}
          <Button color="inherit" onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuStructure.map((item) => renderMenuItem(item))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};
