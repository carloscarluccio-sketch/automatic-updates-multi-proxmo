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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Divider,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Assignment as AssignIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface PricingPlan {
  id: number;
  name: string;
  description?: string;
  company_id?: number;
  base_price: string;
  included_cpu_cores: number;
  included_memory_gb: number;
  included_storage_gb: number;
  overage_cpu_core_price: string;
  overage_memory_gb_price: string;
  overage_storage_gb_price: string;
  billing_cycle: string;
  is_active: boolean;
  is_default: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

interface Company {
  id: number;
  name: string;
  status: string;
  billing_active: boolean;
}

const PricingPlansPage: React.FC = () => {
  const { user } = useAuthStore();
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<PricingPlan>>({
    name: '',
    description: '',
    base_price: '20.00',
    included_cpu_cores: 2,
    included_memory_gb: 4,
    included_storage_gb: 50,
    overage_cpu_core_price: '5.00',
    overage_memory_gb_price: '2.00',
    overage_storage_gb_price: '0.10',
    billing_cycle: 'monthly',
    is_active: true,
    is_default: false,
    display_order: 0,
  });

  // Assignment state
  const [assignCompanyId, setAssignCompanyId] = useState<number | ''>('');

  useEffect(() => {
    loadPricingPlans();
    if (user?.role === 'super_admin') {
      loadCompanies();
    }
  }, [user]);

  const loadPricingPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/pricing-plans');
      setPricingPlans(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load pricing plans');
      console.error('Error loading pricing plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data.data || []);
    } catch (err: any) {
      console.error('Error loading companies:', err);
    }
  };

  const handleOpenDialog = (plan?: PricingPlan) => {
    if (plan) {
      setIsEditing(true);
      setSelectedPlan(plan);
      setFormData({
        name: plan.name,
        description: plan.description || '',
        base_price: plan.base_price,
        included_cpu_cores: plan.included_cpu_cores,
        included_memory_gb: plan.included_memory_gb,
        included_storage_gb: plan.included_storage_gb,
        overage_cpu_core_price: plan.overage_cpu_core_price,
        overage_memory_gb_price: plan.overage_memory_gb_price,
        overage_storage_gb_price: plan.overage_storage_gb_price,
        billing_cycle: plan.billing_cycle,
        is_active: plan.is_active,
        is_default: plan.is_default,
        display_order: plan.display_order,
      });
    } else {
      setIsEditing(false);
      setSelectedPlan(null);
      setFormData({
        name: '',
        description: '',
        base_price: '20.00',
        included_cpu_cores: 2,
        included_memory_gb: 4,
        included_storage_gb: 50,
        overage_cpu_core_price: '5.00',
        overage_memory_gb_price: '2.00',
        overage_storage_gb_price: '0.10',
        billing_cycle: 'monthly',
        is_active: true,
        is_default: false,
        display_order: 0,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPlan(null);
    setIsEditing(false);
  };

  const handleSavePlan = async () => {
    try {
      setLoading(true);
      setError(null);

      if (isEditing && selectedPlan) {
        await api.put(`/pricing-plans/${selectedPlan.id}`, formData);
        setSuccess('Pricing plan updated successfully');
      } else {
        await api.post('/pricing-plans', formData);
        setSuccess('Pricing plan created successfully');
      }

      handleCloseDialog();
      loadPricingPlans();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save pricing plan');
      console.error('Error saving pricing plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) return;

    try {
      setLoading(true);
      setError(null);
      await api.delete(`/pricing-plans/${selectedPlan.id}`);
      setSuccess('Pricing plan deleted successfully');
      setOpenDeleteDialog(false);
      setSelectedPlan(null);
      loadPricingPlans();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete pricing plan');
      console.error('Error deleting pricing plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAssignDialog = (plan: PricingPlan) => {
    setSelectedPlan(plan);
    setAssignCompanyId('');
    setOpenAssignDialog(true);
  };

  const handleAssignPlan = async () => {
    if (!selectedPlan || !assignCompanyId) return;

    try {
      setLoading(true);
      setError(null);
      await api.post(`/pricing-plans/${selectedPlan.id}/assign`, {
        company_id: assignCompanyId,
      });
      setSuccess(`Pricing plan assigned successfully`);
      setOpenAssignDialog(false);
      setSelectedPlan(null);
      setAssignCompanyId('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign pricing plan');
      console.error('Error assigning pricing plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof PricingPlan, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Only super_admin can access this page
  if (user?.role !== 'super_admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access Denied: Only super admins can manage pricing plans.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Pricing Plans Management
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadPricingPlans}
            sx={{ mr: 2 }}
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
            Create Pricing Plan
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Base Price</TableCell>
              <TableCell>Included Resources</TableCell>
              <TableCell>Overage Rates</TableCell>
              <TableCell>Cycle</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Default</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pricingPlans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="textSecondary">
                    {loading ? 'Loading...' : 'No pricing plans found'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              pricingPlans.map(plan => (
                <TableRow key={plan.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body1" fontWeight="bold">
                        {plan.name}
                      </Typography>
                      {plan.description && (
                        <Typography variant="caption" color="textSecondary">
                          {plan.description}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="h6" color="primary">
                      ${plan.base_price}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      per VM/month
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {plan.included_cpu_cores} cores
                    </Typography>
                    <Typography variant="body2">
                      {plan.included_memory_gb} GB RAM
                    </Typography>
                    <Typography variant="body2">
                      {plan.included_storage_gb} GB storage
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      ${plan.overage_cpu_core_price}/core
                    </Typography>
                    <Typography variant="body2">
                      ${plan.overage_memory_gb_price}/GB RAM
                    </Typography>
                    <Typography variant="body2">
                      ${plan.overage_storage_gb_price}/GB storage
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={plan.billing_cycle}
                      size="small"
                      color="default"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={plan.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={plan.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {plan.is_default && (
                      <Tooltip title="Default Plan">
                        <StarIcon color="warning" />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Assign to Company">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenAssignDialog(plan)}
                        color="primary"
                      >
                        <AssignIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(plan)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedPlan(plan);
                          setOpenDeleteDialog(true);
                        }}
                        color="error"
                      >
                        <DeleteIcon />
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
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {isEditing ? 'Edit Pricing Plan' : 'Create Pricing Plan'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={8}>
              <TextField
                label="Plan Name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Billing Cycle</InputLabel>
                <Select
                  value={formData.billing_cycle}
                  onChange={(e) => handleInputChange('billing_cycle', e.target.value)}
                  label="Billing Cycle"
                >
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="quarterly">Quarterly</MenuItem>
                  <MenuItem value="annual">Annual</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>Base Pricing</Divider>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Base Price per VM"
                fullWidth
                required
                type="number"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                value={formData.base_price}
                onChange={(e) => handleInputChange('base_price', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Display Order"
                fullWidth
                type="number"
                value={formData.display_order}
                onChange={(e) => handleInputChange('display_order', parseInt(e.target.value))}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>Included Resources (per VM)</Divider>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label="CPU Cores"
                fullWidth
                required
                type="number"
                value={formData.included_cpu_cores}
                onChange={(e) => handleInputChange('included_cpu_cores', parseInt(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Memory (GB)"
                fullWidth
                required
                type="number"
                value={formData.included_memory_gb}
                onChange={(e) => handleInputChange('included_memory_gb', parseInt(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Storage (GB)"
                fullWidth
                required
                type="number"
                value={formData.included_storage_gb}
                onChange={(e) => handleInputChange('included_storage_gb', parseInt(e.target.value))}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>Overage Pricing (additional resources)</Divider>
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label="Per CPU Core"
                fullWidth
                required
                type="number"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                value={formData.overage_cpu_core_price}
                onChange={(e) => handleInputChange('overage_cpu_core_price', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Per GB Memory"
                fullWidth
                required
                type="number"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                value={formData.overage_memory_gb_price}
                onChange={(e) => handleInputChange('overage_memory_gb_price', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Per GB Storage"
                fullWidth
                required
                type="number"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                value={formData.overage_storage_gb_price}
                onChange={(e) => handleInputChange('overage_storage_gb_price', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.is_active}
                    onChange={(e) => handleInputChange('is_active', e.target.checked)}
                  />
                }
                label="Active"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.is_default}
                    onChange={(e) => handleInputChange('is_default', e.target.checked)}
                  />
                }
                label="Set as Default Plan"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSavePlan}
            variant="contained"
            disabled={loading || !formData.name}
          >
            {isEditing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the pricing plan "{selectedPlan?.name}"?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. Plans currently assigned to companies cannot be deleted.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleDeletePlan} color="error" variant="contained" disabled={loading}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign to Company Dialog */}
      <Dialog open={openAssignDialog} onClose={() => setOpenAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Assign "{selectedPlan?.name}" to Company
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Company</InputLabel>
            <Select
              value={assignCompanyId}
              onChange={(e) => setAssignCompanyId(e.target.value as number)}
              label="Select Company"
            >
              {companies.map(company => (
                <MenuItem key={company.id} value={company.id}>
                  {company.name} {!company.billing_active && '(Billing Disabled)'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAssignDialog(false)}>Cancel</Button>
          <Button
            onClick={handleAssignPlan}
            variant="contained"
            disabled={loading || !assignCompanyId}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PricingPlansPage;
