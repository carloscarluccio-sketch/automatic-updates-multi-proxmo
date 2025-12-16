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
  Typography,
  Chip,
  Alert,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Receipt as ReceiptIcon,
  Download as DownloadIcon,
  Computer as ComputerIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface BillingEstimate {
  company_id: number;
  company_name: string;
  pricing_plan: {
    id: number;
    name: string;
    billing_cycle: string;
  };
  period_start: string;
  period_end: string;
  base_cost: number;
  overage_cost: number;
  total_cost: number;
  tax_amount: number;
  total_with_tax: number;
  vm_count: number;
  vms: VMCost[];
}

interface VMCost {
  vm_id: number;
  vm_name: string;
  vmid: number;
  base_price: number;
  cpu_cores: number;
  cpu_overage: number;
  cpu_overage_cost: number;
  memory_gb: number;
  memory_overage_gb: number;
  memory_overage_cost: number;
  storage_gb: number;
  storage_overage_gb: number;
  storage_overage_cost: number;
  total_cost: number;
}

interface BillingHistoryItem {
  id: number;
  invoice_number: string;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  tax_amount: number;
  total_with_tax: number;
  status: string;
  invoice_date: string;
  due_date: string;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
}

const BillingDashboardPage: React.FC = () => {
  const [estimate, setEstimate] = useState<BillingEstimate | null>(null);
  const [history, setHistory] = useState<BillingHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [estimateRes, historyRes] = await Promise.all([
        api.get('/billing/estimate'),
        api.get('/billing/history')
      ]);

      if (estimateRes.data.success) {
        setEstimate(estimateRes.data.data);
      }

      if (historyRes.data.success) {
        setHistory(historyRes.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'overdue':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const handleDownloadInvoice = (invoiceId: number) => {
    // TODO: Implement invoice PDF download
    console.log('Download invoice:', invoiceId);
  };

  if (loading && !estimate) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Billing Dashboard</Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={loadBillingData}
          disabled={loading}
          variant="outlined"
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Current Billing Estimate */}
      {estimate && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box display="flex" alignItems="center" mb={2}>
            <MoneyIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Current Billing Estimate</Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="textSecondary">
                Pricing Plan
              </Typography>
              <Typography variant="body1">
                {estimate.pricing_plan.name} ({estimate.pricing_plan.billing_cycle})
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="textSecondary">
                Billing Period
              </Typography>
              <Typography variant="body1">
                {formatDate(estimate.period_start)} - {formatDate(estimate.period_end)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="textSecondary">
                Virtual Machines
              </Typography>
              <Typography variant="h6">{estimate.vm_count}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="textSecondary">
                Base Cost
              </Typography>
              <Typography variant="h6">{formatCurrency(estimate.base_cost)}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="textSecondary">
                Overage Cost
              </Typography>
              <Typography variant="h6">{formatCurrency(estimate.overage_cost)}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="textSecondary">
                Total (with tax)
              </Typography>
              <Typography variant="h6" color="primary">
                {formatCurrency(estimate.total_with_tax)}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* VM Cost Breakdown */}
      {estimate && estimate.vms && estimate.vms.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <Box p={2} display="flex" alignItems="center">
            <ComputerIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Virtual Machine Costs</Typography>
          </Box>
          <Divider />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>VM Name</TableCell>
                  <TableCell align="right">CPU</TableCell>
                  <TableCell align="right">Memory (GB)</TableCell>
                  <TableCell align="right">Storage (GB)</TableCell>
                  <TableCell align="right">Base</TableCell>
                  <TableCell align="right">Overage</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {estimate.vms.map((vm) => (
                  <TableRow key={vm.vm_id}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{vm.vm_name}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          ID: {vm.vmid}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {vm.cpu_cores}
                      {vm.cpu_overage > 0 && (
                        <Chip
                          label={`+${vm.cpu_overage}`}
                          size="small"
                          color="warning"
                          sx={{ ml: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {vm.memory_gb.toFixed(2)}
                      {vm.memory_overage_gb > 0 && (
                        <Chip
                          label={`+${vm.memory_overage_gb.toFixed(2)}`}
                          size="small"
                          color="warning"
                          sx={{ ml: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {vm.storage_gb}
                      {vm.storage_overage_gb > 0 && (
                        <Chip
                          label={`+${vm.storage_overage_gb}`}
                          size="small"
                          color="warning"
                          sx={{ ml: 0.5 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(vm.base_price)}</TableCell>
                    <TableCell align="right">
                      {formatCurrency(
                        vm.cpu_overage_cost + vm.memory_overage_cost + vm.storage_overage_cost
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <strong>{formatCurrency(vm.total_cost)}</strong>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Billing History */}
      <Paper>
        <Box p={2} display="flex" alignItems="center">
          <ReceiptIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Billing History</Typography>
        </Box>
        <Divider />
        {history.length === 0 ? (
          <Box p={3} textAlign="center">
            <Typography color="textSecondary">No billing history available</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Invoice Date</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.invoice_number}</TableCell>
                    <TableCell>
                      {formatDate(item.billing_period_start)} - {formatDate(item.billing_period_end)}
                    </TableCell>
                    <TableCell>{formatDate(item.invoice_date)}</TableCell>
                    <TableCell>{formatDate(item.due_date)}</TableCell>
                    <TableCell align="right">
                      <strong>{formatCurrency(item.total_with_tax)}</strong>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.status.toUpperCase()}
                        color={getStatusColor(item.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Download Invoice">
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadInvoice(item.id)}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default BillingDashboardPage;
