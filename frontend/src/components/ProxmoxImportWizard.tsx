import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  CloudUpload as ImportIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface ESXiHost {
  id: number;
  name: string;
  host: string;
}

interface Cluster {
  id: number;
  name: string;
  host: string;
}

interface ImportableVM {
  volid: string;
  vmid_suggestion?: number;
  name: string;
  guest_os: string;
  cpu_count: number;
  memory_mb: number;
  disk_count: number;
  disk_size_gb: number;
  selected?: boolean;
}

interface ImportProgress {
  vmid: number;
  vm_name: string;
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress_percent: number;
  message?: string;
}

interface ProxmoxImportWizardProps {
  esxiHosts: ESXiHost[];
  clusters: Cluster[];
}

const ProxmoxImportWizard: React.FC<ProxmoxImportWizardProps> = ({ esxiHosts, clusters }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedHost, setSelectedHost] = useState<number | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [storageName, setStorageName] = useState<string>('');
  const [importableVMs, setImportableVMs] = useState<ImportableVM[]>([]);
  const [selectedVMs, setSelectedVMs] = useState<Set<string>>(new Set());
  const [nodes, setNodes] = useState<string[]>([]);
  const [storages, setStorages] = useState<string[]>([]);
  const [bridges, setBridges] = useState<string[]>([]);
  const [targetNode, setTargetNode] = useState<string>('');
  const [targetStorage, setTargetStorage] = useState<string>('');
  const [targetBridge, setTargetBridge] = useState<string>('');
  const [diskFormat, setDiskFormat] = useState<'raw' | 'qcow2' | 'vmdk'>('raw');
  const [startAfterImport, setStartAfterImport] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress[]>([]);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [packageStatus, setPackageStatus] = useState<{installed: boolean; version?: string; available_version?: string} | null>(null);
  const [checkingPackage, setCheckingPackage] = useState(false);
  const [installingPackage, setInstallingPackage] = useState(false);
  const steps = ['Prerequisites', 'Select ESXi Host & Cluster', 'Discover VMs', 'Configure Import', 'Import Progress'];

  useEffect(() => {
    if (selectedCluster) {
      checkPackageStatus(selectedCluster);
      loadClusterResources();
    }
  }, [selectedCluster]);

  const loadClusterResources = async () => {
    try {
      const cluster = clusters.find(c => c.id === selectedCluster);
      if (!cluster) return;

      // Load nodes
      const nodesRes = await api.get(`/clusters/${selectedCluster}/nodes`);
      if (nodesRes.data.success) {
        const nodeList = nodesRes.data.data.map((n: any) => n.node);
        setNodes(nodeList);

        if (nodeList.length > 0) {
          const firstNode = nodeList[0];
          setTargetNode(firstNode);

          // Load storages for the first node
          const storagesRes = await api.get(`/clusters/${selectedCluster}/nodes/${firstNode}/storages`);
          if (storagesRes.data.success) {
            setStorages(storagesRes.data.data.map((s: any) => s.storage));
            if (storagesRes.data.data.length > 0) {
              setTargetStorage(storagesRes.data.data[0].storage);
            }
          }
        }
      }

      // Default bridges
      setBridges(['vmbr0', 'vmbr1', 'vmbr2']);
      setTargetBridge('vmbr0');
  const checkPackageStatus = async (clusterId: number) => {
    setCheckingPackage(true);
    setError(null);
    try {
      const response = await api.get(`/clusters/${clusterId}/check-esxi-tools`);
      setPackageStatus(response.data.data);
      if (!response.data.data.installed) {
        setError('Required package pve-esxi-import-tools is not installed. Please install it first.');
      }
    } catch (err: any) {
      setError(`Failed to check package status: ${err.response?.data?.message || err.message}`);
    } finally {
      setCheckingPackage(false);
    }
  };

  // @ts-ignore - Will be used in UI
  const installPackage = async (clusterId: number) => {
    setInstallingPackage(true);
    console.log('Installing package on cluster:', clusterId);
    setError(null);
    try {
      const response = await api.post(`/clusters/${clusterId}/install-esxi-tools`);
      console.log('Install response:', response.data);
      if (response.data.success) {
        await checkPackageStatus(clusterId);
        setError(null);
      }
    } catch (err: any) {
      console.error('Install error:', err);
      setError(`Installation failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setInstallingPackage(false);
    }
  };
    } catch (err: any) {
      console.error('Failed to load cluster resources:', err);
    }
  };

  const checkPackageStatus = async (clusterId: number) => {
    setCheckingPackage(true);
    setError(null);
    try {
      const response = await api.get(`/clusters/${clusterId}/check-esxi-tools`);
      setPackageStatus(response.data.data);
      if (!response.data.data.installed) {
        setError('Required package pve-esxi-import-tools is not installed on this cluster');
      }
    } catch (err: any) {
      setError(`Failed to check package status: ${err.response?.data?.message || err.message}`);
    } finally {
      setCheckingPackage(false);
    }
  };

  const installPackage = async (clusterId: number) => {
    setInstallingPackage(true);
    setError(null);
    try {
      const response = await api.post(`/clusters/${clusterId}/install-esxi-tools`);
      if (response.data.success) {
        await checkPackageStatus(clusterId);
        setError(null);
      }
    } catch (err: any) {
      setError(`Failed to install package: ${err.response?.data?.message || err.message}`);
    } finally {
      setInstallingPackage(false);
    }
  };

  const handleInitialize = async () => {
    if (!selectedHost || !selectedCluster) {
      setError('Please select both ESXi host and Proxmox cluster');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/esxi-hosts/${selectedHost}/proxmox-import/init`, {
        cluster_id: selectedCluster,
      });

      if (response.data.success) {
        setStorageName(response.data.data.storage_name);
        setImportableVMs(response.data.data.vms.map((vm: ImportableVM) => ({ ...vm, selected: false })));
        setActiveStep(2);
      } else {
        setError(response.data.message || 'Failed to initialize import');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to initialize import');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVM = (volid: string) => {
    const newSelected = new Set(selectedVMs);
    if (newSelected.has(volid)) {
      newSelected.delete(volid);
    } else {
      newSelected.add(volid);
    }
    setSelectedVMs(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedVMs.size === importableVMs.length) {
      setSelectedVMs(new Set());
    } else {
      setSelectedVMs(new Set(importableVMs.map(vm => vm.volid)));
    }
  };

  const handleProceedToConfig = () => {
    if (selectedVMs.size === 0) {
      setError('Please select at least one VM to import');
      return;
    }
    setActiveStep(3);
  };

  const handleExecuteImport = async () => {
    if (!targetNode || !targetStorage || !targetBridge) {
      setError('Please configure all import settings');
      return;
    }

    setLoading(true);
    setError(null);
    setActiveStep(4);

    const vmsToImport = importableVMs.filter(vm => selectedVMs.has(vm.volid));
    const progressArray: ImportProgress[] = vmsToImport.map(vm => ({
      vmid: vm.vmid_suggestion || 0,
      vm_name: vm.name,
      task_id: '',
      status: 'pending',
      progress_percent: 0,
    }));

    setImportProgress(progressArray);

    // Import VMs sequentially
    for (let i = 0; i < vmsToImport.length; i++) {
      const vm = vmsToImport[i];

      try {
        // Update status to running
        setImportProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'running' as const } : p
        ));

        // Execute import
        const response = await api.post(`/esxi-hosts/${selectedHost}/proxmox-import/execute`, {
          cluster_id: selectedCluster,
          storage_name: storageName,
          volid: vm.volid,
          vm_name: vm.name,
          target_node: targetNode,
          target_storage: targetStorage,
          bridge: targetBridge,
          format: diskFormat,
          start_after_import: startAfterImport,
        });

        if (response.data.success) {
          const { vmid, task_id } = response.data.data;

          // Update with task ID
          setImportProgress(prev => prev.map((p, idx) =>
            idx === i ? { ...p, vmid, task_id } : p
          ));

          // Monitor progress
          await monitorImportProgress(i, task_id);
        } else {
          // Mark as failed
          setImportProgress(prev => prev.map((p, idx) =>
            idx === i ? { ...p, status: 'failed' as const, message: response.data.message } : p
          ));
        }
      } catch (err: any) {
        setImportProgress(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'failed' as const, message: err.response?.data?.message || 'Import failed' } : p
        ));
      }
    }

    setLoading(false);
  };

  const monitorImportProgress = async (index: number, taskId: string) => {
    const maxAttempts = 360; // 30 minutes max (5 sec intervals)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await api.get(`/esxi-hosts/${selectedHost}/proxmox-import/progress`, {
          params: {
            task_id: taskId,
            node: targetNode,
            cluster_id: selectedCluster,
          },
        });

        if (response.data.success) {
          const progress = response.data.data;

          setImportProgress(prev => prev.map((p, idx) =>
            idx === index ? {
              ...p,
              status: progress.status,
              progress_percent: progress.progress_percent,
              message: progress.message,
            } : p
          ));

          if (progress.status === 'completed' || progress.status === 'failed') {
            break;
          }
        }
      } catch (err) {
        console.error('Failed to get progress:', err);
      }

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
    }
  };

  const handleCleanup = async () => {
    setLoading(true);
    try {
      await api.delete(`/esxi-hosts/${selectedHost}/proxmox-import/cleanup`, {
        params: {
          storage_name: storageName,
          cluster_id: selectedCluster,
        },
      });
      setCleanupDialogOpen(false);
      // Reset wizard
      setActiveStep(0);
      setSelectedHost(null);
      setSelectedCluster(null);
      setStorageName('');
      setImportableVMs([]);
      setSelectedVMs(new Set());
      setImportProgress([]);
      setPackageStatus(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Cleanup failed');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Check Prerequisites
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Verify that the Proxmox cluster has the required package installed.
            </Typography>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Select Proxmox Cluster</InputLabel>
              <Select
                value={selectedCluster || ''}
                onChange={(e) => setSelectedCluster(Number(e.target.value))}
                label="Select Proxmox Cluster"
              >
                {clusters.map((cluster) => (
                  <MenuItem key={cluster.id} value={cluster.id}>
                    {cluster.name} ({cluster.host})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {checkingPackage && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <CircularProgress size={20} />
                <Typography>Checking package status...</Typography>
              </Box>
            )}

            {packageStatus && (
              <Alert severity={packageStatus.installed ? 'success' : 'warning'} sx={{ mb: 2 }}>
                {packageStatus.installed ? (
                  <>Package pve-esxi-import-tools is installed (version: {packageStatus.version})</>
                ) : (
                  <>Package pve-esxi-import-tools is not installed. {packageStatus.available_version && `Available version: ${packageStatus.available_version}`}</>
                )}
              </Alert>
            )}

            {packageStatus && !packageStatus.installed && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => { console.log('Button clicked, cluster:', selectedCluster); if (selectedCluster) installPackage(selectedCluster); }}
                disabled={installingPackage || !selectedCluster}
                startIcon={installingPackage ? <CircularProgress size={20} /> : null}
              >
                {installingPackage ? 'Installing...' : 'Install pve-esxi-import-tools'}
              </Button>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                onClick={() => setActiveStep(1)}
                disabled={!packageStatus?.installed || !selectedCluster}
              >
                Next
              </Button>
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>ESXi Host</InputLabel>
                  <Select
                    value={selectedHost || ''}
                    onChange={(e) => setSelectedHost(e.target.value as number)}
                    label="ESXi Host"
                  >
                    {esxiHosts.map((host) => (
                      <MenuItem key={host.id} value={host.id}>
                        {host.name} ({host.host})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Proxmox Cluster</InputLabel>
                  <Select
                    value={selectedCluster || ''}
                    onChange={(e) => setSelectedCluster(e.target.value as number)}
                    label="Proxmox Cluster"
                  >
                    {clusters.map((cluster) => (
                      <MenuItem key={cluster.id} value={cluster.id}>
                        {cluster.name} ({cluster.host})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Button onClick={() => setActiveStep(0)}>
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<ImportIcon />}
                    onClick={handleInitialize}
                    disabled={!selectedHost || !selectedCluster || loading}
                    size="large"
                  >
                    {loading ? 'Initializing...' : 'Initialize Import'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Discovered VMs ({importableVMs.length})
              </Typography>
              <Button
                size="small"
                onClick={handleToggleAll}
              >
                {selectedVMs.size === importableVMs.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Box>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedVMs.size === importableVMs.length && importableVMs.length > 0}
                        indeterminate={selectedVMs.size > 0 && selectedVMs.size < importableVMs.length}
                        onChange={handleToggleAll}
                      />
                    </TableCell>
                    <TableCell>VM Name</TableCell>
                    <TableCell>Guest OS</TableCell>
                    <TableCell align="right">CPU</TableCell>
                    <TableCell align="right">RAM (MB)</TableCell>
                    <TableCell align="right">Disks</TableCell>
                    <TableCell align="right">Size (GB)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importableVMs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                          No VMs found on ESXi host
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    importableVMs.map((vm) => (
                      <TableRow
                        key={vm.volid}
                        hover
                        onClick={() => handleToggleVM(vm.volid)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={selectedVMs.has(vm.volid)} />
                        </TableCell>
                        <TableCell>{vm.name}</TableCell>
                        <TableCell>{vm.guest_os}</TableCell>
                        <TableCell align="right">{vm.cpu_count}</TableCell>
                        <TableCell align="right">{vm.memory_mb}</TableCell>
                        <TableCell align="right">{vm.disk_count}</TableCell>
                        <TableCell align="right">{vm.disk_size_gb}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={() => setActiveStep(1)}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleProceedToConfig}
                disabled={selectedVMs.size === 0}
              >
                Continue ({selectedVMs.size} selected)
              </Button>
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Import Configuration
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Target Node</InputLabel>
                  <Select
                    value={targetNode}
                    onChange={(e) => setTargetNode(e.target.value)}
                    label="Target Node"
                  >
                    {nodes.map((node) => (
                      <MenuItem key={node} value={node}>
                        {node}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Target Storage</InputLabel>
                  <Select
                    value={targetStorage}
                    onChange={(e) => setTargetStorage(e.target.value)}
                    label="Target Storage"
                  >
                    {storages.map((storage) => (
                      <MenuItem key={storage} value={storage}>
                        {storage}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Network Bridge</InputLabel>
                  <Select
                    value={targetBridge}
                    onChange={(e) => setTargetBridge(e.target.value)}
                    label="Network Bridge"
                  >
                    {bridges.map((bridge) => (
                      <MenuItem key={bridge} value={bridge}>
                        {bridge}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Disk Format</InputLabel>
                  <Select
                    value={diskFormat}
                    onChange={(e) => setDiskFormat(e.target.value as any)}
                    label="Disk Format"
                  >
                    <MenuItem value="raw">Raw (Fastest)</MenuItem>
                    <MenuItem value="qcow2">QCOW2 (Compressed)</MenuItem>
                    <MenuItem value="vmdk">VMDK (Native)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    checked={startAfterImport}
                    onChange={(e) => setStartAfterImport(e.target.checked)}
                  />
                  <Typography>Start VMs after import completes</Typography>
                </Box>
              </Grid>
            </Grid>
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={() => setActiveStep(2)}>
                Back
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleExecuteImport}
                disabled={!targetNode || !targetStorage || !targetBridge || loading}
              >
                Start Import ({selectedVMs.size} VMs)
              </Button>
            </Box>
          </Box>
        );

      case 4:
        const allCompleted = importProgress.every(p => p.status === 'completed' || p.status === 'failed');
        const anySuccessful = importProgress.some(p => p.status === 'completed');

        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Import Progress
            </Typography>
            {importProgress.map((progress, idx) => (
              <Card key={idx} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {progress.status === 'completed' && <SuccessIcon color="success" />}
                      {progress.status === 'failed' && <ErrorIcon color="error" />}
                      {progress.status === 'running' && <CircularProgress size={20} />}
                      <Typography variant="subtitle1">{progress.vm_name}</Typography>
                    </Box>
                    <Chip
                      label={progress.status.toUpperCase()}
                      color={
                        progress.status === 'completed' ? 'success' :
                        progress.status === 'failed' ? 'error' :
                        progress.status === 'running' ? 'primary' : 'default'
                      }
                      size="small"
                    />
                  </Box>
                  {progress.status === 'running' && (
                    <Box sx={{ mt: 1 }}>
                      <LinearProgress variant="determinate" value={progress.progress_percent} />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {progress.progress_percent}% - {progress.message || 'Importing...'}
                      </Typography>
                    </Box>
                  )}
                  {progress.status === 'failed' && progress.message && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {progress.message}
                    </Alert>
                  )}
                  {progress.status === 'completed' && (
                    <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                      ✓ Import completed successfully (VMID: {progress.vmid})
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
            {allCompleted && (
              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => setCleanupDialogOpen(true)}
                  disabled={loading}
                >
                  Cleanup & Reset
                </Button>
                {anySuccessful && (
                  <Button
                    variant="contained"
                    color="success"
                    href="/vms"
                  >
                    View Imported VMs
                  </Button>
                )}
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {renderStepContent()}

      <Dialog open={cleanupDialogOpen} onClose={() => setCleanupDialogOpen(false)}>
        <DialogTitle>Cleanup Import Session</DialogTitle>
        <DialogContent>
          <Typography>
            This will remove the temporary ESXi storage configuration from Proxmox and reset the import wizard.
            Imported VMs will not be affected.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCleanupDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCleanup} variant="contained" color="primary" disabled={loading}>
            {loading ? 'Cleaning up...' : 'Cleanup'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProxmoxImportWizard;
