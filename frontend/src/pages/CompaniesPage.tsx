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
  FormControlLabel,
  Checkbox,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  VerifiedUser as VerifiedUserIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { CompanyClusterDialog } from '../components/CompanyClusterDialog';
import { useAuthStore } from '../store/authStore';

interface Company {
  id: number;
  name: string;
  owner_name: string;
  primary_email: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  status: string;
  require_2fa: boolean;
  created_at: string;
  _count?: {
    users: number;
    virtual_machines: number;
  };
}

const CompaniesPage: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openClusterDialog, setOpenClusterDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    primary_email: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    status: 'active',
    require_2fa: false,
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/companies');
      setCompanies(response.data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        name: company.name,
        owner_name: company.owner_name,
        primary_email: company.primary_email,
        contact_email: company.contact_email || '',
        contact_phone: company.contact_phone || '',
        address: company.address || '',
        status: company.status,
        require_2fa: company.require_2fa || false,
      });
    } else {
      setEditingCompany(null);
      setFormData({
        name: '',
        owner_name: '',
        primary_email: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        status: 'active',
        require_2fa: false,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCompany(null);
    setError(null);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      if (editingCompany) {
        await api.put(`/companies/${editingCompany.id}`, formData);
        setSuccess('Company updated successfully');
      } else {
        await api.post('/companies', formData);
        setSuccess('Company created successfully');
      }

      handleCloseDialog();
      await loadCompanies();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (company: Company) => {
    if (!window.confirm(`Are you sure you want to delete company "${company.name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.delete(`/companies/${company.id}`);
      setSuccess('Company deleted successfully');
      await loadCompanies();
    } catch (err: any) {
      setError(err.message || 'Failed to delete company');
    } finally {
      setLoading(false);
    }
  };

  // Check if current user is super_admin
  const isSuperAdmin = currentUser?.role === 'super_admin';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Companies</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadCompanies}
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
            Add Company
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
              <TableCell>Name</TableCell>
              <TableCell>Owner</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>2FA Policy</TableCell>
              <TableCell>Users</TableCell>
              <TableCell>VMs</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {companies.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No companies found. Click "Add Company" to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>{company.id}</TableCell>
                  <TableCell>
                    <Typography variant="body1" fontWeight={500}>
                      {company.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{company.owner_name}</TableCell>
                  <TableCell>{company.primary_email}</TableCell>
                  <TableCell>{company.contact_phone || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={company.status}
                      color={company.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {company.require_2fa ? (
                      <Tooltip title="All users in this company must enable 2FA">
                        <Chip
                          icon={<VerifiedUserIcon />}
                          label="2FA Required"
                          color="primary"
                          size="small"
                          sx={{ cursor: 'help' }}
                        />
                      </Tooltip>
                    ) : (
                      <Chip
                        label="Optional"
                        variant="outlined"
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell>{company._count?.users || 0}</TableCell>
                  <TableCell>{company._count?.virtual_machines || 0}</TableCell>
                  <TableCell>{new Date(company.created_at).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedCompany(company);
                        setOpenClusterDialog(true);
                      }}
                      disabled={loading}
                      title="Manage Clusters"
                    >
                      <StorageIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(company)}
                      disabled={loading}
                      title="Edit Company"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(company)}
                      disabled={loading || (company._count && (company._count.users > 0 || company._count.virtual_machines > 0))}
                      color="error"
                      title="Delete Company"
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
        <DialogTitle>{editingCompany ? 'Edit Company' : 'Add Company'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Company Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Owner Name"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Primary Email"
              type="email"
              value={formData.primary_email}
              onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Contact Email"
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Contact Phone"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              fullWidth
            />
            <TextField
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />

            {/* Company-Level 2FA Enforcement (Super Admin Only) */}
            {isSuperAdmin && (
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
                    Security Policy
                  </Typography>
                </Box>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.require_2fa}
                      onChange={(e) => setFormData({ ...formData, require_2fa: e.target.checked })}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">
                        Require 2FA for all users in this company
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formData.require_2fa
                          ? 'All users must enable 2FA to access the system'
                          : 'Users can optionally enable 2FA'}
                      </Typography>
                    </Box>
                  }
                />

                {formData.require_2fa && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="caption">
                      <strong>Company-wide enforcement:</strong> All users in this company will be required
                      to set up 2FA before they can login, regardless of their individual 2FA settings.
                    </Typography>
                  </Alert>
                )}

                {editingCompany && editingCompany._count && editingCompany._count.users > 0 && formData.require_2fa && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    <Typography variant="caption">
                      This company has {editingCompany._count.users} user{editingCompany._count.users !== 1 ? 's' : ''}.
                      They will all be required to enable 2FA on their next login.
                    </Typography>
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading || !formData.name || !formData.primary_email}>
            {editingCompany ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cluster Management Dialog */}
      {selectedCompany && (
        <CompanyClusterDialog
          open={openClusterDialog}
          onClose={() => {
            setOpenClusterDialog(false);
            setSelectedCompany(null);
          }}
          companyId={selectedCompany.id}
          companyName={selectedCompany.name}
        />
      )}
    </Box>
  );
};

export default CompaniesPage;
