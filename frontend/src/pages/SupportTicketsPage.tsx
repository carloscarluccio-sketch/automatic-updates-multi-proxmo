import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Send as SendIcon
} from '@mui/icons-material';
import api from '../services/api';

interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  opened_at: string;
  closed_at: string | null;
  companies: { name: string };
  users_support_tickets_created_byTousers: {
    username: string;
    email: string;
  };
  users_support_tickets_assigned_toTousers?: {
    username: string;
  };
  _count: {
    support_ticket_messages: number;
  };
}

interface TicketMessage {
  id: number;
  message: string;
  is_internal: boolean;
  created_at: string;
  users: {
    username: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
  };
}

const SupportTicketsPage: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
const [currentUser, setCurrentUser] = useState<any>(null);  const [companies, setCompanies] = useState<any[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    company_id: '',
    subject: '',
    description: '',
    priority: 'medium',
    category: ''
  });

  useEffect(() => {
    loadCurrentUser();
    loadTickets();
  }, [filterStatus, filterPriority]);
  const loadCurrentUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setCurrentUser(response.data);
      if (response.data.role === 'super_admin') loadCompanies();
    } catch (err: any) { console.error(err); }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data.data || []);
    } catch (err: any) { console.error(err); }
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);

      const response = await api.get(`/support-tickets?${params.toString()}`);
      setTickets(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    try {
      setLoading(true);
      await api.post('/support-tickets', formData);
      setSuccess('Ticket created successfully');
      setCreateDialogOpen(false);
      setFormData({ company_id: '', subject: '', description: '', priority: 'medium', category: '' });
      loadTickets();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTicket = async (ticketId: number) => {
    try {
      setLoading(true);
      const response = await api.get(`/support-tickets/${ticketId}`);
      setSelectedTicket(response.data.data);
      setMessages(response.data.data.support_ticket_messages || []);
      setViewDialogOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      setLoading(true);
      await api.post(`/support-tickets/${selectedTicket.id}/messages`, {
        message: newMessage
      });
      // Reload ticket to get updated status and messages
      const ticketResponse = await api.get(`/support-tickets/${selectedTicket.id}`);
      setSelectedTicket(ticketResponse.data.data);
      setMessages(ticketResponse.data.data.support_ticket_messages || []);
      setNewMessage('');
      loadTickets(); // Refresh the list
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicket) return;
    try {
      setLoading(true);
      await api.patch(`/support-tickets/${selectedTicket.id}`, { status: newStatus });
      setSuccess('Status updated successfully');
      // Reload ticket details
      const response = await api.get(`/support-tickets/${selectedTicket.id}`);
      setSelectedTicket(response.data.data);
      setMessages(response.data.data.support_ticket_messages || []);
      loadTickets(); // Refresh the list
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      open: 'error',
      in_progress: 'warning',
      waiting_customer: 'info',
      waiting_support: 'info',
      resolved: 'success',
      closed: 'default'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority: string) => {
    const colors: any = {
      urgent: 'error',
      high: 'warning',
      medium: 'info',
      low: 'success'
    };
    return colors[priority] || 'default';
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Support Tickets</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            New Ticket
          </Button>
        </Box>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>{success}</Alert>}

        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Filter by Status</InputLabel>
                <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Filter by Status">
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Filter by Priority</InputLabel>
                <Select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} label="Filter by Priority">
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Ticket #</TableCell>
                {currentUser?.role === 'super_admin' && <TableCell>Company</TableCell>}
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Messages</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={currentUser?.role === 'super_admin' ? 8 : 7} align="center"><CircularProgress /></TableCell>
                </TableRow>
              ) : tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={currentUser?.role === 'super_admin' ? 8 : 7} align="center">No tickets found</TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => (
                  <TableRow key={ticket.id} hover>
                    <TableCell>{ticket.ticket_number}</TableCell>
                    {currentUser?.role === 'super_admin' && <TableCell>{ticket.companies.name}</TableCell>}
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell>
                      <Chip label={ticket.status.replace('_', ' ')} color={getStatusColor(ticket.status)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={ticket.priority} color={getPriorityColor(ticket.priority)} size="small" />
                    </TableCell>
                    <TableCell>{ticket._count.support_ticket_messages}</TableCell>
                    <TableCell>{new Date(ticket.opened_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleViewTicket(ticket.id)}>
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Create Ticket Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Support Ticket</DialogTitle>
        <DialogContent>
{currentUser?.role === 'super_admin' && (              <FormControl fullWidth required sx={{ mb: 2 }}>                <InputLabel>Company</InputLabel>                <Select                  value={formData.company_id}                  onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}                  label="Company"                >                  {companies.map((company: any) => (                    <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>                  ))}                </Select>              </FormControl>            )}
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={6}
              sx={{ mb: 2 }}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    label="Priority"
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Category (optional)"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateTicket} variant="contained" disabled={!formData.subject || !formData.description}>
            Create Ticket
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Ticket Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        {selectedTicket && (
          <>
            <DialogTitle>
              {selectedTicket.ticket_number} - {selectedTicket.subject}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption">Status</Typography>
                    <Box><Chip label={selectedTicket.status} color={getStatusColor(selectedTicket.status)} size="small" /></Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption">Priority</Typography>
                    <Box><Chip label={selectedTicket.priority} color={getPriorityColor(selectedTicket.priority)} size="small" /></Box>
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>Description</Typography>
              <Typography variant="body2" sx={{ mb: 3, whiteSpace: 'pre-wrap' }}>
                {selectedTicket.description}
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Change Status</Typography>
                <FormControl fullWidth size="small" sx={{ maxWidth: 300 }}>
                  <Select
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    displayEmpty
                  >
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="waiting_customer">Waiting for Customer</MenuItem>
                    <MenuItem value="waiting_support">Waiting for Support</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>Messages</Typography>
              <Box sx={{ maxHeight: 400, overflow: 'auto', mb: 2 }}>
                {messages.map((msg) => (
                  <Card key={msg.id} sx={{ mb: 1 }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        {msg.users.first_name || msg.users.username} - {new Date(msg.created_at).toLocaleString()}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                        {msg.message}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <IconButton color="primary" onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <SendIcon />
                </IconButton>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default SupportTicketsPage;
