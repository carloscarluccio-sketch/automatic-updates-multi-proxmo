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
  Chip,
  LinearProgress,
  Button,
  Tabs,
  Tab,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import api from '../services/api';

interface Company {
  id: number;
  name: string;
}

interface CurrentUsage {
  period_start: string;
  period_end: string;
  days_in_month: number;
  days_elapsed: number;
  total_vms: number;
  total_cpu_hours: number;
  total_memory_gb_hours: number;
  total_disk_gb_hours: number;
  total_network_gb: number;
  cost_cpu: number;
  cost_memory: number;
  cost_storage: number;
  cost_network: number;
  total_cost: number;
  estimated_month_end_cost: number;
}

interface VMUsage {
  vm_id: number;
  vm_name: string;
  vmid: number;
  node: string;
  project_name: string | null;
  current_month_cost: number;
  average_daily_cost: number;
  resource_breakdown: {
    cpu_cost: number;
    memory_cost: number;
    storage_cost: number;
    bandwidth_cost: number;
  };
  average_usage: {
    cpu_cores: number;
    memory_gb: number;
    storage_gb: number;
    bandwidth_gb: number;
  };
}

interface DailyCostTrend {
  date: string;
  total_cost: number;
  cpu_cost: number;
  memory_cost: number;
  storage_cost: number;
  bandwidth_cost: number;
}

interface ResourceDistribution {
  resource_type: string;
  percentage: number;
  amount: number;
  color: string;
}

interface ProjectCost {
  project_id: number;
  project_name: string;
  vm_count: number;
  total_cost: number;
  resource_breakdown: {
    cpu: number;
    memory: number;
    storage: number;
    bandwidth: number;
  };
}

interface CostAlert {
  id: number;
  alert_type: string;
  severity: 'warning' | 'critical';
  message: string;
  threshold_value: number;
  current_value: number;
  created_at: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const UsageDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Data states
  const [currentUsage, setCurrentUsage] = useState<CurrentUsage | null>(null);
  const [vmUsageList, setVmUsageList] = useState<VMUsage[]>([]);
  const [dailyCostTrend, setDailyCostTrend] = useState<DailyCostTrend[]>([]);
  const [resourceDistribution, setResourceDistribution] = useState<ResourceDistribution[]>([]);
  const [projectCosts, setProjectCosts] = useState<ProjectCost[]>([]);
  const [costAlerts, setCostAlerts] = useState<CostAlert[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadAllUsageData();
    }
  }, [selectedCompany]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUser(user);

      if (user.role === 'super_admin') {
        const companiesResponse = await api.get('/companies');
        setCompanies(companiesResponse.data.data || []);
      } else {
        setSelectedCompany(user.company_id);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsageData = async () => {
    if (!selectedCompany) return;

    try {
      setLoading(true);
      setError('');

      // Load all data in parallel
      const [
        currentUsageRes,
        vmUsageRes,
        trendRes,
        distributionRes,
        projectsRes,
        alertsRes,
      ] = await Promise.all([
        api.get(`/payg/companies/${selectedCompany}/usage/current`),
        api.get(`/payg/companies/${selectedCompany}/usage/vms`),
        api.get(`/payg/companies/${selectedCompany}/usage/trend?days=30`),
        api.get(`/payg/companies/${selectedCompany}/usage/distribution`),
        api.get(`/payg/companies/${selectedCompany}/usage/projects`),
        api.get(`/payg/companies/${selectedCompany}/alerts`),
      ]);

      setCurrentUsage(currentUsageRes.data.data);
      setVmUsageList(vmUsageRes.data.data || []);
      setDailyCostTrend(trendRes.data.data || []);
      setResourceDistribution(distributionRes.data.data || []);
      setProjectCosts(projectsRes.data.data || []);
      setCostAlerts(alertsRes.data.data || []);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyChange = (companyId: number) => {
    setSelectedCompany(companyId);
  };

  const handleRefresh = () => {
    loadAllUsageData();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getCostTrend = () => {
    if (!currentUsage) return { direction: 'neutral', percentage: 0 };
    const projected = currentUsage.estimated_month_end_cost;
    const current = currentUsage.total_cost;
    const change = ((projected - current) / current) * 100;
    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
      percentage: Math.abs(change),
    };
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Usage Dashboard (Pay-As-You-Go)
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Real-time resource usage and cost tracking
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={!selectedCompany || loading}
          >
            Refresh
          </Button>
        </Box>

        {currentUser?.role === 'super_admin' && (
          <Box sx={{ mb: 3 }}>
            <FormControl sx={{ minWidth: 300 }}>
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

        {/* Cost Alerts */}
        {costAlerts.length > 0 && (
          <Alert
            severity={costAlerts.some((a) => a.severity === 'critical') ? 'error' : 'warning'}
            icon={<WarningIcon />}
            sx={{ mb: 3 }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {costAlerts.length} Active Alert{costAlerts.length > 1 ? 's' : ''}
            </Typography>
            {costAlerts.slice(0, 3).map((alert) => (
              <Typography key={alert.id} variant="body2">
                • {alert.message}
              </Typography>
            ))}
          </Alert>
        )}

        {loading && !currentUsage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && !selectedCompany && (
          <Alert severity="info">Please select a company to view usage data</Alert>
        )}

        {currentUsage && (
          <>
            {/* Current Month Overview Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Current Month Cost
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {formatCurrency(currentUsage.total_cost)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      {getCostTrend().direction === 'up' ? (
                        <TrendingUpIcon color="error" fontSize="small" />
                      ) : (
                        <TrendingDownIcon color="success" fontSize="small" />
                      )}
                      <Typography variant="body2" color="textSecondary" sx={{ ml: 0.5 }}>
                        {getCostTrend().percentage.toFixed(1)}% vs projected
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Projected Month-End
                    </Typography>
                    <Typography variant="h4">
                      {formatCurrency(currentUsage.estimated_month_end_cost)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                      {currentUsage.days_in_month - currentUsage.days_elapsed} days remaining
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Active VMs
                    </Typography>
                    <Typography variant="h4">{currentUsage.total_vms}</Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                      monitored VMs
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Billing Period
                    </Typography>
                    <Typography variant="h6">
                      {formatDate(currentUsage.period_start)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      to {formatDate(currentUsage.period_end)}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(currentUsage.days_elapsed / currentUsage.days_in_month) * 100}
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Tabs for different views */}
            <Card sx={{ mb: 3 }}>
              <Tabs value={activeTab} onChange={(_e, v) => setActiveTab(v)}>
                <Tab label="Cost Trend" />
                <Tab label="Resource Distribution" />
                <Tab label="VM Breakdown" />
                <Tab label="Project Costs" />
              </Tabs>
            </Card>

            {/* Tab 0: Cost Trend Chart */}
            {activeTab === 0 && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Daily Cost Trend (Last 30 Days)
                  </Typography>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={dailyCostTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={formatDate} />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={formatDate}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="total_cost"
                        stroke="#8884d8"
                        strokeWidth={2}
                        name="Total Cost"
                      />
                      <Line type="monotone" dataKey="cpu_cost" stroke="#82ca9d" name="CPU" />
                      <Line type="monotone" dataKey="memory_cost" stroke="#ffc658" name="Memory" />
                      <Line type="monotone" dataKey="storage_cost" stroke="#ff8042" name="Storage" />
                      <Line
                        type="monotone"
                        dataKey="bandwidth_cost"
                        stroke="#0088fe"
                        name="Bandwidth"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Tab 1: Resource Distribution */}
            {activeTab === 1 && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Cost Distribution by Resource Type
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={resourceDistribution}
                            dataKey="amount"
                            nameKey="resource_type"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={(entry: ResourceDistribution) => `${entry.resource_type}: ${entry.percentage}%`}
                          >
                            {resourceDistribution.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Resource Breakdown
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Resource</TableCell>
                              <TableCell align="right">Percentage</TableCell>
                              <TableCell align="right">Amount</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {resourceDistribution.map((resource) => (
                              <TableRow key={resource.resource_type}>
                                <TableCell>{resource.resource_type}</TableCell>
                                <TableCell align="right">{resource.percentage.toFixed(1)}%</TableCell>
                                <TableCell align="right">
                                  {formatCurrency(resource.amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {/* Tab 2: VM Usage Breakdown */}
            {activeTab === 2 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    VM Usage Breakdown
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>VM Name</TableCell>
                          <TableCell>VMID</TableCell>
                          <TableCell>Node</TableCell>
                          <TableCell>Project</TableCell>
                          <TableCell align="right">Avg CPU</TableCell>
                          <TableCell align="right">Avg Memory</TableCell>
                          <TableCell align="right">Storage</TableCell>
                          <TableCell align="right">Bandwidth</TableCell>
                          <TableCell align="right">Monthly Cost</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {vmUsageList.map((vm) => (
                          <TableRow key={vm.vm_id} hover>
                            <TableCell>{vm.vm_name}</TableCell>
                            <TableCell>{vm.vmid}</TableCell>
                            <TableCell>{vm.node}</TableCell>
                            <TableCell>
                              {vm.project_name ? (
                                <Chip label={vm.project_name} size="small" />
                              ) : (
                                <Typography variant="body2" color="textSecondary">
                                  -
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {vm.average_usage.cpu_cores.toFixed(1)} cores
                            </TableCell>
                            <TableCell align="right">
                              {vm.average_usage.memory_gb.toFixed(1)} GB
                            </TableCell>
                            <TableCell align="right">
                              {vm.average_usage.storage_gb.toFixed(1)} GB
                            </TableCell>
                            <TableCell align="right">
                              {vm.average_usage.bandwidth_gb.toFixed(2)} GB
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body1" fontWeight="bold" color="primary">
                                {formatCurrency(vm.current_month_cost)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}

            {/* Tab 3: Project Costs */}
            {activeTab === 3 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Cost by Project
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={projectCosts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="project_name" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="resource_breakdown.cpu" stackId="a" fill="#82ca9d" name="CPU" />
                      <Bar
                        dataKey="resource_breakdown.memory"
                        stackId="a"
                        fill="#ffc658"
                        name="Memory"
                      />
                      <Bar
                        dataKey="resource_breakdown.storage"
                        stackId="a"
                        fill="#ff8042"
                        name="Storage"
                      />
                      <Bar
                        dataKey="resource_breakdown.bandwidth"
                        stackId="a"
                        fill="#0088fe"
                        name="Bandwidth"
                      />
                    </BarChart>
                  </ResponsiveContainer>

                  <TableContainer sx={{ mt: 3 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Project</TableCell>
                          <TableCell align="right">VMs</TableCell>
                          <TableCell align="right">CPU</TableCell>
                          <TableCell align="right">Memory</TableCell>
                          <TableCell align="right">Storage</TableCell>
                          <TableCell align="right">Bandwidth</TableCell>
                          <TableCell align="right">Total Cost</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {projectCosts.map((project) => (
                          <TableRow key={project.project_id} hover>
                            <TableCell>{project.project_name}</TableCell>
                            <TableCell align="right">{project.vm_count}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(project.resource_breakdown.cpu)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(project.resource_breakdown.memory)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(project.resource_breakdown.storage)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(project.resource_breakdown.bandwidth)}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body1" fontWeight="bold" color="primary">
                                {formatCurrency(project.total_cost)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Box>
    </Container>
  );
};

export default UsageDashboardPage;
