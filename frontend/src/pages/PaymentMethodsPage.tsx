import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  
  Chip,
  IconButton,
  Alert,
  Snackbar,
  CircularProgress,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material';
import {
  CreditCard as CreditCardIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../services/api';

interface PaymentMethod {
  id: number;
  company_id: number;
  type: string;
  provider: string;
  last4?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface Company {
  id: number;
  name: string;
}


let stripePromise: Promise<Stripe | null> | null = null;

const AddPaymentMethodForm: React.FC<{
  companyId: number;
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ companyId, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create setup intent
      const { data: setupData } = await api.post('/payment/methods/setup-intent', { company_id: companyId });

      if (!setupData.success) {
        throw new Error(setupData.message || 'Failed to create setup intent');
      }

      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Confirm setup
      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(
        setupData.data.client_secret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (!setupIntent || !setupIntent.payment_method) {
        throw new Error('Setup failed');
      }

      // Save payment method to backend
      await api.post('/payment/methods', {
        company_id: companyId,
        payment_method_id: setupIntent.payment_method,
        is_default: isDefault,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Card Information
        </Typography>
        <Box
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </Box>
      </Box>

      <FormControlLabel
        control={
          <Switch checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        }
        label="Set as default payment method"
      />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <DialogActions sx={{ mt: 3, px: 0 }}>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={!stripe || loading}>
          {loading ? <CircularProgress size={24} /> : 'Add Payment Method'}
        </Button>
      </DialogActions>
    </form>
  );
};

const PaymentMethodsPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | ''>('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [alert, setAlert] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [tabValue, setTabValue] = useState(0);

  // Stripe config
  const [stripeConfig, setStripeConfig] = useState({
    secret_key: '',
    publishable_key: '',
    webhook_secret: '',
  });

  // PayPal config
  const [paypalConfig, setPaypalConfig] = useState({
    client_id: '',
    client_secret: '',
    mode: 'sandbox' as 'sandbox' | 'live',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadPaymentMethods();
    }
  }, [selectedCompany]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUser(user);

      if (user.role === 'super_admin') {
        const { data: companiesData } = await api.get('/companies');
        if (companiesData.success) {
          setCompanies(companiesData.data);
        }

        // Load payment gateway configs
        await loadStripeConfig();
        await loadPayPalConfig();
      } else {
        setSelectedCompany(user.company_id);
      }
    } catch (error: any) {
      showAlert('Error loading data: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStripeConfig = async () => {
    try {
      const { data } = await api.get('/payment/stripe/config');
      if (data.success && data.data) {
        setStripeConfig({
          secret_key: '',
          publishable_key: data.data.publishable_key || '',
          webhook_secret: '',
        });

        // Initialize Stripe if publishable key exists
        if (data.data.publishable_key) {
          stripePromise = loadStripe(data.data.publishable_key);
        }
      }
    } catch (error: any) {
      console.error('Error loading Stripe config:', error);
    }
  };

  const loadPayPalConfig = async () => {
    try {
      const { data } = await api.get('/payment/paypal/config');
      if (data.success && data.data) {
        setPaypalConfig({
          client_id: data.data.client_id || '',
          client_secret: '',
          mode: data.data.mode || 'sandbox',
        });
      }
    } catch (error: any) {
      console.error('Error loading PayPal config:', error);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const params = currentUser?.role === 'super_admin' ? { company_id: selectedCompany } : {};
      const { data } = await api.get('/payment/methods', { params });

      if (data.success) {
        setPaymentMethods(data.data);
      }
    } catch (error: any) {
      showAlert('Error loading payment methods: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStripeConfig = async () => {
    try {
      setLoading(true);
      const { data } = await api.put('/payment/stripe/config', stripeConfig);

      if (data.success) {
        showAlert('Stripe configuration saved successfully', 'success');
        await loadStripeConfig();
        setConfigDialogOpen(false);
      } else {
        showAlert(data.message || 'Failed to save Stripe configuration', 'error');
      }
    } catch (error: any) {
      showAlert('Error saving Stripe configuration: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePayPalConfig = async () => {
    try {
      setLoading(true);
      const { data } = await api.put('/payment/paypal/config', paypalConfig);

      if (data.success) {
        showAlert('PayPal configuration saved successfully', 'success');
        await loadPayPalConfig();
        setConfigDialogOpen(false);
      } else {
        showAlert(data.message || 'Failed to save PayPal configuration', 'error');
      }
    } catch (error: any) {
      showAlert('Error saving PayPal configuration: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePaymentMethod = async (methodId: number) => {
    if (!confirm('Are you sure you want to delete this payment method?')) {
      return;
    }

    try {
      setLoading(true);
      const params = currentUser?.role === 'super_admin' ? { company_id: selectedCompany } : {};
      const { data } = await api.delete(`/payment/methods/${methodId}`, { params });

      if (data.success) {
        showAlert('Payment method deleted successfully', 'success');
        loadPaymentMethods();
      } else {
        showAlert(data.message || 'Failed to delete payment method', 'error');
      }
    } catch (error: any) {
      showAlert('Error deleting payment method: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (methodId: number) => {
    try {
      setLoading(true);
      const payload = currentUser?.role === 'super_admin' ? { company_id: selectedCompany } : {};
      const { data } = await api.put(`/payment/methods/${methodId}/default`, payload);

      if (data.success) {
        showAlert('Default payment method updated', 'success');
        loadPaymentMethods();
      } else {
        showAlert(data.message || 'Failed to update default payment method', 'error');
      }
    } catch (error: any) {
      showAlert('Error updating default payment method: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message: string, severity: 'success' | 'error') => {
    setAlert({ open: true, message, severity });
  };

  const handleCloseAlert = () => {
    setAlert({ ...alert, open: false });
  };

  const getBrandIcon = (brand?: string) => {
    const brandLower = brand?.toLowerCase();
    if (brandLower === 'visa') return '💳';
    if (brandLower === 'mastercard') return '💳';
    if (brandLower === 'amex') return '💳';
    return '💳';
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Payment Methods
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage payment methods and gateway configurations
        </Typography>
      </Box>

      {currentUser?.role === 'super_admin' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Select Company</InputLabel>
                  <Select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value as number)}
                    label="Select Company"
                  >
                    <MenuItem value="">Select a company...</MenuItem>
                    {companies.map((company) => (
                      <MenuItem key={company.id} value={company.id}>
                        {company.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={() => setConfigDialogOpen(true)}
                  fullWidth
                >
                  Gateway Configuration
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {selectedCompany && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Payment Methods</Typography>
              <Box>
                <IconButton onClick={loadPaymentMethods} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setAddDialogOpen(true)}
                  disabled={loading || !stripePromise}
                  sx={{ ml: 1 }}
                >
                  Add Payment Method
                </Button>
              </Box>
            </Box>

            {!stripePromise && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                Stripe is not configured. Please configure Stripe in Gateway Configuration to add payment methods.
              </Alert>
            )}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : paymentMethods.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <CreditCardIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No payment methods
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Add a payment method to get started
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Card Details</TableCell>
                      <TableCell>Expiration</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paymentMethods.map((method) => (
                      <TableRow key={method.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{getBrandIcon(method.brand)}</span>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {method.brand || method.type}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>•••• •••• •••• {method.last4}</TableCell>
                        <TableCell>
                          {method.exp_month && method.exp_year
                            ? `${method.exp_month.toString().padStart(2, '0')}/${method.exp_year}`
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {method.is_default ? (
                            <Chip label="Default" color="primary" size="small" />
                          ) : (
                            <Chip label="Active" size="small" />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            onClick={() => handleSetDefault(method.id)}
                            disabled={method.is_default}
                            title={method.is_default ? 'Already default' : 'Set as default'}
                          >
                            {method.is_default ? <StarIcon color="primary" /> : <StarBorderIcon />}
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeletePaymentMethod(method.id)}
                            color="error"
                            title="Delete payment method"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Payment Method Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Payment Method</DialogTitle>
        <DialogContent>
          {stripePromise && selectedCompany ? (
            <Elements stripe={stripePromise}>
              <AddPaymentMethodForm
                companyId={selectedCompany as number}
                onSuccess={() => {
                  setAddDialogOpen(false);
                  loadPaymentMethods();
                  showAlert('Payment method added successfully', 'success');
                }}
                onCancel={() => setAddDialogOpen(false)}
              />
            </Elements>
          ) : (
            <Alert severity="error">Stripe is not configured or no company selected</Alert>
          )}
        </DialogContent>
      </Dialog>

      {/* Gateway Configuration Dialog */}
      <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Payment Gateway Configuration</DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
            <Tab label="Stripe" />
            <Tab label="PayPal" />
          </Tabs>

          {tabValue === 0 && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Stripe Configuration
              </Typography>
              <TextField
                fullWidth
                label="Secret Key"
                type="password"
                value={stripeConfig.secret_key}
                onChange={(e) => setStripeConfig({ ...stripeConfig, secret_key: e.target.value })}
                margin="normal"
                helperText="Starts with sk_test_ or sk_live_"
              />
              <TextField
                fullWidth
                label="Publishable Key"
                value={stripeConfig.publishable_key}
                onChange={(e) => setStripeConfig({ ...stripeConfig, publishable_key: e.target.value })}
                margin="normal"
                helperText="Starts with pk_test_ or pk_live_"
              />
              <TextField
                fullWidth
                label="Webhook Secret (Optional)"
                type="password"
                value={stripeConfig.webhook_secret}
                onChange={(e) => setStripeConfig({ ...stripeConfig, webhook_secret: e.target.value })}
                margin="normal"
                helperText="Starts with whsec_"
              />
            </Box>
          )}

          {tabValue === 1 && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                PayPal Configuration
              </Typography>
              <TextField
                fullWidth
                label="Client ID"
                value={paypalConfig.client_id}
                onChange={(e) => setPaypalConfig({ ...paypalConfig, client_id: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Client Secret"
                type="password"
                value={paypalConfig.client_secret}
                onChange={(e) => setPaypalConfig({ ...paypalConfig, client_secret: e.target.value })}
                margin="normal"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Mode</InputLabel>
                <Select
                  value={paypalConfig.mode}
                  onChange={(e) => setPaypalConfig({ ...paypalConfig, mode: e.target.value as 'sandbox' | 'live' })}
                  label="Mode"
                >
                  <MenuItem value="sandbox">Sandbox (Testing)</MenuItem>
                  <MenuItem value="live">Live (Production)</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={tabValue === 0 ? handleSaveStripeConfig : handleSavePayPalConfig}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Save Configuration'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Alert Snackbar */}
      <Snackbar open={alert.open} autoHideDuration={6000} onClose={handleCloseAlert}>
        <Alert onClose={handleCloseAlert} severity={alert.severity} sx={{ width: '100%' }}>
          {alert.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PaymentMethodsPage;
