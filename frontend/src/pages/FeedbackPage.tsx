import React, { useEffect, useState } from 'react';
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  SelectChangeEvent,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ReplyIcon from '@mui/icons-material/Reply';
import FeedbackIcon from '@mui/icons-material/Feedback';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface FeedbackSubmission {
  id: number;
  company_id: number;
  user_id: number;
  type: 'feedback' | 'bug' | 'feature_request';
  category: string | null;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  assigned_to: number | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  users_feedback_submissions_user_idTousers?: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  companies?: {
    id: number;
    name: string;
  };
  feedback_replies?: FeedbackReply[];
  _count?: {
    feedback_replies: number;
  };
}

interface FeedbackReply {
  id: number;
  feedback_id: number;
  user_id: number;
  message: string;
  is_internal: boolean;
  created_at: string;
  users?: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
  };
}

interface FeedbackStats {
  total: number;
  by_status: Array<{ status: string; count: number }>;
  by_type: Array<{ type: string; count: number }>;
  by_priority: Array<{ priority: string; count: number }>;
}

export const FeedbackPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [feedback, setFeedback] = useState<FeedbackSubmission[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    type: 'feedback' as 'feedback' | 'bug' | 'feature_request',
    subject: '',
    description: '',
    category: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
  });
  const [replyMessage, setReplyMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter, priorityFilter, page, rowsPerPage]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      await Promise.all([
        loadFeedback(),
        loadStats()
      ]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const loadFeedback = async () => {
    try {
      const params: any = {
        limit: rowsPerPage,
        offset: page * rowsPerPage
      };

      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const response = await api.get('/feedback', { params });
      setFeedback(response.data.data || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to load feedback:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/feedback/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadFeedbackDetails = async (id: number) => {
    try {
      const response = await api.get(`/feedback/${id}`);
      setSelectedFeedback(response.data.data);
      setViewDialogOpen(true);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load feedback details');
    }
  };

  const handleCreateFeedback = async () => {
    try {
      await api.post('/feedback', formData);
      setSuccess('Feedback submitted successfully');
      setCreateDialogOpen(false);
      setFormData({
        type: 'feedback',
        subject: '',
        description: '',
        category: '',
        priority: 'medium',
      });
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create feedback');
    }
  };

  const handleAddReply = async () => {
    if (!selectedFeedback || !replyMessage.trim()) return;

    try {
      await api.post(`/feedback/${selectedFeedback.id}/reply`, {
        message: replyMessage,
        is_internal: isInternalNote
      });
      setSuccess('Reply added successfully');
      setReplyMessage('');
      setIsInternalNote(false);
      setReplyDialogOpen(false);
      loadFeedbackDetails(selectedFeedback.id);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to add reply');
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await api.put(`/feedback/${id}/status`, { status });
      setSuccess('Status updated successfully');
      loadData();
      if (selectedFeedback && selectedFeedback.id === id) {
        loadFeedbackDetails(id);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <BugReportIcon color="error" />;
      case 'feature_request':
        return <LightbulbIcon color="info" />;
      default:
        return <FeedbackIcon color="primary" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'info';
      case 'in_progress':
        return 'warning';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatUserName = (user: any) => {
    if (!user) return 'Unknown';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const name = `${firstName} ${lastName}`.trim();
    return name || user.email;
  };

  const isAdmin = user?.role === 'super_admin' || user?.role === 'company_admin';

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
              Feedback & Support
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Submit feedback, report bugs, and request features
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            Submit Feedback
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {/* Statistics Cards */}
        {stats && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Total Submissions
                  </Typography>
                  <Typography variant="h3">{stats.total}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    New
                  </Typography>
                  <Typography variant="h3" color="info.main">
                    {stats.by_status.find(s => s.status === 'new')?.count || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    In Progress
                  </Typography>
                  <Typography variant="h3" color="warning.main">
                    {stats.by_status.find(s => s.status === 'in_progress')?.count || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Resolved
                  </Typography>
                  <Typography variant="h3" color="success.main">
                    {stats.by_status.find(s => s.status === 'resolved')?.count || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              label="Type"
              onChange={(e: SelectChangeEvent) => {
                setTypeFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value=""><em>All Types</em></MenuItem>
              <MenuItem value="feedback">Feedback</MenuItem>
              <MenuItem value="bug">Bug Report</MenuItem>
              <MenuItem value="feature_request">Feature Request</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e: SelectChangeEvent) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value=""><em>All Statuses</em></MenuItem>
              <MenuItem value="new">New</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              value={priorityFilter}
              label="Priority"
              onChange={(e: SelectChangeEvent) => {
                setPriorityFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value=""><em>All Priorities</em></MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Feedback Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted By</TableCell>
                <TableCell>Replies</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {feedback.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No feedback submissions found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                feedback.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getTypeIcon(item.type)}
                        <Chip label={item.type.replace('_', ' ')} size="small" variant="outlined" />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.subject}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.priority}
                        color={getPriorityColor(item.priority) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.status.replace('_', ' ')}
                        color={getStatusColor(item.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {formatUserName(item.users_feedback_submissions_user_idTousers)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item._count?.feedback_replies || 0}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(item.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={() => loadFeedbackDetails(item.id)}
                      >
                        View
                      </Button>
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

      {/* Create Feedback Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Submit Feedback</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                label="Type"
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <MenuItem value="feedback">General Feedback</MenuItem>
                <MenuItem value="bug">Bug Report</MenuItem>
                <MenuItem value="feature_request">Feature Request</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                label="Priority"
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            />

            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={6}
              required
            />

            <TextField
              fullWidth
              label="Category (optional)"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateFeedback}
            disabled={!formData.subject || !formData.description}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Feedback Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        {selectedFeedback && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">{selectedFeedback.subject}</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    label={selectedFeedback.type.replace('_', ' ')}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={selectedFeedback.priority}
                    color={getPriorityColor(selectedFeedback.priority) as any}
                    size="small"
                  />
                  <Chip
                    label={selectedFeedback.status.replace('_', ' ')}
                    color={getStatusColor(selectedFeedback.status) as any}
                    size="small"
                  />
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Submitted by {formatUserName(selectedFeedback.users_feedback_submissions_user_idTousers)} on{' '}
                  {new Date(selectedFeedback.created_at).toLocaleString()}
                </Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>
                  {selectedFeedback.description}
                </Typography>
              </Box>

              {selectedFeedback.feedback_replies && selectedFeedback.feedback_replies.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Replies ({selectedFeedback.feedback_replies.length})
                  </Typography>
                  <List>
                    {selectedFeedback.feedback_replies.map((reply) => (
                      <ListItem key={reply.id} alignItems="flex-start">
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {formatUserName(reply.users)}
                              </Typography>
                              {reply.is_internal && (
                                <Chip label="Internal" size="small" color="warning" />
                              )}
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography variant="caption" color="textSecondary" display="block">
                                {new Date(reply.created_at).toLocaleString()}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                {reply.message}
                              </Typography>
                            </>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </DialogContent>
            <DialogActions>
              {isAdmin && selectedFeedback.status !== 'closed' && (
                <>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Update Status</InputLabel>
                    <Select
                      value={selectedFeedback.status}
                      label="Update Status"
                      onChange={(e) => handleUpdateStatus(selectedFeedback.id, e.target.value)}
                    >
                      <MenuItem value="new">New</MenuItem>
                      <MenuItem value="in_progress">In Progress</MenuItem>
                      <MenuItem value="resolved">Resolved</MenuItem>
                      <MenuItem value="closed">Closed</MenuItem>
                    </Select>
                  </FormControl>
                  <Button
                    startIcon={<ReplyIcon />}
                    onClick={() => setReplyDialogOpen(true)}
                  >
                    Add Reply
                  </Button>
                </>
              )}
              <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onClose={() => setReplyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Reply</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Reply Message"
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              multiline
              rows={4}
              required
            />
            {isAdmin && (
              <FormControl fullWidth>
                <InputLabel>Reply Type</InputLabel>
                <Select
                  value={isInternalNote ? 'internal' : 'public'}
                  label="Reply Type"
                  onChange={(e) => setIsInternalNote(e.target.value === 'internal')}
                >
                  <MenuItem value="public">Public Reply</MenuItem>
                  <MenuItem value="internal">Internal Note</MenuItem>
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplyDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddReply}
            disabled={!replyMessage.trim()}
          >
            Add Reply
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};
