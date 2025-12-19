import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  SelectChangeEvent,
  Button,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WarningIcon from '@mui/icons-material/Warning';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../services/api';

interface ActivityLog {
  id: number;
  user_id: number | null;
  company_id: number | null;
  activity_type: string;
  entity_type: string;
  entity_id: number | null;
  action: string;
  description: string;
  status: 'success' | 'failed' | 'in_progress' | 'warning';
  metadata: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  users?: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
  };
  companies?: {
    id: number;
    name: string;
  };
}

interface ActivityStats {
  total: number;
  by_type: Array<{ activity_type: string; count: number }>;
  by_status: Array<{ status: string; count: number }>;
  recent_failures: number;
}

export const ActivityLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Filters
  const [activityType, setActivityType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [timeRange, setTimeRange] = useState('24h');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);

  // Prevent duplicate requests
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      const params: any = {
        limit: rowsPerPage,
        offset: page * rowsPerPage
      };

      if (activityType) params.activityType = activityType;
      if (status) params.status = status;

      const response = await api.get('/logs/activity', {
        params,
        signal: abortControllerRef.current?.signal
      });
      setLogs(response.data.data || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error('Failed to load logs:', error);
      }
    }
  }, [activityType, status, page, rowsPerPage]);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.get('/logs/activity/stats', {
        params: { timeRange },
        signal: abortControllerRef.current?.signal
      });
      setStats(response.data.data);
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error('Failed to load stats:', error);
      }
    }
  }, [timeRange]);

  const loadData = useCallback(async () => {
    // Prevent duplicate requests
    if (loadingRef.current) {
      return;
    }

    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    try {
      loadingRef.current = true;
      abortControllerRef.current = new AbortController();
      setLoading(true);
      setError('');

      await Promise.all([
        loadLogs(),
        loadStats()
      ]);
    } catch (err: any) {
      if (err.name !== 'CanceledError') {
        setError(err.response?.data?.message || 'Failed to load activity logs');
      }
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [loadLogs, loadStats]);

  useEffect(() => {
    loadData();

    // Cleanup: abort pending requests when component unmounts or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadData]);

  const handleActivityTypeChange = (event: SelectChangeEvent) => {
    setActivityType(event.target.value);
    setPage(0);
  };

  const handleStatusChange = (event: SelectChangeEvent) => {
    setStatus(event.target.value);
    setPage(0);
  };

  const handleTimeRangeChange = (event: SelectChangeEvent) => {
    setTimeRange(event.target.value);
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (activityType) params.append("activity_type", activityType);
      if (status) params.append("status", status);

      const response = await api.get(`/logs/export/csv?${params.toString()}`, {
        responseType: "blob"
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date().toISOString().split("T")[0];
      link.setAttribute("download", `activity_logs_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      setError("Failed to export CSV");
    }
  };

  const handleExportJSON = async () => {
    try {
      const params = new URLSearchParams();
      if (activityType) params.append("activity_type", activityType);
      if (status) params.append("status", status);

      const response = await api.get(`/logs/export/json?${params.toString()}`, {
        responseType: "blob"
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      const timestamp = new Date().toISOString().split("T")[0];
      link.setAttribute("download", `activity_logs_${timestamp}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      setError("Failed to export JSON");
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'in_progress':
        return <HourglassEmptyIcon color="info" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'error';
      case 'in_progress':
        return 'info';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatUserName = (user: any) => {
    if (!user) return 'System';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const name = `${firstName} ${lastName}`.trim();
    return name || user.email;
  };

  if (loading && !stats) {
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
          <Box>
            <Typography variant="h4" gutterBottom>
              Activity Logs
            </Typography>
            <Typography variant="body1" color="textSecondary">
              System activity and audit trail
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleExportCSV}
            >
              CSV
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleExportJSON}
            >
              JSON
            </Button>
          </Box>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Time Range</InputLabel>
            <Select value={timeRange} label="Time Range" onChange={handleTimeRangeChange}>
              <MenuItem value="1h">Last Hour</MenuItem>
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Statistics Cards */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AssessmentIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="subtitle2" color="textSecondary">
                      Total Activities
                    </Typography>
                  </Box>
                  <Typography variant="h3">{stats.total}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    In selected time range
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="subtitle2" color="textSecondary">
                      Successful
                    </Typography>
                  </Box>
                  <Typography variant="h3">
                    {stats.by_status.find(s => s.status === 'success')?.count || 0}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Completed successfully
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ErrorIcon color="error" sx={{ mr: 1 }} />
                    <Typography variant="subtitle2" color="textSecondary">
                      Failed
                    </Typography>
                  </Box>
                  <Typography variant="h3">
                    {stats.by_status.find(s => s.status === 'failed')?.count || 0}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Failed activities
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <WarningIcon color="warning" sx={{ mr: 1 }} />
                    <Typography variant="subtitle2" color="textSecondary">
                      Warnings
                    </Typography>
                  </Box>
                  <Typography variant="h3">
                    {stats.by_status.find(s => s.status === 'warning')?.count || 0}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Recent warnings
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Activity Type</InputLabel>
            <Select value={activityType} label="Activity Type" onChange={handleActivityTypeChange}>
              <MenuItem value="">
                <em>All Types</em>
              </MenuItem>
              <MenuItem value="authentication">Authentication</MenuItem>
              <MenuItem value="vm_management">VM Management</MenuItem>
              <MenuItem value="user_management">User Management</MenuItem>
              <MenuItem value="company_management">Company Management</MenuItem>
              <MenuItem value="system">System</MenuItem>
              <MenuItem value="api">API</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={handleStatusChange}>
              <MenuItem value="">
                <em>All Statuses</em>
              </MenuItem>
              <MenuItem value="success">Success</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Activity Logs Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Activity Type</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>IP Address</TableCell>
                <TableCell>Timestamp</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No activity logs found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getStatusIcon(log.status)}
                        <Chip
                          label={log.status}
                          color={getStatusColor(log.status) as any}
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={log.activity_type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{formatUserName(log.users)}</TableCell>
                    <TableCell>{log.companies?.name || '-'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {log.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{log.ip_address || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(log.created_at).toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Box>
    </Container>
  );
};
