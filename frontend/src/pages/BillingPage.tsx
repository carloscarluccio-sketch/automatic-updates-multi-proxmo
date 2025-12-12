import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
} from '@mui/material';
import {
  Storage as StorageIcon,
  Memory as MemoryIcon,
  Computer as CPUIcon,
  CloudQueue as VMIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface Company {
  id: number;
  name: string;
}

interface BillingOverview {
  company_id: number;
  resources: {
    total_vms: number;
    running_vms: number;
    total_cpu_cores: number;
    total_memory_gb: number;
    total_storage_gb: number;
    ip_ranges: number;
    opnsense_instances: number;
  };
  costs: {
    breakdown: {
      vms: number;
      cpu: number;
      memory: number;
      storage: number;
      ip_ranges: number;
      opnsense: number;
    };
    total_monthly: number;
    currency: string;
  };
  pricing: any;
}

interface AllCompaniesBilling {
  companies: Array<{
    company_id: number;
    company_name: string;
    vm_count: number;
    running_vms: number;
    total_cpu: number;
    total_memory_gb: number;
    total_storage_gb: number;
    estimated_monthly_cost: number;
  }>;
  summary: {
    total_companies: number;
    total_estimated_revenue: number;
    currency: string;
  };
}

const BillingPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | ''>('');
  const [billingOverview, setBillingOverview] = useState<BillingOverview | null>(null);
  const [allCompaniesBilling, setAllCompaniesBilling] = useState<AllCompaniesBilling | null>(null);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'company' | 'all'>('company');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUser(user);

      if (user.role === 'super_admin') {
        // Load companies for super_admin
        const companiesResponse = await api.get('/companies');
        setCompanies(companiesResponse.data.data || []);

        // Load all companies billing by default
        loadAllCompaniesBilling();
      } else {
        // Load company billing for non-super_admin
        setSelectedCompany(user.company_id);
        loadCompanyBilling(user.company_id);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyBilling = async (companyId: number) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/billing/overview?companyId=${companyId}`);
      setBillingOverview(response.data.data);
      setViewMode('company');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const loadAllCompaniesBilling = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/billing/all-companies');
      setAllCompaniesBilling(response.data.data);
      setViewMode('all');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyChange = (companyId: number) => {
    setSelectedCompany(companyId);
    loadCompanyBilling(companyId);
  };

  const handleExportReport = async () => {
    if (!selectedCompany) return;

    try {
      const response = await api.get(`/billing/export?companyId=${selectedCompany}&format=csv`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `billing-report-${selectedCompany}-${new Date().toISOString()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      setError('Failed to export report');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Billing & Usage
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
          Monitor resource usage and billing information
        </Typography>

        {currentUser?.role === 'super_admin' && (
          <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
            <Button
              variant={viewMode === 'all' ? 'contained' : 'outlined'}
              onClick={loadAllCompaniesBilling}
            >
              All Companies
            </Button>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Select Company</InputLabel>
              <Select
                value={selectedCompany}
                label="Select Company"
                onChange={(e) => handleCompanyChange(e.target.value as number)}
              >
                {companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>
                    {company.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Company Billing View */}
        {!loading && viewMode === 'company' && billingOverview && (
          <>
            {/* Resource Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <VMIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">Virtual Machines</Typography>
                    </Box>
                    <Typography variant="h4">{billingOverview.resources.total_vms}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {billingOverview.resources.running_vms} running
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <CPUIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">CPU Cores</Typography>
                    </Box>
                    <Typography variant="h4">{billingOverview.resources.total_cpu_cores}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Total allocated
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <MemoryIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">Memory</Typography>
                    </Box>
                    <Typography variant="h4">{billingOverview.resources.total_memory_gb.toFixed(1)}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      GB allocated
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <StorageIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">Storage</Typography>
                    </Box>
                    <Typography variant="h4">{billingOverview.resources.total_storage_gb}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      GB allocated
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Cost Breakdown */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6">Monthly Cost Breakdown</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportReport}
                  >
                    Export Report
                  </Button>
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Resource</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Rate</TableCell>
                        <TableCell align="right">Monthly Cost</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Virtual Machines (Base Fee)</TableCell>
                        <TableCell align="right">{billingOverview.resources.total_vms}</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.pricing.vm_base)} per VM</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.costs.breakdown.vms)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>CPU Cores</TableCell>
                        <TableCell align="right">{billingOverview.resources.total_cpu_cores}</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.pricing.cpu_per_core)} per core</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.costs.breakdown.cpu)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Memory</TableCell>
                        <TableCell align="right">{billingOverview.resources.total_memory_gb.toFixed(1)} GB</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.pricing.memory_per_gb)} per GB</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.costs.breakdown.memory)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Storage</TableCell>
                        <TableCell align="right">{billingOverview.resources.total_storage_gb} GB</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.pricing.storage_per_gb)} per GB</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.costs.breakdown.storage)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>IP Ranges</TableCell>
                        <TableCell align="right">{billingOverview.resources.ip_ranges}</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.pricing.ip_range)} per range</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.costs.breakdown.ip_ranges)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>OPNsense Instances</TableCell>
                        <TableCell align="right">{billingOverview.resources.opnsense_instances}</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.pricing.opnsense)} per instance</TableCell>
                        <TableCell align="right">{formatCurrency(billingOverview.costs.breakdown.opnsense)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={3} align="right">
                          <strong>Total Monthly Cost:</strong>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="h6" color="primary">
                            {formatCurrency(billingOverview.costs.total_monthly)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        )}

        {/* All Companies View */}
        {!loading && viewMode === 'all' && allCompaniesBilling && (
          <>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {allCompaniesBilling.summary.total_companies}
                      </Typography>
                      <Typography variant="body1" color="textSecondary">
                        Active Companies
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {formatCurrency(allCompaniesBilling.summary.total_estimated_revenue)}
                      </Typography>
                      <Typography variant="body1" color="textSecondary">
                        Total Monthly Revenue
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="info.main">
                        {formatCurrency(allCompaniesBilling.summary.total_estimated_revenue / allCompaniesBilling.summary.total_companies)}
                      </Typography>
                      <Typography variant="body1" color="textSecondary">
                        Average per Company
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Company Billing Overview
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Company</TableCell>
                        <TableCell align="right">VMs</TableCell>
                        <TableCell align="right">Running</TableCell>
                        <TableCell align="right">CPU</TableCell>
                        <TableCell align="right">Memory (GB)</TableCell>
                        <TableCell align="right">Storage (GB)</TableCell>
                        <TableCell align="right">Monthly Cost</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allCompaniesBilling.companies.map((company) => (
                        <TableRow key={company.company_id} hover>
                          <TableCell>{company.company_name}</TableCell>
                          <TableCell align="right">{company.vm_count}</TableCell>
                          <TableCell align="right">
                            <Chip
                              label={company.running_vms}
                              color="success"
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">{company.total_cpu}</TableCell>
                          <TableCell align="right">{company.total_memory_gb}</TableCell>
                          <TableCell align="right">{company.total_storage_gb}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body1" color="primary" fontWeight="bold">
                              {formatCurrency(company.estimated_monthly_cost)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    </Container>
  );
};

export default BillingPage;
