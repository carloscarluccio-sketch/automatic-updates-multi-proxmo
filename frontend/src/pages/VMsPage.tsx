import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Chip,
  Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ComputerIcon from '@mui/icons-material/Computer';
import RefreshIcon from '@mui/icons-material/Refresh';
import TerminalIcon from '@mui/icons-material/Terminal';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import SyncIcon from '@mui/icons-material/Sync';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import { vmsService, VM } from '../services/vmsService';
import { clustersService } from '../services/clustersService';
import { companiesService } from '../services/companiesService';
import { projectsService, Project } from '../services/projectsService';
import { DataTable, Column } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { VMConsoleDialog } from '../components/VMConsoleDialog';
import { BatchIPAssignmentDialog } from '../components/BatchIPAssignmentDialog';
import ipRangesService, { IPRange } from '../services/ipRangesService';

interface VMFormData {
  name: string;
  vmid: number;
  node: string;
  cluster_id: number | '';
  company_id?: number;
  cpu_cores: number;
  memory_mb: number;
  storage_gb: number;
  storage?: string;
  iso?: string;
  template_vmid?: number;
  os_type?: string;
  create_in_proxmox?: boolean;
  ip_range_id?: number;
  ip_address?: string;
}

interface IPValidationState {
  checking: boolean;
  isValid: boolean | null;
  message: string;
  conflict?: any;
}

export const VMsPage: React.FC = () => {
  const [vms, setVMs] = useState<VM[]>([]);
  const [filteredVMs, setFilteredVMs] = useState<VM[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDialog, setOpenDialog] = useState(false);
  const [editingVM, setEditingVM] = useState<VM | null>(null);
  const [controllingVM, setControllingVM] = useState<number | null>(null);
  const [consoleVM, setConsoleVM] = useState<VM | null>(null);
  const [consoleDialogOpen, setConsoleDialogOpen] = useState(false);

  // Sync and purge state
  const [syncing, setSyncing] = useState(false);
  const [purging, setPurging] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);

  // Project assignment state
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningVM, setAssigningVM] = useState<VM | null>(null);
  const [selectedProject, setSelectedProject] = useState<number | ''>('');

  // Batch IP assignment state
  const [batchIPDialogOpen, setBatchIPDialogOpen] = useState(false);

  // Filter state
  const [filterCluster, setFilterCluster] = useState<number | ''>('');
  const [filterCompany, setFilterCompany] = useState<number | ''>('');

  const [nodes, setNodes] = useState<any[]>([]);
  const [storages, setStorages] = useState<any[]>([]);
  const [isos, setISOs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // IP Range and Validation state (NEW)
  const [ipRanges, setIPRanges] = useState<IPRange[]>([]);
  const [availableIPs, setAvailableIPs] = useState<string[]>([]);
  const [loadingIPs, setLoadingIPs] = useState(false);
  const [ipValidation, setIPValidation] = useState<IPValidationState>({
    checking: false,
    isValid: null,
    message: '',
  });

  const [formData, setFormData] = useState<VMFormData>({
    name: '',
    vmid: 100,
    node: '',
    cluster_id: '',
    cpu_cores: 2,
    memory_mb: 2048,
    storage_gb: 32,
    storage: '',
    iso: '',
    template_vmid: undefined,
    os_type: 'linux',
    create_in_proxmox: true,
    ip_range_id: undefined,
    ip_address: '',
  });
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadVMs();
    loadClusters();
    loadProjects();
    if (currentUser?.role === 'super_admin') {
      loadCompanies();
    }
  }, [currentUser]);

  useEffect(() => {
    if (formData.cluster_id && openDialog) {
      loadClusterNodes(formData.cluster_id);
      loadNextVMID(formData.cluster_id);
      loadIPRanges(formData.cluster_id);
    } else {
      setNodes([]);
      setIPRanges([]);
      setFormData(prev => ({ ...prev, node: '', storage: '', iso: '', template_vmid: undefined, ip_range_id: undefined, ip_address: '' }));
    }
  }, [formData.cluster_id, openDialog]);

  useEffect(() => {
    if (formData.cluster_id && formData.node) {
      loadNodeStorages(formData.cluster_id, formData.node);
      loadNodeISOs(formData.cluster_id, formData.node);
      loadNodeTemplates(formData.cluster_id, formData.node);
    } else {
      setStorages([]);
      setISOs([]);
      setTemplates([]);
      setFormData(prev => ({ ...prev, storage: '', iso: '', template_vmid: undefined }));
    }
  }, [formData.node]);

  // Load available IPs when IP range is selected (NEW)
  useEffect(() => {
    if (formData.ip_range_id) {
      loadAvailableIPs(formData.ip_range_id);
    } else {
      setAvailableIPs([]);
      setFormData(prev => ({ ...prev, ip_address: '' }));
    }
  }, [formData.ip_range_id]);

  // Validate IP address when it changes (NEW)
  useEffect(() => {
    if (formData.ip_address && formData.ip_range_id) {
      validateIPAddress(formData.ip_address, formData.ip_range_id);
    } else {
      setIPValidation({ checking: false, isValid: null, message: '' });
    }
  }, [formData.ip_address, formData.ip_range_id]);

  // Apply filters whenever vms, filterCluster, or filterCompany changes
  useEffect(() => {
    applyFilters();
  }, [vms, filterCluster, filterCompany]);

  const applyFilters = () => {
    let filtered = [...vms];

    // Filter by cluster
    if (filterCluster !== '') {
      filtered = filtered.filter(vm => vm.cluster_id === filterCluster);
    }

    // Filter by company
    if (filterCompany !== '') {
      filtered = filtered.filter(vm => vm.company_id === filterCompany);
    }

    setFilteredVMs(filtered);
  };

  const handleClearFilters = () => {
    setFilterCluster('');
    setFilterCompany('');
  };

  const loadVMs = async () => {
    try {
      setLoading(true);
      const data = await vmsService.getAll();
      setVMs(data);
    } catch (error) {
      showSnackbar('Failed to load VMs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadClusters = async () => {
    try {
      const data = await clustersService.getAll();
      setClusters(data);
    } catch (error) {
      console.error('Failed to load clusters:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await companiesService.getAll();
      setCompanies(data);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await projectsService.getAll();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadClusterNodes = async (clusterId: number) => {
    try {
      setLoadingResources(true);
      const response = await api.get(`/clusters/${clusterId}/nodes`);
      if (response.data.success) {
        setNodes(response.data.data || []);
        if (response.data.data?.length > 0 && !formData.node) {
          setFormData(prev => ({ ...prev, node: response.data.data[0].node }));
        }
      }
    } catch (error) {
      console.error('Failed to load cluster nodes:', error);
      showSnackbar('Failed to load cluster nodes', 'error');
    } finally {
      setLoadingResources(false);
    }
  };

  const loadNextVMID = async (clusterId: number) => {
    try {
      const response = await api.get(`/clusters/${clusterId}/nextid`);
      if (response.data.success && response.data.data) {
        const nextVMID = typeof response.data.data === 'object' ? response.data.data.vmid : response.data.data;
        setFormData(prev => ({ ...prev, vmid: Number(nextVMID) }));
      } else {
        setFormData(prev => ({ ...prev, vmid: 100 }));
      }
    } catch (error) {
      console.error('Failed to load next VMID:', error);
      setFormData(prev => ({ ...prev, vmid: 100 }));
    }
  };

  const loadNodeStorages = async (clusterId: number, node: string) => {
    try {
      setLoadingResources(true);
      const response = await api.get(`/clusters/${clusterId}/nodes/${node}/storages`);
      if (response.data.success) {
        setStorages(response.data.data || []);
        if (response.data.data?.length > 0 && !formData.storage) {
          setFormData(prev => ({ ...prev, storage: response.data.data[0].storage }));
        }
      }
    } catch (error) {
      console.error('Failed to load storages:', error);
      showSnackbar('Failed to load storages', 'error');
    } finally {
      setLoadingResources(false);
    }
  };

  const loadNodeISOs = async (clusterId: number, node: string) => {
    try {
      setLoadingResources(true);
      const response = await api.get(`/clusters/${clusterId}/nodes/${node}/isos`);
      if (response.data.success) {
        setISOs(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load ISOs:', error);
      showSnackbar('Failed to load ISOs', 'error');
    } finally {
      setLoadingResources(false);
    }
  };

  const loadNodeTemplates = async (clusterId: number, node: string) => {
    try {
      setLoadingResources(true);
      const response = await api.get(`/clusters/${clusterId}/nodes/${node}/templates`);
      if (response.data.success) {
        setTemplates(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      showSnackbar('Failed to load templates', 'error');
    } finally {
      setLoadingResources(false);
    }
  };

  // Load IP ranges for selected cluster (NEW)
  const loadIPRanges = async (clusterId: number) => {
    try {
      const response = await ipRangesService.getAll({ cluster_id: clusterId });
      setIPRanges(response.data.data || []);
    } catch (error) {
      console.error('Failed to load IP ranges:', error);
    }
  };

  // Load available IPs from selected range (NEW)
  const loadAvailableIPs = async (ipRangeId: number) => {
    try {
      setLoadingIPs(true);
      const response = await api.get(`/ip-ranges/${ipRangeId}/available-ips?limit=100`);
      if (response.data.success) {
        setAvailableIPs(response.data.data.available_ips_list || []);
      }
    } catch (error) {
      console.error('Failed to load available IPs:', error);
      showSnackbar('Failed to load available IPs', 'error');
    } finally {
      setLoadingIPs(false);
    }
  };

  // Suggest next available IP (NEW)
  const handleSuggestIP = async () => {
    if (!formData.ip_range_id) {
      showSnackbar('Please select an IP range first', 'error');
      return;
    }

    try {
      const response = await api.get(`/ip-ranges/${formData.ip_range_id}/suggest-ip`);
      if (response.data.success) {
        setFormData(prev => ({ ...prev, ip_address: response.data.data.suggested_ip }));
        showSnackbar('IP address suggested successfully', 'success');
      }
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to suggest IP', 'error');
    }
  };

  // Validate IP address (NEW)
  const validateIPAddress = async (ipAddress: string, ipRangeId: number) => {
    try {
      setIPValidation({ checking: true, isValid: null, message: 'Checking...' });

      const response = await api.post('/ip-ranges/validate-ip', {
        ip_address: ipAddress,
        ip_range_id: ipRangeId,
        vm_id: editingVM?.id,
      });

      if (response.data.available) {
        setIPValidation({
          checking: false,
          isValid: true,
          message: 'IP address is available',
        });
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Conflict
        setIPValidation({
          checking: false,
          isValid: false,
          message: error.response.data.message || 'IP address is already in use',
          conflict: error.response.data.conflict,
        });
      } else if (error.response?.status === 400) {
        // Invalid or reserved
        setIPValidation({
          checking: false,
          isValid: false,
          message: error.response.data.message || 'IP address is invalid',
        });
      } else {
        setIPValidation({
          checking: false,
          isValid: false,
          message: 'Failed to validate IP address',
        });
      }
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleOpenDialog = () => {
    setEditingVM(null);
    setFormData({
      name: '',
      vmid: 100,
      node: '',
      cluster_id: '',
      cpu_cores: 2,
      memory_mb: 2048,
      storage_gb: 32,
      storage: '',
      iso: '',
      template_vmid: undefined,
      os_type: 'linux',
      create_in_proxmox: true,
      ip_range_id: undefined,
      ip_address: '',
    });
    setIPValidation({ checking: false, isValid: null, message: '' });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingVM(null);
    setNodes([]);
    setStorages([]);
    setISOs([]);
    setTemplates([]);
    setIPRanges([]);
    setAvailableIPs([]);
    setIPValidation({ checking: false, isValid: null, message: '' });
  };

  const handleEditVM = (vm: VM) => {
    setEditingVM(vm);
    setFormData({
      name: vm.name,
      vmid: vm.vmid,
      node: vm.node,
      cluster_id: vm.cluster_id,
      company_id: vm.company_id || undefined,
      cpu_cores: vm.cpu_cores || 2,
      memory_mb: vm.memory_mb || 2048,
      storage_gb: vm.storage_gb || 32,
      os_type: (vm as any).os_type || 'linux',
      create_in_proxmox: false,
      ip_range_id: undefined,
      ip_address: '',
    });
    setIPValidation({ checking: false, isValid: null, message: '' });
    setOpenDialog(true);
  };

  const handleSaveVM = async () => {
    try {
      // Frontend validation
      if (!formData.name?.trim()) {
        showSnackbar('VM name is required', 'error');
        return;
      }
      if (!formData.vmid || formData.vmid < 100) {
        showSnackbar('Valid VMID is required (minimum 100)', 'error');
        return;
      }
      if (!formData.node?.trim()) {
        showSnackbar('Node selection is required', 'error');
        return;
      }
      if (!formData.cluster_id) {
        showSnackbar('Cluster selection is required', 'error');
        return;
      }

      // IP validation (NEW)
      if (formData.ip_address && ipValidation.isValid === false) {
        showSnackbar('Please fix IP address issues before creating VM', 'error');
        return;
      }

      // Sanitize data - ensure proper types
      const sanitizedData = {
        name: String(formData.name).trim(),
        vmid: formData.vmid ? Number(formData.vmid) : 100,
        node: String(formData.node).trim(),
        cluster_id: Number(formData.cluster_id),
        company_id: formData.company_id ? Number(formData.company_id) : undefined,
        cpu_cores: Number(formData.cpu_cores) || 2,
        memory_mb: Number(formData.memory_mb) || 2048,
        storage_gb: Number(formData.storage_gb) || 32,
        storage: formData.storage?.trim() || undefined,
        iso: formData.iso?.trim() || undefined,
        template_vmid: formData.template_vmid ? Number(formData.template_vmid) : undefined,
        os_type: formData.os_type || 'linux',
        create_in_proxmox: Boolean(formData.create_in_proxmox),
        ip_range_id: formData.ip_range_id || undefined,
        ip_address: formData.ip_address?.trim() || undefined,
      };

      if (editingVM) {
        await vmsService.update(editingVM.id, sanitizedData);
        showSnackbar('VM updated successfully', 'success');
      } else {
        await vmsService.create(sanitizedData);
        showSnackbar('VM created successfully', 'success');
      }
      handleCloseDialog();
      loadVMs();
    } catch (error: any) {
      console.error('VM save error:', error);
      showSnackbar(error.response?.data?.message || 'Failed to save VM', 'error');
    }
  };

  const handleDeleteVM = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this VM?')) return;
    try {
      await vmsService.delete(id);
      showSnackbar('VM deleted successfully', 'success');
      loadVMs();
    } catch (error) {
      showSnackbar('Failed to delete VM', 'error');
    }
  };

  const handleVMControl = async (vmId: number, action: 'start' | 'stop' | 'restart') => {
    try {
      setControllingVM(vmId);
      await vmsService.control(vmId, action);
      showSnackbar(`VM ${action} initiated`, 'success');
      setTimeout(() => loadVMs(), 2000);
    } catch (error) {
      showSnackbar(`Failed to ${action} VM`, 'error');
    } finally {
      setControllingVM(null);
    }
  };

  const handleOpenConsole = (vm: VM) => {
    setConsoleVM(vm);
    setConsoleDialogOpen(true);
  };

  const handleCloseConsole = () => {
    setConsoleDialogOpen(false);
    setConsoleVM(null);
  };

  const handleOpenAssignDialog = (vm: VM) => {
    setAssigningVM(vm);
    setSelectedProject(vm.project_id || '');
    setAssignDialogOpen(true);
  };

  const handleCloseAssignDialog = () => {
    setAssigningVM(null);
    setSelectedProject('');
    setAssignDialogOpen(false);
  };

  const handleAssignProject = async () => {
    if (!assigningVM) return;
    try {
      const projectId = selectedProject === '' ? null : Number(selectedProject);
      await vmsService.assignToProject(assigningVM.id, projectId);
      showSnackbar(
        projectId ? 'VM assigned to project successfully' : 'VM unassigned from project successfully',
        'success'
      );
      handleCloseAssignDialog();
      loadVMs();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to assign VM to project', 'error');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await api.post('/vms/sync');
      const data = response.data;
      setSyncResults(data.data);
      setSyncDialogOpen(true);
      showSnackbar(
        `Sync complete: ${data.data.synced} synced, ${data.data.not_found} not found`,
        data.data.not_found > 0 ? 'error' : 'success'
      );
      loadVMs();
    } catch (error: any) {
      showSnackbar('Sync failed: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handlePurge = () => {
    setPurgeConfirmOpen(true);
  };

  const handlePurgeConfirm = async () => {
    try {
      setPurging(true);
      setPurgeConfirmOpen(false);
      const response = await api.post('/vms/purge');
      const data = response.data;
      showSnackbar(data.message, 'success');
      loadVMs();
    } catch (error: any) {
      showSnackbar('Purge failed: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setPurging(false);
    }
  };

  const handleCloseSyncDialog = () => {
    setSyncDialogOpen(false);
    setSyncResults(null);
  };

  const columns: Column[] = [
    {
      id: 'vmid',
      label: 'VMID',
      format: (value) => <strong>{value}</strong>,
    },
    {
      id: 'name',
      label: 'Name',
      format: (value) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ComputerIcon fontSize="small" />
          {value}
        </Box>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      format: (value) => (
        <Chip
          label={value}
          color={value === 'running' ? 'success' : value === 'stopped' ? 'default' : 'warning'}
          size="small"
        />
      ),
    },
    {
      id: 'project_id',
      label: 'Project',
      format: (value) => {
        if (!value) return <Chip label="No Project" size="small" variant="outlined" />;
        const project = projects.find(p => p.id === value);
        return (
          <Chip
            icon={<FolderIcon />}
            label={project?.name || `Project ${value}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        );
      },
    },
    {
      id: 'node',
      label: 'Node',
    },
    {
      id: 'cpu_cores',
      label: 'CPU',
      format: (value) => `${value} cores`,
    },
    {
      id: 'memory_mb',
      label: 'Memory',
      format: (value) => `${value} MB`,
    },
    {
      id: 'actions',
      label: 'Actions',
      format: (_value, row) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Start">
            <span>
              <IconButton
                size="small"
                onClick={() => handleVMControl(row.id, 'start')}
                disabled={row.status === 'running' || controllingVM === row.id}
                color="success"
              >
                <PlayArrowIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Stop">
            <span>
              <IconButton
                size="small"
                onClick={() => handleVMControl(row.id, 'stop')}
                disabled={row.status === 'stopped' || controllingVM === row.id}
                color="error"
              >
                <StopIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Restart">
            <span>
              <IconButton
                size="small"
                onClick={() => handleVMControl(row.id, 'restart')}
                disabled={row.status === 'stopped' || controllingVM === row.id}
                color="warning"
              >
                <RestartAltIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Console">
            <IconButton
              size="small"
              onClick={() => handleOpenConsole(row)}
              color="info"
            >
              <TerminalIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Assign to Project">
            <IconButton
              size="small"
              onClick={() => handleOpenAssignDialog(row)}
              color="secondary"
            >
              <FolderIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleEditVM(row)} color="primary">
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => handleDeleteVM(row.id)} color="error">
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Virtual Machines</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
              onClick={handleSync}
              disabled={syncing || purging}
            >
              Sync
            </Button>
            <Button
              variant="outlined"
              color="warning"
              startIcon={purging ? <CircularProgress size={20} /> : <DeleteSweepIcon />}
              onClick={handlePurge}
              disabled={syncing || purging}
            >
              Purge
            </Button>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadVMs}>
              Refresh
            </Button>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<GroupWorkIcon />}
              onClick={() => setBatchIPDialogOpen(true)}
              disabled={filteredVMs.length === 0}
            >
              Batch Assign IPs
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
              Create VM
            </Button>
          </Box>
        </Box>

        {/* Filter Controls */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FilterListIcon color="action" />

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Cluster</InputLabel>
            <Select
              value={filterCluster}
              label="Filter by Cluster"
              onChange={(e) => setFilterCluster(e.target.value as number | '')}
              size="small"
            >
              <MenuItem value="">
                <em>All Clusters</em>
              </MenuItem>
              {clusters.map((cluster) => (
                <MenuItem key={cluster.id} value={cluster.id}>
                  {cluster.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {currentUser?.role === 'super_admin' && (
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Company</InputLabel>
              <Select
                value={filterCompany}
                label="Filter by Company"
                onChange={(e) => setFilterCompany(e.target.value as number | '')}
                size="small"
              >
                <MenuItem value="">
                  <em>All Companies</em>
                </MenuItem>
                {companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>
                    {company.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {(filterCluster !== '' || filterCompany !== '') && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            Showing {filteredVMs.length} of {vms.length} VMs
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataTable columns={columns} rows={filteredVMs} />
        )}

        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>{editingVM ? 'Edit VM' : 'Create VM'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              <TextField
                label="VM Name"
                fullWidth
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={!formData.name}
                helperText={!formData.name ? 'Name is required' : ''}
              />

              <TextField
                label="VMID"
                fullWidth
                required
                type="number"
                value={formData.vmid || ''}
                onChange={(e) => setFormData({ ...formData, vmid: parseInt(e.target.value) || 100 })}
                helperText="Auto-generated from cluster when cluster is selected"
              />

              {currentUser?.role === 'super_admin' && (
                <FormControl fullWidth>
                  <InputLabel>Company</InputLabel>
                  <Select
                    value={formData.company_id || ''}
                    label="Company"
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value as number })}
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
              )}

              <FormControl fullWidth required error={!formData.cluster_id}>
                <InputLabel>Cluster *</InputLabel>
                <Select
                  value={formData.cluster_id}
                  label="Cluster *"
                  onChange={(e) => setFormData({ ...formData, cluster_id: e.target.value as number })}
                >
                  {clusters.map((cluster) => (
                    <MenuItem key={cluster.id} value={cluster.id}>
                      {cluster.name} ({cluster.host})
                    </MenuItem>
                  ))}
                </Select>
                {!formData.cluster_id && <Typography variant="caption" color="error" sx={{ ml: 2 }}>Cluster is required</Typography>}
              </FormControl>

              <FormControl fullWidth required disabled={!formData.cluster_id || loadingResources} error={!formData.node}>
                <InputLabel>Node *</InputLabel>
                <Select
                  value={formData.node}
                  label="Node *"
                  onChange={(e) => setFormData({ ...formData, node: e.target.value })}
                >
                  {nodes.map((node) => (
                    <MenuItem key={node.node} value={node.node}>
                      {node.node} ({node.status})
                    </MenuItem>
                  ))}
                </Select>
                {!formData.node && formData.cluster_id && <Typography variant="caption" color="error" sx={{ ml: 2 }}>Node is required</Typography>}
              </FormControl>

              <FormControl fullWidth disabled={!formData.node || loadingResources}>
                <InputLabel>Storage</InputLabel>
                <Select
                  value={formData.storage || ''}
                  label="Storage"
                  onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                >
                  {storages.map((storage) => (
                    <MenuItem key={storage.storage} value={storage.storage}>
                      {storage.storage} ({storage.type}) - {Math.round((storage.avail || 0) / 1024 / 1024 / 1024)} GB free
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Storage Size (GB)"
                fullWidth
                type="number"
                value={formData.storage_gb}
                onChange={(e) => setFormData({ ...formData, storage_gb: parseInt(e.target.value) || 32 })}
              />

              <FormControl fullWidth disabled={!formData.node || loadingResources}>
                <InputLabel>ISO Image (Optional)</InputLabel>
                <Select
                  value={formData.iso || ''}
                  label="ISO Image (Optional)"
                  onChange={(e) => setFormData({ ...formData, iso: e.target.value })}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {isos.map((iso) => (
                    <MenuItem key={iso.volid} value={iso.volid}>
                      {iso.volid} ({Math.round((iso.size || 0) / 1024 / 1024)} MB)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth disabled={!formData.node || loadingResources}>
                <InputLabel>Clone from Template (Optional)</InputLabel>
                <Select
                  value={formData.template_vmid || ''}
                  label="Clone from Template (Optional)"
                  onChange={(e) => setFormData({ ...formData, template_vmid: e.target.value as number })}
                >
                  <MenuItem value="">
                    <em>None - Create from scratch</em>
                  </MenuItem>
                  {templates.map((template) => (
                    <MenuItem key={template.vmid} value={template.vmid}>
                      {template.name} (VMID: {template.vmid})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="CPU Cores"
                fullWidth
                type="number"
                value={formData.cpu_cores || ''}
                onChange={(e) => setFormData({ ...formData, cpu_cores: parseInt(e.target.value) || 2 })}
              />

              <TextField
                label="Memory (MB)"
                fullWidth
                type="number"
                value={formData.memory_mb || ''}
                onChange={(e) => setFormData({ ...formData, memory_mb: parseInt(e.target.value) || 2048 })}
              />

              <FormControl fullWidth>
                <InputLabel>OS Type</InputLabel>
                <Select
                  value={formData.os_type || 'linux'}
                  label="OS Type"
                  onChange={(e) => setFormData({ ...formData, os_type: e.target.value })}
                >
                  <MenuItem value="linux">Linux</MenuItem>
                  <MenuItem value="windows">Windows</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>

              {/* NEW: Network Configuration Section */}
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mt: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Network Configuration (Optional)
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>IP Range</InputLabel>
                  <Select
                    value={formData.ip_range_id || ''}
                    label="IP Range"
                    onChange={(e) => setFormData({ ...formData, ip_range_id: e.target.value as number })}
                    disabled={!formData.cluster_id}
                  >
                    <MenuItem value="">
                      <em>No Static IP (Use DHCP)</em>
                    </MenuItem>
                    {ipRanges.map((range) => (
                      <MenuItem key={range.id} value={range.id}>
                        {range.subnet} {range.description && `- ${range.description}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {formData.ip_range_id && (
                  <>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Autocomplete
                        fullWidth
                        freeSolo
                        options={availableIPs}
                        value={formData.ip_address || ''}
                        onChange={(_event, newValue) => setFormData({ ...formData, ip_address: newValue || '' })}
                        onInputChange={(_event, newValue) => setFormData({ ...formData, ip_address: newValue })}
                        loading={loadingIPs}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="IP Address"
                            placeholder="Select or enter IP address"
                            InputProps={{
                              ...params.InputProps,
                              endAdornment: (
                                <>
                                  {loadingIPs ? <CircularProgress color="inherit" size={20} /> : null}
                                  {params.InputProps.endAdornment}
                                  {ipValidation.checking && <CircularProgress color="inherit" size={20} />}
                                  {ipValidation.isValid === true && <CheckCircleIcon color="success" />}
                                  {ipValidation.isValid === false && <WarningIcon color="error" />}
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                      <Button
                        variant="outlined"
                        onClick={handleSuggestIP}
                        disabled={!formData.ip_range_id || loadingIPs}
                        sx={{ minWidth: 'auto', whiteSpace: 'nowrap' }}
                      >
                        Suggest IP
                      </Button>
                    </Box>

                    {ipValidation.message && (
                      <Alert
                        severity={ipValidation.isValid === true ? 'success' : ipValidation.isValid === false ? 'error' : 'info'}
                        sx={{ mt: 1 }}
                      >
                        {ipValidation.message}
                        {ipValidation.conflict && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" display="block">
                              Assigned to: {ipValidation.conflict.assigned_to_vm} (VMID: {ipValidation.conflict.assigned_to_vmid})
                            </Typography>
                          </Box>
                        )}
                      </Alert>
                    )}

                    {availableIPs.length > 0 && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        {availableIPs.length} available IP addresses in this range
                      </Typography>
                    )}
                  </>
                )}
              </Box>

              {loadingResources && (
                <Alert severity="info">Loading cluster resources...</Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSaveVM} variant="contained">
              {editingVM ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>

      {/* Console Dialog */}
      <VMConsoleDialog
        open={consoleDialogOpen}
        onClose={handleCloseConsole}
        vm={consoleVM}
      />

      {/* Batch IP Assignment Dialog */}
      <BatchIPAssignmentDialog
        open={batchIPDialogOpen}
        onClose={() => setBatchIPDialogOpen(false)}
        vms={filteredVMs}
        ipRanges={ipRanges}
        onSuccess={() => {
          showSnackbar('Batch IP assignment completed successfully', 'success');
          loadVMs();
          setBatchIPDialogOpen(false);
        }}
      />

      {/* Project Assignment Dialog */}
      <Dialog open={assignDialogOpen} onClose={handleCloseAssignDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Assign VM to Project</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              VM: <strong>{assigningVM?.name}</strong> (VMID: {assigningVM?.vmid})
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Project</InputLabel>
              <Select
                value={selectedProject}
                label="Project"
                onChange={(e) => setSelectedProject(e.target.value as number | '')}
              >
                <MenuItem value="">
                  <em>No Project (Unassign)</em>
                </MenuItem>
                {projects
                  .filter((project) => project.company_id === assigningVM?.company_id)
                  .map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            {projects.filter((p) => p.company_id === assigningVM?.company_id).length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No projects available for this company. Create a project first.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAssignDialog}>Cancel</Button>
          <Button onClick={handleAssignProject} variant="contained" color="primary">
            {selectedProject === '' ? 'Unassign' : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Purge Confirmation Dialog */}
      <Dialog open={purgeConfirmOpen} onClose={() => setPurgeConfirmOpen(false)}>
        <DialogTitle>Confirm Purge Ghost VMs</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will mark all VMs that don't exist in Proxmox as deleted. This action cannot be undone.
          </Alert>
          <Typography>
            Are you sure you want to purge ghost VMs from the database?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurgeConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handlePurgeConfirm} variant="contained" color="warning">
            Purge
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync Results Dialog */}
      <Dialog open={syncDialogOpen} onClose={handleCloseSyncDialog} maxWidth="md" fullWidth>
        <DialogTitle>Sync Results</DialogTitle>
        <DialogContent>
          {syncResults && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Chip label={`Total: ${syncResults.total}`} />
                <Chip label={`Synced: ${syncResults.synced}`} color="success" />
                <Chip label={`Not Found: ${syncResults.not_found}`} color="warning" />
                <Chip label={`Errors: ${syncResults.errors}`} color="error" />
              </Box>

              {syncResults.details && syncResults.details.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom>
                    Details
                  </Typography>
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {syncResults.details.map((detail: any, index: number) => (
                      <Alert
                        key={index}
                        severity={
                          detail.status === 'synced'
                            ? 'success'
                            : detail.status === 'not_found_in_proxmox'
                            ? 'warning'
                            : 'error'
                        }
                        sx={{ mb: 1 }}
                      >
                        <strong>{detail.name}</strong> (VMID: {detail.vmid})
                        {detail.message && ` - ${detail.message}`}
                        {detail.proxmox_status && ` - Status: ${detail.proxmox_status}`}
                      </Alert>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSyncDialog}>Close</Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Container>
  );
};

export default VMsPage;
