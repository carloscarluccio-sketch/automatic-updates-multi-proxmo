import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  Divider,
  List,
  ListItem,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Fab
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Computer as ComputerIcon,
  Support as SupportIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Send as SendIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Ticket {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  category: string;
  opened_at: string;
  created_by_name: string;
  message_count: number;
}

interface TicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  message: string;
  created_at: string;
  user_name: string;
  is_staff: boolean;
}

export const MobileSupportPage: React.FC = () => {
  const navigate = useNavigate();
  const [navValue, setNavValue] = useState(2);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [_currentUser, setCurrentUser] = useState<any>(null);

  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category: 'general'
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/support-tickets');
      setTickets(response.data.data || []);
    } catch (error) {
      console.error('Load tickets error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTicketMessages = async (ticketId: number) => {
    try {
      const response = await api.get(`/support-tickets/${ticketId}`);
      setMessages(response.data.data?.support_ticket_messages || []);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const handleCreateTicket = async () => {
    try {
      await api.post('/support-tickets', newTicket);
      setCreateDialogOpen(false);
      setNewTicket({
        subject: '',
        description: '',
        priority: 'medium',
        category: 'general'
      });
      loadTickets();
    } catch (error) {
      console.error('Create ticket error:', error);
    }
  };

  const handleViewTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    await loadTicketMessages(ticket.id);
    setViewDialogOpen(true);
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    try {
      await api.post(`/support-tickets/${selectedTicket.id}/messages`, {
        message: replyMessage
      });
      setReplyMessage('');
      await loadTicketMessages(selectedTicket.id);
    } catch (error) {
      console.error('Send reply error:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'info';
      case 'in_progress': return 'warning';
      case 'resolved': return 'success';
      case 'closed': return 'default';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 7 }}>
      {/* Header */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          mb: 2,
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          color: 'white'
        }}
      >
        <Typography variant="h5" fontWeight="bold">
          Support Tickets
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
        </Typography>
      </Paper>

      <Container maxWidth="sm" sx={{ pb: 2 }}>
        {/* Tickets List */}
        {tickets.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary" align="center">
                No support tickets yet
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                Tap the + button to create one
              </Typography>
            </CardContent>
          </Card>
        ) : (
          tickets.map((ticket) => (
            <Card
              key={ticket.id}
              sx={{ mb: 2, cursor: 'pointer' }}
              onClick={() => handleViewTicket(ticket)}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {ticket.subject}
                  </Typography>
                  <Chip
                    label={ticket.priority.toUpperCase()}
                    size="small"
                    color={getPriorityColor(ticket.priority) as any}
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} noWrap>
                  {ticket.description}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={ticket.status.replace('_', ' ').toUpperCase()}
                    size="small"
                    color={getStatusColor(ticket.status) as any}
                    variant="outlined"
                  />
                  <Chip
                    label={`#${ticket.ticket_number}`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`${ticket.message_count || 0} replies`}
                    size="small"
                    variant="outlined"
                  />
                </Box>

                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Opened: {new Date(ticket.opened_at).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          ))
        )}
      </Container>

      {/* Create Ticket FAB */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 70, right: 16 }}
        onClick={() => setCreateDialogOpen(true)}
      >
        <AddIcon />
      </Fab>

      {/* Create Ticket Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        fullScreen
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={() => setCreateDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
            <Typography variant="h6">New Support Ticket</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Subject"
              fullWidth
              value={newTicket.subject}
              onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              required
            />

            <TextField
              label="Description"
              fullWidth
              multiline
              rows={4}
              value={newTicket.description}
              onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
              required
            />

            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={newTicket.priority}
                label="Priority"
                onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="urgent">Urgent</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={newTicket.category}
                label="Category"
                onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
              >
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="technical">Technical</MenuItem>
                <MenuItem value="billing">Billing</MenuItem>
                <MenuItem value="vm_issue">VM Issue</MenuItem>
                <MenuItem value="network">Network</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateTicket}
            disabled={!newTicket.subject || !newTicket.description}
          >
            Create Ticket
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Ticket Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        fullScreen
      >
        {selectedTicket && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <IconButton onClick={() => setViewDialogOpen(false)}>
                  <ArrowBackIcon />
                </IconButton>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6">{selectedTicket.subject}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Chip
                      label={selectedTicket.status.replace('_', ' ').toUpperCase()}
                      size="small"
                      color={getStatusColor(selectedTicket.status) as any}
                    />
                    <Chip
                      label={selectedTicket.priority.toUpperCase()}
                      size="small"
                      color={getPriorityColor(selectedTicket.priority) as any}
                    />
                  </Box>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ p: 0 }}>
              {/* Original Message */}
              <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Ticket #{selectedTicket.ticket_number}
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedTicket.description}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Opened by {selectedTicket.created_by_name} on{' '}
                  {new Date(selectedTicket.opened_at).toLocaleString()}
                </Typography>
              </Box>

              <Divider />

              {/* Messages */}
              <List sx={{ p: 0 }}>
                {messages.map((message, index) => (
                  <React.Fragment key={message.id}>
                    <ListItem
                      sx={{
                        alignItems: 'flex-start',
                        bgcolor: message.is_staff ? '#e3f2fd' : 'transparent',
                        flexDirection: 'column'
                      }}
                    >
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {message.user_name}
                            {message.is_staff && (
                              <Chip
                                label="STAFF"
                                size="small"
                                color="primary"
                                sx={{ ml: 1, height: 18, fontSize: '0.7rem' }}
                              />
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(message.created_at).toLocaleString()}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {message.message}
                        </Typography>
                      </Box>
                    </ListItem>
                    {index < messages.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>

              {messages.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">No replies yet</Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 2, display: 'block' }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Type your reply..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                />
                <IconButton
                  color="primary"
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim()}
                  sx={{ alignSelf: 'flex-end' }}
                >
                  <SendIcon />
                </IconButton>
              </Box>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Bottom Navigation */}
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
        <BottomNavigation
          value={navValue}
          onChange={(_event, newValue) => {
            setNavValue(newValue);
            switch(newValue) {
              case 0:
                navigate('/mobile');
                break;
              case 1:
                navigate('/mobile/vms');
                break;
              case 2:
                navigate('/mobile/support');
                break;
              case 3:
                navigate('/mobile/profile');
                break;
            }
          }}
        >
          <BottomNavigationAction label="Dashboard" icon={<DashboardIcon />} />
          <BottomNavigationAction label="VMs" icon={<ComputerIcon />} />
          <BottomNavigationAction label="Support" icon={<SupportIcon />} />
          <BottomNavigationAction label="Profile" icon={<PersonIcon />} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
};

export default MobileSupportPage;
