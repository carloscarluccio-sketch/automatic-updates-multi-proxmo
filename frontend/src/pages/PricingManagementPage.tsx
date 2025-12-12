import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  Alert,
  Paper,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../services/api';

interface PricingTier {
  id: number;
  name: string;
  description: string | null;
  tier_type: string;
  company_id: number | null;
  project_id: number | null;
  unit_price: number;
  currency: string;
  billing_cycle: string;
  min_units: number | null;
  max_units: number | null;
  overage_price: number | null;
  is_default: boolean;
  priority: number;
  active: boolean;
  companies?: { id: number; name: string } | null;
  vm_projects?: { id: number; name: string } | null;
}

interface TierType {
  value: string;
  label: string;
  description: string;
}

interface Company {
  id: number;
  name: string;
}

interface Project {
  id: number;
  name: string;
}

const PricingManagementPage: React.FC = () => {
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [tierTypes, setTierTypes] = useState<TierType[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [deletingTier, setDeletingTier] = useState<PricingTier | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tier_type: '',
    company_id: '',
    project_id: '',
    unit_price: '',
    currency: 'USD',
    billing_cycle: 'monthly',
    min_units: '',
    max_units: '',
    overage_price: '',
    is_default: false,
    priority: '0',
    active: true
  });

  const [filter, setFilter] = useState({
    companyId: '',
    tierType: '',
    activeOnly: true
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadPricingTiers();
  }, [filter]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load tier types
      const tierTypesRes = await api.get('/pricing/tier-types');
      setTierTypes(tierTypesRes.data.data || []);
      console.log('Loaded tier types:', tierTypesRes.data.data);

      // Load companies
      try {
        const companiesRes = await api.get('/companies');
        setCompanies(companiesRes.data.data || []);
        console.log('Loaded companies:', companiesRes.data.data);
      } catch (err) {
        console.warn('Failed to load companies:', err);
      }

      // Load projects
      try {
        const projectsRes = await api.get('/projects');
        setProjects(projectsRes.data.data || []);
        console.log('Loaded projects:', projectsRes.data.data);
      } catch (err) {
        console.warn('Failed to load projects:', err);
      }

      loadPricingTiers();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load data');
      console.error('Load initial data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPricingTiers = async () => {
    try {
      setLoading(true);
      setError('');

      const params: any = {
        activeOnly: filter.activeOnly
      };

      if (filter.companyId) params.companyId = filter.companyId;
      if (filter.tierType) params.tierType = filter.tierType;

      const response = await api.get('/pricing', { params });
      setPricingTiers(response.data.data || []);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load pricing tiers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tier?: PricingTier) => {
    if (tier) {
      setEditingTier(tier);
      setFormData({
        name: tier.name,
        description: tier.description || '',
        tier_type: tier.tier_type,
        company_id: tier.company_id?.toString() || '',
        project_id: tier.project_id?.toString() || '',
        unit_price: tier.unit_price.toString(),
        currency: tier.currency,
        billing_cycle: tier.billing_cycle,
        min_units: tier.min_units?.toString() || '',
        max_units: tier.max_units?.toString() || '',
        overage_price: tier.overage_price?.toString() || '',
        is_default: tier.is_default,
        priority: tier.priority.toString(),
        active: tier.active
      });
    } else {
      setEditingTier(null);
      setFormData({
        name: '',
        description: '',
        tier_type: '',
        company_id: '',
        project_id: '',
        unit_price: '',
        currency: 'USD',
        billing_cycle: 'monthly',
        min_units: '',
        max_units: '',
        overage_price: '',
        is_default: false,
        priority: '0',
        active: true
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTier(null);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      const data = {
        ...formData,
        company_id: formData.company_id ? Number(formData.company_id) : null,
        project_id: formData.project_id ? Number(formData.project_id) : null,
        unit_price: Number(formData.unit_price),
        min_units: formData.min_units ? Number(formData.min_units) : null,
        max_units: formData.max_units ? Number(formData.max_units) : null,
        overage_price: formData.overage_price ? Number(formData.overage_price) : null,
        priority: Number(formData.priority)
      };

      if (editingTier) {
        await api.put(`/pricing/${editingTier.id}`, data);
        setSuccess('Pricing tier updated successfully');
      } else {
        await api.post('/pricing', data);
        setSuccess('Pricing tier created successfully');
      }

      handleCloseDialog();
      loadPricingTiers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to save pricing tier');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTier) return;

    try {
      setLoading(true);
      setError('');

      await api.delete(`/pricing/${deletingTier.id}`);
      setSuccess('Pricing tier deleted successfully');
      setDeleteDialogOpen(false);
      setDeletingTier(null);
      loadPricingTiers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to delete pricing tier');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };

  const getTierTypeLabel = (value: string) => {
    const tierType = tierTypes.find(t => t.value === value);
    return tierType ? tierType.label : value;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Pricing Management</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadPricingTiers}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Add Pricing Tier
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Filter by Company</InputLabel>
                <Select
                  value={filter.companyId}
                  label="Filter by Company"
                  onChange={(e) => setFilter({ ...filter, companyId: e.target.value })}
                >
                  <MenuItem value="">All Companies</MenuItem>
                  <MenuItem value="default">Default Only</MenuItem>
                  {companies.map(c => (
                    <MenuItem key={c.id} value={c.id.toString()}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Filter by Type</InputLabel>
                <Select
                  value={filter.tierType}
                  label="Filter by Type"
                  onChange={(e) => setFilter({ ...filter, tierType: e.target.value })}
                >
                  <MenuItem value="">All Types</MenuItem>
                  {tierTypes.map(t => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={filter.activeOnly}
                    onChange={(e) => setFilter({ ...filter, activeOnly: e.target.checked })}
                  />
                }
                label="Active Only"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Pricing Tiers Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Unit Price</TableCell>
              <TableCell>Billing Cycle</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pricingTiers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No pricing tiers found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              pricingTiers.map((tier) => (
                <TableRow key={tier.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {tier.name}
                    </Typography>
                    {tier.description && (
                      <Typography variant="caption" color="textSecondary">
                        {tier.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getTierTypeLabel(tier.tier_type)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {tier.is_default && (
                      <Chip label="Default" size="small" color="success" />
                    )}
                    {tier.companies && (
                      <Chip label={tier.companies.name} size="small" color="info" />
                    )}
                    {tier.vm_projects && (
                      <Chip label={tier.vm_projects.name} size="small" color="warning" />
                    )}
                    {!tier.is_default && !tier.companies && !tier.vm_projects && (
                      <Chip label="Unassigned" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {formatCurrency(tier.unit_price, tier.currency)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={tier.billing_cycle} size="small" />
                  </TableCell>
                  <TableCell>{tier.priority}</TableCell>
                  <TableCell>
                    <Chip
                      label={tier.active ? 'Active' : 'Inactive'}
                      size="small"
                      color={tier.active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(tier)}
                        disabled={loading}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setDeletingTier(tier);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={loading}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTier ? 'Edit Pricing Tier' : 'Add Pricing Tier'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Tier Type</InputLabel>
                <Select
                  value={formData.tier_type}
                  label="Tier Type"
                  onChange={(e) => setFormData({ ...formData, tier_type: e.target.value })}
                >
                  {tierTypes.length === 0 && (
                    <MenuItem value="" disabled>Loading tier types...</MenuItem>
                  )}
                  {tierTypes.map(t => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Unit Price"
                type="number"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                required
                inputProps={{ step: 0.01, min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={formData.currency}
                  label="Currency"
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                >
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="GBP">GBP</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Billing Cycle</InputLabel>
                <Select
                  value={formData.billing_cycle}
                  label="Billing Cycle"
                  onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                >
                  <MenuItem value="hourly">Hourly</MenuItem>
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Company (Optional)</InputLabel>
                <Select
                  value={formData.company_id}
                  label="Company (Optional)"
                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                  disabled={formData.is_default}
                >
                  <MenuItem value="">None (Default for all companies)</MenuItem>
                  {companies.length === 0 && !formData.is_default && (
                    <MenuItem value="" disabled>Loading companies...</MenuItem>
                  )}
                  {companies.map(c => (
                    <MenuItem key={c.id} value={c.id.toString()}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Project (Optional)</InputLabel>
                <Select
                  value={formData.project_id}
                  label="Project (Optional)"
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  disabled={formData.is_default}
                >
                  <MenuItem value="">None</MenuItem>
                  {projects.length === 0 && !formData.is_default && (
                    <MenuItem value="" disabled>Loading projects...</MenuItem>
                  )}
                  {projects.map(p => (
                    <MenuItem key={p.id} value={p.id.toString()}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Min Units"
                type="number"
                value={formData.min_units}
                onChange={(e) => setFormData({ ...formData, min_units: e.target.value })}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Max Units"
                type="number"
                value={formData.max_units}
                onChange={(e) => setFormData({ ...formData, max_units: e.target.value })}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Overage Price"
                type="number"
                value={formData.overage_price}
                onChange={(e) => setFormData({ ...formData, overage_price: e.target.value })}
                inputProps={{ step: 0.01, min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_default}
                    onChange={(e) => setFormData({
                      ...formData,
                      is_default: e.target.checked,
                      company_id: e.target.checked ? '' : formData.company_id,
                      project_id: e.target.checked ? '' : formData.project_id
                    })}
                  />
                }
                label="Default Pricing"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading || !formData.name || !formData.tier_type || !formData.unit_price}
          >
            {editingTier ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the pricing tier "{deletingTier?.name}"?
          </Typography>
          {deletingTier?.is_default && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This is a default pricing tier. Deleting it will affect all companies using it.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={loading}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PricingManagementPage;
