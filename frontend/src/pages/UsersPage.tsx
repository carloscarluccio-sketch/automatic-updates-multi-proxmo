import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Chip,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  company_id: number | null;
  two_factor_enabled: boolean;
  two_factor_required: boolean;
  created_at: string;
  updated_at: string;
}

interface Company {
  id: number;
  name: string;
}

const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    company_id: null as number | null,
    two_factor_required: false,
  });

  useEffect(() => {
    loadUsers();
    if (currentUser?.role === 'super_admin') {
      loadCompanies();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/users');
      setUsers(response.data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data.data || []);
    } catch (err: any) {
      console.error('Failed to load companies:', err);
    }
  };

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        role: user.role,
        company_id: user.company_id,
        two_factor_required: user.two_factor_required || false,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'user',
        company_id: currentUser?.role === 'super_admin' ? null : currentUser?.company_id || null,
        two_factor_required: false,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const payload = editingUser
        ? { ...formData, password: formData.password || undefined }
        : formData;

      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        setSuccess('User updated successfully');
      } else {
        await api.post('/users', payload);
        setSuccess('User created successfully');
      }

      handleCloseDialog();
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.delete(`/users/${user.id}`);
      setSuccess('User deleted successfully');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'error';
      case 'company_admin':
        return 'warning';
      default:
        return 'default';
    }
  };

  const get2FAStatus = (user: User) => {
    if (user.two_factor_enabled) {
      return (
        <Tooltip title="2FA is enabled and active">
          <Chip
            icon={<CheckCircleIcon />}
            label="2FA Active"
            color="success"
            size="small"
            sx={{ cursor: 'help' }}
          />
        </Tooltip>
      );
    }

    if (user.two_factor_required) {
      return (
        <Tooltip title="2FA is required but not yet enabled">
          <Chip
            icon={<WarningIcon />}
            label="2FA Required"
            color="warning"
            size="small"
            sx={{ cursor: 'help' }}
          />
        </Tooltip>
      );
    }

    return (
      <Chip
        label="2FA Disabled"
        variant="outlined"
        size="small"
      />
    );
  };

  // Check if current user can modify 2FA settings
  const canModify2FA = currentUser?.role === 'super_admin' || currentUser?.role === 'company_admin';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Users</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadUsers}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            disabled={loading}
          >
            Add User
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>2FA Status</TableCell>
              <TableCell>Company ID</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No users found. Click "Add User" to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>
                    <Typography variant="body1" fontWeight={500}>
                      {user.username}
                    </Typography>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip label={user.role} color={getRoleColor(user.role)} size="small" />
                  </TableCell>
                  <TableCell>{get2FAStatus(user)}</TableCell>
                  <TableCell>{user.company_id || '-'}</TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(user.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(user)}
                      disabled={loading}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(user)}
                      disabled={loading || user.id === currentUser?.id}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              fullWidth
              disabled={!!editingUser}
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label={editingUser ? 'New Password (leave empty to keep current)' : 'Password'}
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required={!editingUser}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={formData.role}
                label="Role"
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="company_admin">Company Admin</MenuItem>
                {currentUser?.role === 'super_admin' && (
                  <MenuItem value="super_admin">Super Admin</MenuItem>
                )}
              </Select>
            </FormControl>
            {currentUser?.role === 'super_admin' && (
              <FormControl fullWidth>
                <InputLabel>Company</InputLabel>
                <Select
                  value={formData.company_id || ''}
                  label="Company"
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value as number || null })}
                >
                  <MenuItem value="">None</MenuItem>
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* 2FA Enforcement Control */}
            {canModify2FA && editingUser && (
              <Box sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                bgcolor: 'background.paper'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle1" fontWeight={500}>
                    Two-Factor Authentication
                  </Typography>
                </Box>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.two_factor_required}
                      onChange={(e) => setFormData({ ...formData, two_factor_required: e.target.checked })}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">
                        Require 2FA for this user
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formData.two_factor_required
                          ? 'User must enable 2FA before they can login'
                          : 'User can optionally enable 2FA'}
                      </Typography>
                    </Box>
                  }
                />

                {editingUser.two_factor_enabled && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    <Typography variant="caption">
                      This user has 2FA enabled and active.
                    </Typography>
                  </Alert>
                )}

                {formData.two_factor_required && !editingUser.two_factor_enabled && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <Typography variant="caption">
                      User will be required to set up 2FA on their next login.
                    </Typography>
                  </Alert>
                )}
              </Box>
            )}

            {canModify2FA && !editingUser && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.two_factor_required}
                    onChange={(e) => setFormData({ ...formData, two_factor_required: e.target.checked })}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      Require 2FA for this user
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      User must enable 2FA on first login
                    </Typography>
                  </Box>
                }
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !formData.username || !formData.email || (!editingUser && !formData.password)}
          >
            {editingUser ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersPage;
