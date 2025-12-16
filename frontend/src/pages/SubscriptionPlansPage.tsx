import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  IconButton,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  CardMembership as SubscriptionIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface SubscriptionPlan {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_period: 'monthly' | 'quarterly' | 'yearly';
  trial_days: number;
  // Numeric limits
  vm_limit: number | null;
  storage_gb_limit: number | null;
  cpu_cores_limit: number | null;
  memory_gb_limit: number | null;
  user_limit: number | null;
  cluster_limit: number | null;
  // Feature toggles
  support_level: 'none' | 'email' | 'priority' | '24/7';
  backup_enabled: boolean;
  snapshot_enabled: boolean;
  api_access_enabled: boolean;
  // Display
  features: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
}

const SubscriptionPlansPageNew: React.FC = () => {
  const currentUser = useAuthStore((state) => state.user);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'USD',
    billing_period: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    trial_days: '0',
    // Numeric limits
    vm_limit: '',
    storage_gb_limit: '',
    cpu_cores_limit: '',
    memory_gb_limit: '',
    user_limit: '',
    cluster_limit: '',
    // Feature toggles
    support_level: 'email' as 'none' | 'email' | 'priority' | '24/7',
    backup_enabled: false,
    snapshot_enabled: false,
    api_access_enabled: false,
    // Display
    features: [''],
    is_active: true,
    display_order: 0,
  });

  const isSuperAdmin = currentUser?.role === 'super_admin';

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/subscriptions/plans?is_active=true');
      setPlans(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      currency: 'USD',
      billing_period: 'monthly',
      trial_days: '0',
      vm_limit: '',
      storage_gb_limit: '',
      cpu_cores_limit: '',
      memory_gb_limit: '',
      user_limit: '',
      cluster_limit: '',
      support_level: 'email',
      backup_enabled: false,
      snapshot_enabled: false,
      api_access_enabled: false,
      features: [''],
      is_active: true,
      display_order: 0,
    });
    setSelectedPlan(null);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      const planData = {
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
        currency: formData.currency,
        billing_period: formData.billing_period,
        trial_days: parseInt(formData.trial_days) || 0,
        // Numeric limits (null = unlimited)
        vm_limit: formData.vm_limit ? parseInt(formData.vm_limit) : null,
        storage_gb_limit: formData.storage_gb_limit ? parseInt(formData.storage_gb_limit) : null,
        cpu_cores_limit: formData.cpu_cores_limit ? parseInt(formData.cpu_cores_limit) : null,
        memory_gb_limit: formData.memory_gb_limit ? parseInt(formData.memory_gb_limit) : null,
        user_limit: formData.user_limit ? parseInt(formData.user_limit) : null,
        cluster_limit: formData.cluster_limit ? parseInt(formData.cluster_limit) : null,
        // Feature toggles
        support_level: formData.support_level,
        backup_enabled: formData.backup_enabled,
        snapshot_enabled: formData.snapshot_enabled,
        api_access_enabled: formData.api_access_enabled,
        // Display
        features: formData.features.filter((f) => f.trim() !== ''),
        is_active: formData.is_active,
        display_order: formData.display_order,
      };

      if (selectedPlan) {
        await api.patch(`/subscriptions/plans/${selectedPlan.id}`, planData);
        setSuccess('Plan updated successfully!');
      } else {
        await api.post('/subscriptions/plans', planData);
        setSuccess('Plan created successfully!');
      }

      setDialogOpen(false);
      resetForm();
      loadPlans();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price: plan.price.toString(),
      currency: plan.currency,
      billing_period: plan.billing_period,
      trial_days: plan.trial_days.toString(),
      vm_limit: plan.vm_limit !== null ? plan.vm_limit.toString() : '',
      storage_gb_limit: plan.storage_gb_limit !== null ? plan.storage_gb_limit.toString() : '',
      cpu_cores_limit: plan.cpu_cores_limit !== null ? plan.cpu_cores_limit.toString() : '',
      memory_gb_limit: plan.memory_gb_limit !== null ? plan.memory_gb_limit.toString() : '',
      user_limit: plan.user_limit !== null ? plan.user_limit.toString() : '',
      cluster_limit: plan.cluster_limit !== null ? plan.cluster_limit.toString() : '',
      support_level: plan.support_level,
      backup_enabled: plan.backup_enabled,
      snapshot_enabled: plan.snapshot_enabled,
      api_access_enabled: plan.api_access_enabled,
      features: Array.isArray(plan.features) && plan.features.length > 0 ? plan.features : [''],
      is_active: plan.is_active,
      display_order: plan.display_order,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (planId: number) => {
    if (!confirm('Delete this subscription plan?')) return;

    try {
      setLoading(true);
      await api.delete(`/subscriptions/plans/${planId}`);
      setSuccess('Plan deleted successfully!');
      loadPlans();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete plan');
    } finally {
      setLoading(false);
    }
  };

  const addFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ''] });
  };

  const removeFeature = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index);
    setFormData({ ...formData, features: newFeatures.length > 0 ? newFeatures : [''] });
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            <SubscriptionIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Subscription Plans
          </Typography>
          {isSuperAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              New Plan
            </Button>
          )}
        </Box>

        {/* Alerts */}
        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Plans Grid */}
        <Grid container spacing={3}>
          {loading && plans.length === 0 ? (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            </Grid>
          ) : plans.length === 0 ? (
            <Grid item xs={12}>
              <Typography align="center" color="text.secondary">
                No subscription plans available
              </Typography>
            </Grid>
          ) : (
            plans.map((plan) => (
              <Grid item xs={12} md={4} key={plan.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h5" gutterBottom>
                      {plan.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {plan.description}
                    </Typography>
                    <Box sx={{ my: 2 }}>
                      <Typography variant="h3" component="span">
                        {plan.currency === 'EUR' ? '€' : plan.currency === 'GBP' ? '£' : '$'}
                        {plan.price}
                      </Typography>
                      <Typography variant="body1" component="span">
                        /{plan.billing_period}
                      </Typography>
                      {plan.trial_days > 0 && (
                        <Chip label={`${plan.trial_days} days free trial`} color="success" size="small" sx={{ ml: 1 }} />
                      )}
                    </Box>
                    <List dense>
                      {Array.isArray(plan.features) &&
                        plan.features.map((feature, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <CheckIcon color="success" />
                            </ListItemIcon>
                            <ListItemText primary={feature} />
                          </ListItem>
                        ))}
                    </List>
                  </CardContent>
                  {isSuperAdmin && (
                    <CardActions>
                      <Button size="small" startIcon={<EditIcon />} onClick={() => handleEdit(plan)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(plan.id)}>
                        Delete
                      </Button>
                    </CardActions>
                  )}
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); resetForm(); }} maxWidth="md" fullWidth>
        <DialogTitle>{selectedPlan ? 'Edit' : 'Create'} Subscription Plan</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Basic Information */}
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <TextField
              fullWidth
              label="Plan Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={{ mb: 2 }}
              required
              helperText="e.g., 'Starter', 'Professional', 'Enterprise'"
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              sx={{ mb: 3 }}
              helperText="What does this plan include? This is shown to customers."
            />

            <Divider sx={{ my: 3 }} />

            {/* Pricing */}
            <Typography variant="h6" gutterBottom>
              Pricing
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Price *"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                  helperText="Amount to charge"
                  InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  label="Billing Period *"
                  value={formData.billing_period}
                  onChange={(e) => setFormData({ ...formData, billing_period: e.target.value as any })}
                  helperText="How often to bill"
                  SelectProps={{ native: true }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Every 3 Months</option>
                  <option value="yearly">Yearly (Annual)</option>
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  label="Currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  helperText="Payment currency"
                  SelectProps={{ native: true }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </TextField>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Trial Period */}
            <Typography variant="h6" gutterBottom>
              Trial Period (Optional)
            </Typography>
            <TextField
              fullWidth
              label="Free Trial Days"
              type="number"
              value={formData.trial_days}
              onChange={(e) => setFormData({ ...formData, trial_days: e.target.value })}
              sx={{ mb: 3 }}
              helperText="Number of days customers can try for free. Enter 0 for no trial."
              InputProps={{ inputProps: { min: 0, max: 365 } }}
            />

            <Divider sx={{ my: 3 }} />

            {/* Resource Limits */}
            <Typography variant="h6" gutterBottom>
              Resource Limits
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                These are <strong>ENFORCEABLE LIMITS</strong> that the system will check when users try to create resources.
                <br />
                Leave blank or enter 0 for unlimited. These limits control what customers can actually do, not just what they see.
              </Typography>
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="VM Limit"
                  type="number"
                  value={formData.vm_limit}
                  onChange={(e) => setFormData({ ...formData, vm_limit: e.target.value })}
                  helperText="Maximum number of virtual machines (blank = unlimited)"
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Storage GB Limit"
                  type="number"
                  value={formData.storage_gb_limit}
                  onChange={(e) => setFormData({ ...formData, storage_gb_limit: e.target.value })}
                  helperText="Maximum total storage in GB (blank = unlimited)"
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="CPU Cores Limit"
                  type="number"
                  value={formData.cpu_cores_limit}
                  onChange={(e) => setFormData({ ...formData, cpu_cores_limit: e.target.value })}
                  helperText="Maximum total CPU cores (blank = unlimited)"
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Memory GB Limit"
                  type="number"
                  value={formData.memory_gb_limit}
                  onChange={(e) => setFormData({ ...formData, memory_gb_limit: e.target.value })}
                  helperText="Maximum total memory in GB (blank = unlimited)"
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="User Limit"
                  type="number"
                  value={formData.user_limit}
                  onChange={(e) => setFormData({ ...formData, user_limit: e.target.value })}
                  helperText="Maximum users per company (blank = unlimited)"
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Cluster Limit"
                  type="number"
                  value={formData.cluster_limit}
                  onChange={(e) => setFormData({ ...formData, cluster_limit: e.target.value })}
                  helperText="Maximum Proxmox clusters (blank = unlimited)"
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Feature Toggles */}
            <Typography variant="h6" gutterBottom>
              Features & Services
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                These toggles control which features are <strong>ENABLED</strong> for this plan.
                The system will check these flags before allowing access to features.
              </Typography>
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  label="Support Level"
                  value={formData.support_level}
                  onChange={(e) => setFormData({ ...formData, support_level: e.target.value as any })}
                  helperText="Customer support tier included"
                >
                  <MenuItem value="none">No Support</MenuItem>
                  <MenuItem value="email">Email Support (24-48h)</MenuItem>
                  <MenuItem value="priority">Priority Support (4-12h)</MenuItem>
                  <MenuItem value="24/7">24/7 Support</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ pt: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.backup_enabled}
                        onChange={(e) => setFormData({ ...formData, backup_enabled: e.target.checked })}
                      />
                    }
                    label="Backups Enabled"
                  />
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                    Allow automated backups and snapshots
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.snapshot_enabled}
                      onChange={(e) => setFormData({ ...formData, snapshot_enabled: e.target.checked })}
                    />
                  }
                  label="Snapshots Enabled"
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                  Allow VM snapshots for instant rollback
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.api_access_enabled}
                      onChange={(e) => setFormData({ ...formData, api_access_enabled: e.target.checked })}
                    />
                  }
                  label="API Access Enabled"
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                  Allow programmatic API access
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Marketing Features (Display Only) */}
            <Typography variant="h6" gutterBottom>
              Marketing Features (Display Only)
            </Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                These are <strong>DISPLAY TEXT</strong> shown to customers on the pricing page.
                <br />
                Use the fields above to set actual enforceable limits. These are just for marketing copy.
                <br />
                Example: "Up to 10 VMs", "500 GB Storage", "Email Support", "Automatic Backups"
              </Typography>
            </Alert>

            {formData.features.map((feature, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  placeholder="e.g., Up to 10 Virtual Machines, 500 GB Storage, Email Support"
                  value={feature}
                  onChange={(e) => updateFeature(index, e.target.value)}
                  size="small"
                />
                <IconButton onClick={() => removeFeature(index)} color="error" size="small">
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            <Button startIcon={<AddIcon />} onClick={addFeature} size="small" sx={{ mt: 1 }}>
              Add Feature
            </Button>

            <Divider sx={{ my: 3 }} />

            {/* Display Settings */}
            <Typography variant="h6" gutterBottom>
              Display Settings
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Display Order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  helperText="Lower numbers appear first (0, 1, 2, etc.)"
                  InputProps={{ inputProps: { min: 0 } }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
                  }
                  label="Plan is Active"
                />
                <Typography variant="caption" display="block" color="text.secondary">
                  Only active plans are visible to customers
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name || !formData.price || loading}>
            {loading ? <CircularProgress size={24} /> : selectedPlan ? 'Update Plan' : 'Create Plan'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SubscriptionPlansPageNew;
