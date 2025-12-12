import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  LinearProgress,
  TextField,
  FormControlLabel,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { VM } from '../services/vmsService';
import { IPRange } from '../services/ipRangesService';
import api from '../services/api';

interface BatchIPAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  vms: VM[];
  ipRanges: IPRange[];
  onSuccess: () => void;
}

interface PreviewAssignment {
  vm_id: number;
  vm_name: string;
  vmid: number;
  assigned_ip: string;
}

interface BatchResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  details: Array<{
    vm_id: number;
    vm_name: string;
    ip_address?: string;
    status: 'success' | 'failed' | 'skipped';
    message: string;
  }>;
}

export const BatchIPAssignmentDialog: React.FC<BatchIPAssignmentDialogProps> = ({
  open,
  onClose,
  vms,
  ipRanges,
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedVMs, setSelectedVMs] = useState<number[]>([]);
  const [selectedIPRange, setSelectedIPRange] = useState<number | ''>('');
  const [startIP, setStartIP] = useState('');
  const [useStartIP, setUseStartIP] = useState(false);
  const [preview, setPreview] = useState<PreviewAssignment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<BatchResult | null>(null);

  const steps = ['Select VMs', 'Choose IP Range', 'Preview', 'Confirm'];

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setActiveStep(0);
      setSelectedVMs([]);
      setSelectedIPRange('');
      setStartIP('');
      setUseStartIP(false);
      setPreview(null);
      setError('');
      setResult(null);
    }
  }, [open]);

  const handleSelectAllVMs = () => {
    if (selectedVMs.length === vms.length) {
      setSelectedVMs([]);
    } else {
      setSelectedVMs(vms.map((vm) => vm.id));
    }
  };

  const handleToggleVM = (vmId: number) => {
    setSelectedVMs((prev) =>
      prev.includes(vmId) ? prev.filter((id) => id !== vmId) : [...prev, vmId]
    );
  };

  const handleNext = async () => {
    if (activeStep === 2) {
      // Generate preview before going to confirmation
      await generatePreview();
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError('');
  };

  const generatePreview = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.post('/batch-ip/preview', {
        ip_range_id: selectedIPRange,
        vm_ids: selectedVMs,
        start_ip: useStartIP ? startIP : undefined,
      });

      if (response.data.success) {
        setPreview(response.data.data.assignments);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.post('/batch-ip/assign', {
        ip_range_id: selectedIPRange,
        vm_ids: selectedVMs,
        auto_assign: true,
        start_ip: useStartIP ? startIP : undefined,
      });

      if (response.data.success) {
        setResult(response.data.data);
        setActiveStep(steps.length); // Move to results step
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign IPs');
    } finally {
      setLoading(false);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="body1">
                Select VMs for batch IP assignment ({selectedVMs.length} selected)
              </Typography>
              <Button onClick={handleSelectAllVMs} size="small">
                {selectedVMs.length === vms.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedVMs.length === vms.length && vms.length > 0}
                        indeterminate={selectedVMs.length > 0 && selectedVMs.length < vms.length}
                        onChange={handleSelectAllVMs}
                      />
                    </TableCell>
                    <TableCell>VMID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Node</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vms.map((vm) => (
                    <TableRow key={vm.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedVMs.includes(vm.id)}
                          onChange={() => handleToggleVM(vm.id)}
                        />
                      </TableCell>
                      <TableCell>{vm.vmid}</TableCell>
                      <TableCell>{vm.name}</TableCell>
                      <TableCell>{vm.node}</TableCell>
                      <TableCell>
                        <Chip
                          label={vm.status}
                          size="small"
                          color={vm.status === 'running' ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {selectedVMs.length === 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Please select at least one VM to continue.
              </Alert>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="body1" gutterBottom>
              Choose IP range for batch assignment
            </Typography>

            <FormControl fullWidth sx={{ mt: 2, mb: 3 }}>
              <InputLabel>IP Range</InputLabel>
              <Select
                value={selectedIPRange}
                onChange={(e) => setSelectedIPRange(e.target.value as number)}
                label="IP Range"
              >
                {ipRanges.map((range) => (
                  <MenuItem key={range.id} value={range.id}>
                    {range.subnet} - {range.description || 'No description'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Checkbox
                  checked={useStartIP}
                  onChange={(e) => setUseStartIP(e.target.checked)}
                />
              }
              label="Start from specific IP address"
            />

            {useStartIP && (
              <TextField
                fullWidth
                label="Start IP Address"
                value={startIP}
                onChange={(e) => setStartIP(e.target.value)}
                placeholder="10.0.1.100"
                helperText="IPs will be assigned sequentially starting from this address"
                sx={{ mt: 2 }}
              />
            )}

            {selectedIPRange && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {selectedVMs.length} VMs will be assigned IP addresses from this range.
              </Alert>
            )}

            {!selectedIPRange && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Please select an IP range to continue.
              </Alert>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="body1" gutterBottom>
              Preview IP assignments
            </Typography>

            {loading && (
              <Box sx={{ my: 2 }}>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Generating preview...
                </Typography>
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ my: 2 }}>
                {error}
              </Alert>
            )}

            {preview && (
              <>
                <Alert severity="success" sx={{ my: 2 }}>
                  Preview generated successfully. {preview.length} VMs will receive IP addresses.
                </Alert>

                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>VMID</TableCell>
                        <TableCell>VM Name</TableCell>
                        <TableCell>Assigned IP</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.map((assignment) => (
                        <TableRow key={assignment.vm_id}>
                          <TableCell>{assignment.vmid}</TableCell>
                          <TableCell>{assignment.vm_name}</TableCell>
                          <TableCell>
                            <Chip
                              label={assignment.assigned_ip}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Confirm Batch Assignment
            </Typography>

            <Alert severity="warning" sx={{ my: 2 }}>
              You are about to assign IP addresses to {selectedVMs.length} VMs. This action cannot be undone easily.
            </Alert>

            <Box sx={{ my: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>IP Range:</strong>{' '}
                {ipRanges.find((r) => r.id === selectedIPRange)?.subnet}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>VMs:</strong> {selectedVMs.length}
              </Typography>
              {useStartIP && startIP && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Starting IP:</strong> {startIP}
                </Typography>
              )}
            </Box>

            {loading && (
              <Box sx={{ my: 2 }}>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Assigning IP addresses...
                </Typography>
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ my: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  const getResultsContent = () => {
    if (!result) return null;

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Batch Assignment Results
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, my: 3 }}>
          <Chip
            label={`Total: ${result.total}`}
            color="default"
          />
          <Chip
            icon={<CheckCircleIcon />}
            label={`Successful: ${result.successful}`}
            color="success"
          />
          <Chip
            icon={<ErrorIcon />}
            label={`Failed: ${result.failed}`}
            color="error"
          />
          <Chip
            icon={<SkipNextIcon />}
            label={`Skipped: ${result.skipped}`}
            color="warning"
          />
        </Box>

        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>VM Name</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {result.details.map((detail, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {detail.status === 'success' && <CheckCircleIcon color="success" />}
                    {detail.status === 'failed' && <ErrorIcon color="error" />}
                    {detail.status === 'skipped' && <SkipNextIcon color="warning" />}
                  </TableCell>
                  <TableCell>{detail.vm_name}</TableCell>
                  <TableCell>
                    {detail.ip_address && (
                      <Chip label={detail.ip_address} size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{detail.message}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return selectedVMs.length > 0;
      case 1:
        return selectedIPRange !== '';
      case 2:
        return preview !== null;
      case 3:
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Batch IP Assignment</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {activeStep < steps.length && (
            <>
              <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {getStepContent(activeStep)}
            </>
          )}

          {activeStep === steps.length && getResultsContent()}
        </Box>
      </DialogContent>
      <DialogActions>
        {activeStep < steps.length && (
          <>
            <Button onClick={onClose}>Cancel</Button>
            {activeStep > 0 && (
              <Button onClick={handleBack} disabled={loading}>
                Back
              </Button>
            )}
            {activeStep < steps.length - 1 && (
              <Button
                onClick={handleNext}
                variant="contained"
                disabled={!canProceed() || loading}
              >
                Next
              </Button>
            )}
            {activeStep === steps.length - 1 && (
              <Button
                onClick={handleConfirm}
                variant="contained"
                color="primary"
                disabled={loading}
              >
                Confirm Assignment
              </Button>
            )}
          </>
        )}
        {activeStep === steps.length && (
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BatchIPAssignmentDialog;
