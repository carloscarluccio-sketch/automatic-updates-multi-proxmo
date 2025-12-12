import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CloudQueue as TemplateIcon,
  Public as PublicIcon,
  Lock as PrivateIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface VMTemplate {
  id: number;
  name: string;
  description: string | null;
  vmid: number;
  node_name: string;
  cluster_id: number;
  company_id: number | null;
  os_type: 'linux' | 'windows' | 'other';
  os_version: string | null;
  cpu_cores: number | null;
  memory_mb: number | null;
  disk_size_gb: number | null;
  has_cloud_init: boolean | null;
  cloud_init_user: string | null;
  cloud_init_packages: string | null;
  cloud_init_script: string | null;
  network_bridge: string | null;
  network_model: string | null;
  is_public: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  companies?: {
    id: number;
    name: string;
  } | null;
  proxmox_clusters?: {
    id: number;
    name: string;
    host: string;
  };
  users?: {
    id: number;
    username: string;
    email: string;
  };
}

interface Cluster {
  id: number;
  name: string;
  host: string;
  location?: string;
}

interface Company {
  id: number;
  name: string;
}

interface FormData {
  target_company_id: number | '';
  name: string;
  description: string;
  vmid: number | '';
  node_name: string;
  cluster_id: number | '';
  os_type: 'linux' | 'windows' | 'other';
  os_version: string;
  cpu_cores: number;
  memory_mb: number;
  disk_size_gb: number;
  has_cloud_init: boolean;
  cloud_init_user: string;
  cloud_init_packages: string;
  cloud_init_script: string;
  network_bridge: string;
  network_model: string;
  is_public: boolean;
}

const VMTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<VMTemplate[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<VMTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<VMTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [activeTab, setActiveTab] = useState(0);

  const [formData, setFormData] = useState<FormData>({
    target_company_id: '',
    name: '',
    description: '',
    vmid: '',
    node_name: '',
    cluster_id: '',
    os_type: 'linux',
    os_version: '',
    cpu_cores: 2,
    memory_mb: 2048,
    disk_size_gb: 20,
    has_cloud_init: false,
    cloud_init_user: 'ubuntu',
    cloud_init_packages: '',
    cloud_init_script: '',
    network_bridge: 'vmbr0',
    network_model: 'virtio',
    is_public: false,
  });

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserRole(user.role);
    }
    loadTemplates();
    loadClusters();
    if (userRole === 'super_admin') {
      loadCompanies();
    }
  }, [userRole]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/vm-templates');
      setTemplates(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load VM templates');
    } finally {
      setLoading(false);
    }
  };

  const loadClusters = async () => {
    try {
      const response = await api.get('/vm-templates/available-clusters');
      setClusters(response.data.data || []);
    } catch (err) {
      console.error('Failed to load clusters', err);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data.data || []);
    } catch (err) {
      console.error('Failed to load companies', err);
    }
  };

  const handleOpenDialog = (template?: VMTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        target_company_id: template.company_id || '',
        name: template.name,
        description: template.description || '',
        vmid: template.vmid,
        node_name: template.node_name,
        cluster_id: template.cluster_id,
        os_type: template.os_type,
        os_version: template.os_version || '',
        cpu_cores: template.cpu_cores || 2,
        memory_mb: template.memory_mb || 2048,
        disk_size_gb: template.disk_size_gb || 20,
        has_cloud_init: template.has_cloud_init || false,
        cloud_init_user: template.cloud_init_user || 'ubuntu',
        cloud_init_packages: template.cloud_init_packages || '',
        cloud_init_script: template.cloud_init_script || '',
        network_bridge: template.network_bridge || 'vmbr0',
        network_model: template.network_model || 'virtio',
        is_public: template.is_public || false,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        target_company_id: '',
        name: '',
        description: '',
        vmid: '',
        node_name: '',
        cluster_id: '',
        os_type: 'linux',
        os_version: '',
        cpu_cores: 2,
        memory_mb: 2048,
        disk_size_gb: 20,
        has_cloud_init: false,
        cloud_init_user: 'ubuntu',
        cloud_init_packages: '',
        cloud_init_script: '',
        network_bridge: 'vmbr0',
        network_model: 'virtio',
        is_public: false,
      });
    }
    setActiveTab(0);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    setError(null);
    setActiveTab(0);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!formData.name || !formData.vmid || !formData.node_name || !formData.cluster_id) {
        setError('Please fill in all required fields');
        return;
      }

      if (editingTemplate) {
        await api.put(`/vm-templates/${editingTemplate.id}`, formData);
        setSuccess('VM template updated successfully');
      } else {
        await api.post('/vm-templates', formData);
        setSuccess('VM template created successfully');
      }

      handleCloseDialog();
      loadTemplates();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save VM template');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDeleteDialog = (template: VMTemplate) => {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeletingTemplate(null);
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;

    try {
      setLoading(true);
      setError(null);
      await api.delete(`/vm-templates/${deletingTemplate.id}`);
      setSuccess('VM template deleted successfully');
      handleCloseDeleteDialog();
      loadTemplates();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete VM template');
      handleCloseDeleteDialog();
    } finally {
      setLoading(false);
    }
  };

  const getOSTypeColor = (osType: string) => {
    switch (osType) {
      case 'linux': return 'success';
      case 'windows': return 'info';
      case 'other': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TemplateIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4">VM Templates</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadTemplates}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Create Template
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

      {loading && !dialogOpen ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>VMID</TableCell>
                <TableCell>OS Type</TableCell>
                <TableCell>Cluster</TableCell>
                <TableCell>Node</TableCell>
                <TableCell>Resources</TableCell>
                <TableCell>Cloud-Init</TableCell>
                <TableCell>Visibility</TableCell>
                {userRole === 'super_admin' && <TableCell>Company</TableCell>}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={userRole === 'super_admin' ? 10 : 9} align="center">
                    No VM templates found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">{template.name}</Typography>
                      {template.description && (
                        <Typography variant="caption" color="text.secondary">{template.description}</Typography>
                      )}
                    </TableCell>
                    <TableCell>{template.vmid}</TableCell>
                    <TableCell>
                      <Chip
                        label={template.os_type}
                        size="small"
                        color={getOSTypeColor(template.os_type)}
                      />
                      {template.os_version && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {template.os_version}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{template.proxmox_clusters?.name || 'N/A'}</TableCell>
                    <TableCell>{template.node_name}</TableCell>
                    <TableCell>
                      <Typography variant="caption" display="block">
                        {template.cpu_cores || 0} cores
                      </Typography>
                      <Typography variant="caption" display="block">
                        {template.memory_mb || 0} MB RAM
                      </Typography>
                      <Typography variant="caption" display="block">
                        {template.disk_size_gb || 0} GB disk
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {template.has_cloud_init ? (
                        <Chip label="Yes" size="small" color="success" />
                      ) : (
                        <Chip label="No" size="small" color="default" />
                      )}
                    </TableCell>
                    <TableCell>
                      {template.is_public ? (
                        <Chip icon={<PublicIcon />} label="Public" size="small" color="primary" />
                      ) : (
                        <Chip icon={<PrivateIcon />} label="Private" size="small" color="default" />
                      )}
                    </TableCell>
                    {userRole === 'super_admin' && (
                      <TableCell>{template.companies?.name || 'N/A'}</TableCell>
                    )}
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(template)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDeleteDialog(template)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit VM Template' : 'Create VM Template'}
        </DialogTitle>
        <DialogContent>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
            <Tab label="Basic Info" />
            <Tab label="Resources" />
            <Tab label="Cloud-Init" />
            <Tab label="Network" />
          </Tabs>

          {/* Tab 0: Basic Info */}
          {activeTab === 0 && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Template Name"
                  fullWidth
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="VMID"
                  type="number"
                  fullWidth
                  required
                  disabled={!!editingTemplate}
                  value={formData.vmid}
                  onChange={(e) => setFormData({ ...formData, vmid: parseInt(e.target.value) })}
                  inputProps={{ min: 100 }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>

              {userRole === 'super_admin' && !editingTemplate && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Company (Optional)</InputLabel>
                    <Select
                      value={formData.target_company_id}
                      onChange={(e) => setFormData({ ...formData, target_company_id: e.target.value as number })}
                      label="Company (Optional)"
                    >
                      <MenuItem value="">None (Public)</MenuItem>
                      {companies.map((company) => (
                        <MenuItem key={company.id} value={company.id}>
                          {company.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required disabled={!!editingTemplate}>
                  <InputLabel>Cluster</InputLabel>
                  <Select
                    value={formData.cluster_id}
                    onChange={(e) => setFormData({ ...formData, cluster_id: e.target.value as number })}
                    label="Cluster"
                  >
                    <MenuItem value="">Select Cluster</MenuItem>
                    {clusters.map((cluster) => (
                      <MenuItem key={cluster.id} value={cluster.id}>
                        {cluster.name} ({cluster.location || cluster.host})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Node Name"
                  fullWidth
                  required
                  disabled={!!editingTemplate}
                  value={formData.node_name}
                  onChange={(e) => setFormData({ ...formData, node_name: e.target.value })}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>OS Type</InputLabel>
                  <Select
                    value={formData.os_type}
                    onChange={(e) => setFormData({ ...formData, os_type: e.target.value as any })}
                    label="OS Type"
                  >
                    <MenuItem value="linux">Linux</MenuItem>
                    <MenuItem value="windows">Windows</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="OS Version"
                  fullWidth
                  value={formData.os_version}
                  onChange={(e) => setFormData({ ...formData, os_version: e.target.value })}
                  helperText="e.g., Ubuntu 22.04, Windows Server 2022"
                />
              </Grid>

              {userRole === 'super_admin' && (
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.is_public}
                        onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                      />
                    }
                    label="Public Template (Available to all users)"
                  />
                </Grid>
              )}
            </Grid>
          )}

          {/* Tab 1: Resources */}
          {activeTab === 1 && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="CPU Cores"
                  type="number"
                  fullWidth
                  value={formData.cpu_cores}
                  onChange={(e) => setFormData({ ...formData, cpu_cores: parseInt(e.target.value) })}
                  inputProps={{ min: 1, max: 64 }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  label="Memory (MB)"
                  type="number"
                  fullWidth
                  value={formData.memory_mb}
                  onChange={(e) => setFormData({ ...formData, memory_mb: parseInt(e.target.value) })}
                  inputProps={{ min: 512, step: 512 }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  label="Disk Size (GB)"
                  type="number"
                  fullWidth
                  value={formData.disk_size_gb}
                  onChange={(e) => setFormData({ ...formData, disk_size_gb: parseInt(e.target.value) })}
                  inputProps={{ min: 8 }}
                />
              </Grid>
            </Grid>
          )}

          {/* Tab 2: Cloud-Init */}
          {activeTab === 2 && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.has_cloud_init}
                      onChange={(e) => setFormData({ ...formData, has_cloud_init: e.target.checked })}
                    />
                  }
                  label="Enable Cloud-Init"
                />
              </Grid>

              {formData.has_cloud_init && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      label="Default User"
                      fullWidth
                      value={formData.cloud_init_user}
                      onChange={(e) => setFormData({ ...formData, cloud_init_user: e.target.value })}
                      helperText="Default: ubuntu"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Packages (comma-separated)"
                      fullWidth
                      multiline
                      rows={2}
                      value={formData.cloud_init_packages}
                      onChange={(e) => setFormData({ ...formData, cloud_init_packages: e.target.value })}
                      helperText="e.g., qemu-guest-agent,curl,wget"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      label="Cloud-Init Script"
                      fullWidth
                      multiline
                      rows={4}
                      value={formData.cloud_init_script}
                      onChange={(e) => setFormData({ ...formData, cloud_init_script: e.target.value })}
                      helperText="Custom cloud-init user-data script"
                    />
                  </Grid>
                </>
              )}
            </Grid>
          )}

          {/* Tab 3: Network */}
          {activeTab === 3 && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Network Bridge"
                  fullWidth
                  value={formData.network_bridge}
                  onChange={(e) => setFormData({ ...formData, network_bridge: e.target.value })}
                  helperText="e.g., vmbr0"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Network Model</InputLabel>
                  <Select
                    value={formData.network_model}
                    onChange={(e) => setFormData({ ...formData, network_model: e.target.value })}
                    label="Network Model"
                  >
                    <MenuItem value="virtio">VirtIO (Recommended)</MenuItem>
                    <MenuItem value="e1000">E1000</MenuItem>
                    <MenuItem value="rtl8139">RTL8139</MenuItem>
                    <MenuItem value="vmxnet3">VMXNET3</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the VM template "{deletingTemplate?.name}"?
          </Typography>
          {deletingTemplate?.is_public && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This is a public template. Deleting it will affect all users who have access to it.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={loading}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VMTemplatesPage;
