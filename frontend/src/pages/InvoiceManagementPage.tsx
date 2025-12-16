import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Pagination,
  Tooltip,
} from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Visibility as VisibilityIcon,
  Send as SendIcon,
  PictureAsPdf as PdfIcon,
  CheckCircle as PaidIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import api from '../services/api';

interface Company {
  id: number;
  name: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  company_id: number;
  billing_period_start: string;
  billing_period_end: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  due_date: string;
  issued_at: string;
  paid_at: string | null;
  payment_reference: string | null;
  sent_to_email: string | null;
  sent_at: string | null;
  pdf_generated: boolean;
  companies: {
    id: number;
    name: string;
  };
}

interface InvoiceDetail extends Invoice {
  invoice_line_items: Array<{
    id: number;
    line_type: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    tax_rate: number;
    tax_amount: number;
    vm_id: number | null;
    virtual_machines: {
      id: number;
      name: string;
      vmid: number;
      node: string;
    } | null;
  }>;
}

interface InvoiceStatistics {
  total_invoices: number;
  paid_invoices: number;
  overdue_invoices: number;
  total_revenue: number;
  outstanding_balance: number;
  payment_rate: number;
}

const InvoiceManagementPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statistics, setStatistics] = useState<InvoiceStatistics | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);

  // Dialogs
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Form data
  const [sendEmail, setSendEmail] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');


  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadInvoices();
      loadStatistics();
    }
  }, [selectedCompany, statusFilter, page]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setCurrentUser(user);

      if (user.role === 'super_admin') {
        const companiesResponse = await api.get('/companies');
        setCompanies(companiesResponse.data.data || []);
      } else {
        setSelectedCompany(user.company_id);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    if (!selectedCompany) return;

    try {
      setLoading(true);
      setError('');

      const response = await api.get(
        `/invoices/companies/${selectedCompany}/invoices?status=${statusFilter}&page=${page}&limit=20`
      );

      setInvoices(response.data.data.invoices || []);
      setTotalPages(response.data.data.pagination.totalPages || 1);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    if (!selectedCompany) return;

    try {
      const response = await api.get(`/invoices/companies/${selectedCompany}/invoices/statistics`);
      setStatistics(response.data.data);
    } catch (error: any) {
      console.error('Failed to load statistics:', error);
    }
  };

  const loadInvoiceDetail = async (invoiceId: number) => {
    try {
      setLoading(true);
      const response = await api.get(`/invoices/invoices/${invoiceId}`);
      setSelectedInvoice(response.data.data);
      setDetailDialogOpen(true);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to load invoice detail');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!selectedInvoice || !sendEmail) return;

    try {
      setLoading(true);
      await api.post(`/invoices/invoices/${selectedInvoice.id}/send`, { email: sendEmail });
      setSendDialogOpen(false);
      setSendEmail('');
      loadInvoices();
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to send invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedInvoice) return;

    try {
      setLoading(true);
      await api.patch(`/invoices/invoices/${selectedInvoice.id}/status`, {
        status: 'paid',
        payment_reference: paymentReference || undefined,
        paid_at: new Date().toISOString(),
      });
      setPaymentDialogOpen(false);
      setPaymentReference('');
      loadInvoices();
      loadStatistics();
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to mark invoice as paid');
    } finally {
      setLoading(false);
    }
  };


  const handleGenerateInvoice = async () => {
    if (!selectedCompany) {
      setError('Please select a company first');
      return;
    }

    try {
      setGenerateLoading(true);
      setError('');

      const response = await api.post('/billing/generate-invoice', {
        company_id: selectedCompany,
        billing_month: selectedMonth || undefined
      });

      setError('');
      alert(`Invoice generated successfully! Invoice #${response.data.data.invoice_number}`);
      setCreateDialogOpen(false);
      setSelectedMonth('');
      loadInvoices();
      loadStatistics();
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleGeneratePDF = async (invoiceId: number) => {
    try {
      setLoading(true);
      await api.post(`/invoices/invoices/${invoiceId}/generate-pdf`);
      loadInvoices();
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = async (invoiceId: number) => {
    if (!confirm('Are you sure you want to delete this draft invoice?')) return;

    try {
      setLoading(true);
      await api.delete(`/invoices/invoices/${invoiceId}`);
      loadInvoices();
      loadStatistics();
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to delete invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvoice = async (invoiceId: number) => {
    if (!confirm('Are you sure you want to cancel this invoice?')) return;

    try {
      setLoading(true);
      await api.patch(`/invoices/invoices/${invoiceId}/status`, {
        status: 'cancelled',
      });
      loadInvoices();
      loadStatistics();
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to cancel invoice');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'sent':
        return 'info';
      case 'overdue':
        return 'error';
      case 'draft':
        return 'default';
      case 'cancelled':
      case 'refunded':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Invoice Management
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Manage PAYG invoices and billing
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {currentUser?.role === 'super_admin' && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setCreateDialogOpen(true)}
                disabled={!selectedCompany || loading}
              >
                Generate Invoice
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                loadInvoices();
                loadStatistics();
              }}
              disabled={!selectedCompany || loading}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Company and Filter Selection */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {currentUser?.role === 'super_admin' && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Select Company</InputLabel>
                <Select
                  value={selectedCompany}
                  label="Select Company"
                  onChange={(e) => {
                    setSelectedCompany(e.target.value as number);
                    setPage(1);
                  }}
                >
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item xs={12} md={currentUser?.role === 'super_admin' ? 6 : 12}>
            <FormControl fullWidth>
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                label="Status Filter"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="sent">Sent</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Statistics Cards */}
        {statistics && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Invoices
                  </Typography>
                  <Typography variant="h4">{statistics.total_invoices}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Paid Invoices
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {statistics.paid_invoices}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {statistics.payment_rate.toFixed(1)}% payment rate
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Revenue
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {formatCurrency(statistics.total_revenue)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Outstanding Balance
                  </Typography>
                  <Typography variant="h4" color={statistics.overdue_invoices > 0 ? 'error.main' : 'warning.main'}>
                    {formatCurrency(statistics.outstanding_balance)}
                  </Typography>
                  {statistics.overdue_invoices > 0 && (
                    <Typography variant="body2" color="error">
                      {statistics.overdue_invoices} overdue
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {loading && !invoices.length && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && !selectedCompany && (
          <Alert severity="info">Please select a company to view invoices</Alert>
        )}

        {/* Invoices Table */}
        {selectedCompany && (
          <Card>
            <CardContent>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice #</TableCell>
                      <TableCell>Period</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ReceiptIcon sx={{ mr: 1, color: 'action.active' }} />
                            {invoice.invoice_number}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {formatDate(invoice.billing_period_start)} - {formatDate(invoice.billing_period_end)}
                        </TableCell>
                        <TableCell>{formatDate(invoice.due_date)}</TableCell>
                        <TableCell align="right">
                          <Typography variant="body1" fontWeight="bold">
                            {formatCurrency(invoice.total_amount, invoice.currency)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={invoice.status.toUpperCase()}
                            color={getStatusColor(invoice.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => loadInvoiceDetail(invoice.id)}>
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          {invoice.status === 'draft' && (
                            <>
                              <Tooltip title="Send Invoice">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setSelectedInvoice(invoice as any);
                                    setSendDialogOpen(true);
                                  }}
                                >
                                  <SendIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete Draft">
                                <IconButton size="small" onClick={() => handleDeleteDraft(invoice.id)}>
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {invoice.status === 'sent' && (
                            <Tooltip title="Mark as Paid">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setSelectedInvoice(invoice as any);
                                  setPaymentDialogOpen(true);
                                }}
                              >
                                <PaidIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                            <Tooltip title="Cancel Invoice">
                              <IconButton size="small" onClick={() => handleCancelInvoice(invoice.id)}>
                                <CancelIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Generate PDF">
                            <IconButton size="small" onClick={() => handleGeneratePDF(invoice.id)}>
                              <PdfIcon />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination count={totalPages} page={page} onChange={(_e, value) => setPage(value)} />
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invoice Detail Dialog */}
        <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Invoice Details: {selectedInvoice?.invoice_number}</DialogTitle>
          <DialogContent>
            {selectedInvoice && (
              <Box>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Company
                    </Typography>
                    <Typography variant="body1">{selectedInvoice.companies.name}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Status
                    </Typography>
                    <Chip
                      label={selectedInvoice.status.toUpperCase()}
                      color={getStatusColor(selectedInvoice.status) as any}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Billing Period
                    </Typography>
                    <Typography variant="body1">
                      {formatDate(selectedInvoice.billing_period_start)} -{' '}
                      {formatDate(selectedInvoice.billing_period_end)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Due Date
                    </Typography>
                    <Typography variant="body1">{formatDate(selectedInvoice.due_date)}</Typography>
                  </Grid>
                </Grid>

                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Line Items
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedInvoice.invoice_line_items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.description}
                            {item.virtual_machines && (
                              <Typography variant="caption" display="block" color="textSecondary">
                                VM: {item.virtual_machines.name} ({item.virtual_machines.vmid})
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">{item.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} align="right">
                          <strong>Subtotal:</strong>
                        </TableCell>
                        <TableCell align="right">{formatCurrency(selectedInvoice.subtotal)}</TableCell>
                      </TableRow>
                      {selectedInvoice.tax_amount > 0 && (
                        <TableRow>
                          <TableCell colSpan={3} align="right">
                            <strong>Tax:</strong>
                          </TableCell>
                          <TableCell align="right">{formatCurrency(selectedInvoice.tax_amount)}</TableCell>
                        </TableRow>
                      )}
                      {selectedInvoice.discount_amount > 0 && (
                        <TableRow>
                          <TableCell colSpan={3} align="right">
                            <strong>Discount:</strong>
                          </TableCell>
                          <TableCell align="right">-{formatCurrency(selectedInvoice.discount_amount)}</TableCell>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell colSpan={3} align="right">
                          <Typography variant="h6">Total:</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="h6" color="primary">
                            {formatCurrency(selectedInvoice.total_amount)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Send Invoice Dialog */}
        <Dialog open={sendDialogOpen} onClose={() => setSendDialogOpen(false)}>
          <DialogTitle>Send Invoice</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendInvoice} variant="contained" disabled={!sendEmail}>
              Send
            </Button>
          </DialogActions>
        </Dialog>

        {/* Mark as Paid Dialog */}
        <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)}>
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Payment Reference (Optional)"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              sx={{ mt: 2 }}
              helperText="e.g., Check number, wire transfer ID, etc."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMarkAsPaid} variant="contained" color="success">
              Mark as Paid
            </Button>
          </DialogActions>
        </Dialog>

        {/* Generate Invoice Dialog */}
        <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Generate Invoice Manually</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Generate an invoice for the selected company. Leave the billing month empty to generate an invoice for the current month.
              </Typography>

              {selectedCompany && companies.find(c => c.id === selectedCompany) && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Generating invoice for: <strong>{companies.find(c => c.id === selectedCompany)?.name}</strong>
                </Alert>
              )}

              <TextField
                fullWidth
                label="Billing Month (Optional)"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                helperText="Leave empty for current month, or select a specific month"
                sx={{ mt: 2 }}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)} disabled={generateLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerateInvoice}
              variant="contained"
              color="primary"
              disabled={generateLoading || !selectedCompany}
            >
              {generateLoading ? <CircularProgress size={24} /> : 'Generate Invoice'}
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </Container>
  );
};

export default InvoiceManagementPage;
