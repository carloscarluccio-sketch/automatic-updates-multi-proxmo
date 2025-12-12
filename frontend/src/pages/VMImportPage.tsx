import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search as SearchIcon,
  CloudDownload as ImportIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface Cluster {
  id: number;
  name: string;
  host: string;
}

interface Company {
  id: number;
  name: string;
}

interface DiscoveredVM {
  vmid: number;
  name: string;
  node: string;
  status: string;
  cpu_cores: number;
  memory_mb: number;
  storage_gb: number;
  uptime?: number;
  ip_address?: string;
}

interface ImportResult {
  imported_count: number;
  skipped_count: number;
  error_count: number;
  imported: any[];
  skipped: any[];
  errors: any[];
}

const VMImportPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<number | ''>('');
  const [selectedCompany, setSelectedCompany] = useState<number | ''>('');
  const [discoveredVMs, setDiscoveredVMs] = useState<DiscoveredVM[]>([]);
  const [selectedVMs, setSelectedVMs] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const steps = ['Select Cluster', 'Discover VMs', 'Import VMs'];

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUser(user);

      // Load clusters
      const clustersResponse = await api.get('/clusters');
      setClusters(clustersResponse.data.data || []);

      // Load companies if super_admin
      if (user.role === 'super_admin') {
        const companiesResponse = await api.get('/companies');
        setCompanies(companiesResponse.data.data || []);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverVMs = async () => {
    if (!selectedCluster) {
      setError('Please select a cluster');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await api.post('/vm-import/discover', {
        cluster_id: selectedCluster
      });

      setDiscoveredVMs(response.data.data.vms || []);
      setActiveStep(1);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to discover VMs');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVM = (vmid: number) => {
    const newSelected = new Set(selectedVMs);
    if (newSelected.has(vmid)) {
      newSelected.delete(vmid);
    } else {
      newSelected.add(vmid);
    }
    setSelectedVMs(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedVMs.size === discoveredVMs.length) {
      setSelectedVMs(new Set());
    } else {
      setSelectedVMs(new Set(discoveredVMs.map(vm => vm.vmid)));
    }
  };

  const handleImportVMs = async () => {
    if (selectedVMs.size === 0) {
      setError('Please select at least one VM to import');
      return;
    }

    if (currentUser?.role === 'super_admin' && !selectedCompany) {
      setError('Please select a company for the imported VMs');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const vmsToImport = discoveredVMs.filter(vm => selectedVMs.has(vm.vmid));

      const response = await api.post('/vm-import/import', {
        cluster_id: selectedCluster,
        company_id: selectedCompany || undefined,
        vms: vmsToImport
      });

      setImportResult(response.data.data);
      setActiveStep(2);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to import VMs');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setSelectedCluster('');
    setSelectedCompany('');
    setDiscoveredVMs([]);
    setSelectedVMs(new Set());
    setImportResult(null);
    setError('');
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">VM Import & Discovery</Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReset}
          >
            Start Over
          </Button>
        </Box>

        <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
          Discover and import existing VMs from your Proxmox clusters
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Step 0: Select Cluster */}
        {activeStep === 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Select Proxmox Cluster
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Cluster</InputLabel>
                    <Select
                      value={selectedCluster}
                      label="Cluster"
                      onChange={(e) => setSelectedCluster(e.target.value as number)}
                    >
                      {clusters.map((cluster) => (
                        <MenuItem key={cluster.id} value={cluster.id}>
                          {cluster.name} ({cluster.host})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {currentUser?.role === 'super_admin' && (
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Target Company (Optional)</InputLabel>
                      <Select
                        value={selectedCompany}
                        label="Target Company (Optional)"
                        onChange={(e) => setSelectedCompany(e.target.value as number)}
                      >
                        <MenuItem value="">
                          <em>Unassigned</em>
                        </MenuItem>
                        {companies.map((company) => (
                          <MenuItem key={company.id} value={company.id}>
                            {company.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={handleDiscoverVMs}
                    disabled={!selectedCluster || loading}
                  >
                    {loading ? 'Discovering...' : 'Discover VMs'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Select VMs to Import */}
        {activeStep === 1 && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Discovered VMs ({discoveredVMs.length})
                </Typography>
                <Box>
                  <Button
                    size="small"
                    onClick={handleSelectAll}
                    sx={{ mr: 1 }}
                  >
                    {selectedVMs.size === discoveredVMs.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<ImportIcon />}
                    onClick={handleImportVMs}
                    disabled={selectedVMs.size === 0 || loading}
                  >
                    Import Selected ({selectedVMs.size})
                  </Button>
                </Box>
              </Box>

              {discoveredVMs.length === 0 ? (
                <Alert severity="info">
                  No new VMs found. All VMs from this cluster may already be imported.
                </Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">Select</TableCell>
                        <TableCell>VMID</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Node</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>CPU</TableCell>
                        <TableCell>Memory (MB)</TableCell>
                        <TableCell>Storage (GB)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {discoveredVMs.map((vm) => (
                        <TableRow
                          key={vm.vmid}
                          hover
                          onClick={() => handleSelectVM(vm.vmid)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox">
                            <input
                              type="checkbox"
                              checked={selectedVMs.has(vm.vmid)}
                              onChange={() => handleSelectVM(vm.vmid)}
                            />
                          </TableCell>
                          <TableCell>{vm.vmid}</TableCell>
                          <TableCell>{vm.name}</TableCell>
                          <TableCell>{vm.node}</TableCell>
                          <TableCell>
                            <Chip
                              label={vm.status}
                              color={vm.status === 'running' ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{vm.cpu_cores}</TableCell>
                          <TableCell>{vm.memory_mb}</TableCell>
                          <TableCell>{vm.storage_gb}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Import Results */}
        {activeStep === 2 && importResult && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Import Results
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <Alert severity="success" icon={<SuccessIcon />}>
                    <strong>{importResult.imported_count}</strong> VMs imported successfully
                  </Alert>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Alert severity="info">
                    <strong>{importResult.skipped_count}</strong> VMs skipped
                  </Alert>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Alert severity="error" icon={<ErrorIcon />}>
                    <strong>{importResult.error_count}</strong> errors
                  </Alert>
                </Grid>
              </Grid>

              {importResult.imported.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Successfully Imported:
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>VMID</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Node</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {importResult.imported.map((vm: any) => (
                          <TableRow key={vm.id}>
                            <TableCell>{vm.vmid}</TableCell>
                            <TableCell>{vm.name}</TableCell>
                            <TableCell>{vm.node}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {importResult.skipped.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Skipped VMs:
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>VMID</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {importResult.skipped.map((vm: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{vm.vmid}</TableCell>
                            <TableCell>{vm.name}</TableCell>
                            <TableCell>{vm.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {importResult.errors.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Errors:
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>VMID</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Error</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {importResult.errors.map((vm: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{vm.vmid}</TableCell>
                            <TableCell>{vm.name}</TableCell>
                            <TableCell>{vm.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              <Button
                variant="contained"
                onClick={handleReset}
              >
                Import More VMs
              </Button>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default VMImportPage;
