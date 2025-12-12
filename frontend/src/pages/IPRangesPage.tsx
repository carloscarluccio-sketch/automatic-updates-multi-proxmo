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
  FormControlLabel,
  Checkbox,
  Tabs,
  Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import CalculateIcon from '@mui/icons-material/Calculate';
import { DataTable, Column } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import ipRangesService, { IPRange, IPRangeFormData } from '../services/ipRangesService';
import { clustersService } from '../services/clustersService';
import { companiesService } from '../services/companiesService';
import SubnetCalculatorComponent from '../components/SubnetCalculatorComponent';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export const IPRangesPage: React.FC = () => {
  const [ipRanges, setIPRanges] = useState<IPRange[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDialog, setOpenDialog] = useState(false);
  const [openInfoDialog, setOpenInfoDialog] = useState(false);
  const [selectedRange, setSelectedRange] = useState<IPRange | null>(null);
  const [availableIPs, setAvailableIPs] = useState<any>(null);
  const [editingRange, setEditingRange] = useState<IPRange | null>(null);
  const [formData, setFormData] = useState<IPRangeFormData>({
    subnet: '',
    description: '',
    gateway: '',
    netmask: '',
    vlan_id: undefined,
    sdn_zone: '',
    sdn_vnet: '',
    ip_type: 'internal',
    is_shared: false,
    cluster_id: 0,
    company_id: undefined,
  });
  const [filterClusterId, setFilterClusterId] = useState<number | ''>('');
  const [filterCompanyId, setFilterCompanyId] = useState<number | ''>('');
  const [filterIPType, setFilterIPType] = useState<string>('');
  const [tabValue, setTabValue] = useState(0);
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadData();
  }, [filterClusterId, filterCompanyId, filterIPType]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load clusters and companies for dropdowns
      const [clustersRes, companiesRes] = await Promise.all([
        clustersService.getAll(),
        currentUser?.role === 'super_admin' ? companiesService.getAll() : Promise.resolve([]),
      ]);

      setClusters(clustersRes || []);
      setCompanies(companiesRes || []);

      // Load IP ranges with filters
      const params: any = {};
      if (filterClusterId) params.cluster_id = filterClusterId;
      if (filterCompanyId) params.company_id = filterCompanyId;
      if (filterIPType) params.ip_type = filterIPType;

      const response = await ipRangesService.getAll(params);
      setIPRanges(response.data.data || []);
    } catch (error) {
      showSnackbar('Failed to load IP ranges', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (range?: IPRange) => {
    if (range) {
      setEditingRange(range);
      setFormData({
        subnet: range.subnet,
        description: range.description || '',
        gateway: range.gateway || '',
        netmask: range.netmask || '',
        vlan_id: range.vlan_id || undefined,
        sdn_zone: range.sdn_zone || '',
        sdn_vnet: range.sdn_vnet || '',
        ip_type: range.ip_type || 'internal',
        is_shared: range.is_shared || false,
        cluster_id: range.cluster_id,
        company_id: range.company_id || undefined,
      });
    } else {
      setEditingRange(null);
      setFormData({
        subnet: '',
        description: '',
        gateway: '',
        netmask: '',
        vlan_id: undefined,
        sdn_zone: '',
        sdn_vnet: '',
        ip_type: 'internal',
        is_shared: false,
        cluster_id: clusters.length > 0 ? clusters[0].id : 0,
        company_id: currentUser?.role === 'super_admin' ? undefined : currentUser?.company_id || undefined,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingRange(null);
  };

  const handleSubmit = async () => {
    try {
      // Validate CIDR format
      if (!formData.subnet.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/)) {
        showSnackbar('Invalid CIDR format. Use format: 10.0.1.0/24', 'error');
        return;
      }

      if (editingRange) {
        await ipRangesService.update(editingRange.id, formData);
        showSnackbar('IP range updated successfully', 'success');
      } else {
        await ipRangesService.create(formData);
        showSnackbar('IP range created successfully', 'success');
      }
      handleCloseDialog();
      await loadData();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async (range: IPRange) => {
    if (!window.confirm(`Are you sure you want to delete IP range "${range.subnet}"?`)) {
      return;
    }

    try {
      await ipRangesService.delete(range.id);
      showSnackbar('IP range deleted successfully', 'success');
      await loadData();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to delete IP range', 'error');
    }
  };

  const handleShowInfo = async (range: IPRange) => {
    try {
      setSelectedRange(range);
      const response = await ipRangesService.getAvailableIPs(range.id);
      setAvailableIPs(response.data.data);
      setOpenInfoDialog(true);
    } catch (error: any) {
      showSnackbar('Failed to load IP information', 'error');
    }
  };

  const getIPTypeChip = (ipType: string | null) => {
    return (
      <Chip
        label={ipType || 'internal'}
        color={ipType === 'external' ? 'primary' : 'default'}
        size="small"
      />
    );
  };

  const columns: Column[] = [
    {
      id: 'subnet',
      label: 'Subnet (CIDR)',
      minWidth: 150,
      format: (value, row: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {value as string}
          {row.is_shared && <Chip label="Shared" size="small" color="info" />}
        </Box>
      ),
    },
    {
      id: 'gateway',
      label: 'Gateway',
      minWidth: 120,
      format: (value) => (value as string) || 'N/A'
    },
    {
      id: 'vlan_id',
      label: 'VLAN',
      minWidth: 80,
      format: (value) => value ? `VLAN ${value}` : 'N/A',
    },
    {
      id: 'ip_type',
      label: 'Type',
      minWidth: 100,
      format: (value) => getIPTypeChip(value as string),
    },
    {
      id: 'proxmox_clusters',
      label: 'Cluster',
      minWidth: 120,
      format: (value: any) => value?.name || 'N/A',
    },
  ];

  if (currentUser?.role === 'super_admin') {
    columns.push({
      id: 'companies',
      label: 'Company',
      minWidth: 120,
      format: (value: any, row: any) => {
        if (row.is_shared) return <Chip label="All Companies" size="small" color="info" />;
        return value?.name || 'N/A';
      },
    });
  }

  columns.push(
    {
      id: '_count',
      label: 'Assigned IPs',
      minWidth: 100,
      format: (value: any) => value?.vm_ip_assignments || 0,
    },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 150,
      format: (_value, row: any) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="View Info">
            <IconButton size="small" onClick={() => handleShowInfo(row)}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {currentUser?.role === 'super_admin' && (
            <>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => handleOpenDialog(row)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      ),
    }
  );

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">IP Ranges & Network Tools</Typography>
          {currentUser?.role === 'super_admin' && tabValue === 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add IP Range
            </Button>
          )}
        </Box>

        {/* Tabs for IP Ranges and Subnet Calculator */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_e, newValue) => setTabValue(newValue)}>
            <Tab label="IP Ranges" icon={<InfoIcon />} iconPosition="start" />
            <Tab label="Subnet Calculator" icon={<CalculateIcon />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* Tab Panel 0: IP Ranges Management */}
        <TabPanel value={tabValue} index={0}>
          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Cluster</InputLabel>
              <Select
                value={filterClusterId}
                onChange={(e) => setFilterClusterId(e.target.value as number)}
                label="Cluster"
              >
                <MenuItem value="">All Clusters</MenuItem>
                {clusters.map((cluster) => (
                  <MenuItem key={cluster.id} value={cluster.id}>
                    {cluster.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {currentUser?.role === 'super_admin' && (
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Company</InputLabel>
                <Select
                  value={filterCompanyId}
                  onChange={(e) => setFilterCompanyId(e.target.value as number)}
                  label="Company"
                >
                  <MenuItem value="">All Companies</MenuItem>
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>IP Type</InputLabel>
              <Select
                value={filterIPType}
                onChange={(e) => setFilterIPType(e.target.value)}
                label="IP Type"
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="internal">Internal</MenuItem>
                <MenuItem value="external">External</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            Found {ipRanges.length} IP ranges. Use filters to narrow results. Switch to Subnet Calculator tab for network planning.
          </Alert>

          <DataTable
            columns={columns}
            rows={ipRanges}
            emptyMessage="No IP ranges found"
          />
        </TabPanel>

        {/* Tab Panel 1: Subnet Calculator */}
        <TabPanel value={tabValue} index={1}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Use this tool to calculate subnet information for network planning. Results can guide IP range creation.
          </Alert>
          <SubnetCalculatorComponent />
        </TabPanel>

        {/* Create/Edit Dialog */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>{editingRange ? 'Edit IP Range' : 'Add IP Range'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Subnet (CIDR)"
                value={formData.subnet}
                onChange={(e) => setFormData({ ...formData, subnet: e.target.value })}
                required
                fullWidth
                placeholder="10.0.1.0/24"
                helperText="Format: IP/mask (e.g., 10.0.1.0/24) - Use Subnet Calculator tab for help"
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Gateway"
                  value={formData.gateway}
                  onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                  fullWidth
                  placeholder="10.0.1.1"
                />
                <TextField
                  label="Netmask"
                  value={formData.netmask}
                  onChange={(e) => setFormData({ ...formData, netmask: e.target.value })}
                  fullWidth
                  placeholder="255.255.255.0"
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="VLAN ID"
                  type="number"
                  value={formData.vlan_id || ''}
                  onChange={(e) => setFormData({ ...formData, vlan_id: e.target.value ? Number(e.target.value) : undefined })}
                  fullWidth
                  placeholder="100"
                />
                <FormControl fullWidth>
                  <InputLabel>IP Type</InputLabel>
                  <Select
                    value={formData.ip_type}
                    onChange={(e) => setFormData({ ...formData, ip_type: e.target.value as 'internal' | 'external' })}
                    label="IP Type"
                  >
                    <MenuItem value="internal">Internal</MenuItem>
                    <MenuItem value="external">External</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="SDN Zone"
                  value={formData.sdn_zone}
                  onChange={(e) => setFormData({ ...formData, sdn_zone: e.target.value })}
                  fullWidth
                  placeholder="zone1"
                  helperText="Proxmox SDN zone (optional)"
                />
                <TextField
                  label="SDN VNet"
                  value={formData.sdn_vnet}
                  onChange={(e) => setFormData({ ...formData, sdn_vnet: e.target.value })}
                  fullWidth
                  placeholder="vnet1"
                  helperText="Proxmox SDN virtual network (optional)"
                />
              </Box>
              <FormControl fullWidth required>
                <InputLabel>Cluster</InputLabel>
                <Select
                  value={formData.cluster_id}
                  onChange={(e) => setFormData({ ...formData, cluster_id: Number(e.target.value) })}
                  label="Cluster"
                >
                  {clusters.map((cluster) => (
                    <MenuItem key={cluster.id} value={cluster.id}>
                      {cluster.name} {cluster.location && `(${cluster.location})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {currentUser?.role === 'super_admin' && (
                <>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.is_shared || false}
                        onChange={(e) => setFormData({ ...formData, is_shared: e.target.checked, company_id: e.target.checked ? undefined : formData.company_id })}
                      />
                    }
                    label="Shared IP Range (available to all companies)"
                  />
                  {!formData.is_shared && (
                    <FormControl fullWidth required>
                      <InputLabel>Company</InputLabel>
                      <Select
                        value={formData.company_id || ''}
                        onChange={(e) => setFormData({ ...formData, company_id: Number(e.target.value) })}
                        label="Company"
                      >
                        {companies.map((company) => (
                          <MenuItem key={company.id} value={company.id}>
                            {company.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} variant="contained" color="primary">
              {editingRange ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Info Dialog */}
        <Dialog open={openInfoDialog} onClose={() => setOpenInfoDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>IP Range Information</DialogTitle>
          <DialogContent>
            {selectedRange && availableIPs && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                <Typography variant="body1">
                  <strong>Subnet:</strong> {selectedRange.subnet}
                </Typography>
                <Typography variant="body1">
                  <strong>Gateway:</strong> {selectedRange.gateway || 'N/A'}
                </Typography>
                <Typography variant="body1">
                  <strong>Assigned IPs:</strong> {availableIPs.assigned_count}
                </Typography>
                {availableIPs.assigned_ips.length > 0 && (
                  <>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Assigned Addresses:</strong>
                    </Typography>
                    <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                      {availableIPs.assigned_ips.map((ip: string, index: number) => (
                        <Chip key={index} label={ip} size="small" sx={{ m: 0.5 }} />
                      ))}
                    </Box>
                  </>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenInfoDialog(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};
