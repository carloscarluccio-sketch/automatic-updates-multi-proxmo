import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { vmsService, VM } from '../services/vmsService';
import { DataTable, Column } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';

export const VMsPage: React.FC = () => {
  const [vms, setVMs] = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadVMs();
  }, []);

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

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const columns: Column[] = [
    { id: 'vmid', label: 'VMID', minWidth: 80 },
    { id: 'name', label: 'Name', minWidth: 150 },
    { id: 'node', label: 'Node', minWidth: 100 },
    {
      id: 'status',
      label: 'Status',
      minWidth: 100,
      format: (value) => (value as string | null) || 'unknown',
    },
    {
      id: 'cpu_cores',
      label: 'CPU',
      minWidth: 80,
      format: (value) => `${value || 0} cores`,
    },
    {
      id: 'memory_mb',
      label: 'Memory',
      minWidth: 100,
      format: (value) => `${Math.round((value || 0) / 1024)} GB`,
    },
    {
      id: 'storage_gb',
      label: 'Storage',
      minWidth: 100,
      format: (value) => `${value || 0} GB`,
    },
  ];

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
          <Typography variant="h4">Virtual Machines</Typography>
          {currentUser?.role === 'super_admin' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => showSnackbar('Create VM coming soon', 'success')}
            >
              Create VM
            </Button>
          )}
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Found {vms.length} virtual machines. VM management features will be added in next iterations.
        </Alert>

        <DataTable
          columns={columns}
          rows={vms}
          emptyMessage="No virtual machines found"
        />

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
