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
  IconButton,
  Tooltip,
  Chip,
  Switch,
  FormControlLabel,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PreviewIcon from '@mui/icons-material/Preview';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { DataTable } from '../components/common/DataTable';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface EmailTemplate {
  id: number;
  company_id: number | null;
  url_mapping_id: number | null;
  template_type: string;
  template_slug: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  available_variables: string[] | null;
  is_active: boolean;
  is_default: boolean;
  parent_template_id: number | null;
  created_at: string;
  updated_at: string;
}

interface Company {
  id: number;
  name: string;
}

interface URLMapping {
  id: number;
  domain: string;
  company_id: number;
}

const TEMPLATE_TYPES = [
  { value: 'verification', label: 'Email Verification' },
  { value: 'welcome', label: 'Welcome Email' },
  { value: 'password_reset', label: 'Password Reset' },
  { value: 'vm_created', label: 'VM Created' },
  { value: 'invoice', label: 'Invoice Notification' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'custom', label: 'Custom Template' },
];

export const EmailTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [urlMappings, setURLMappings] = useState<URLMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDialog, setOpenDialog] = useState(false);
  const [openPreview, setOpenPreview] = useState(false);
  const [previewData, setPreviewData] = useState({ subject: '', html: '', text: '' });
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    company_id: null as number | null,
    url_mapping_id: null as number | null,
    template_type: 'verification',
    template_slug: '',
    subject: '',
    html_body: '',
    text_body: '',
    is_active: true,
  });
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load templates
      const templatesResponse = await api.get('/companies/email-templates');
      setTemplates(templatesResponse.data.data || []);

      // Load companies (super_admin only)
      if (currentUser?.role === 'super_admin') {
        const companiesResponse = await api.get('/companies');
        setCompanies(companiesResponse.data.data || []);
      }

      // Load URL mappings
      const mappingsResponse = await api.get('/companies/url-mappings');
      setURLMappings(mappingsResponse.data.data || []);

    } catch (error: any) {
      console.error('Error loading data:', error);
      showSnackbar(error.response?.data?.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableVariables = async (templateType: string) => {
    try {
      const response = await api.get(`/companies/email-templates/variables/${templateType}`);
      setAvailableVariables(response.data.data || []);
    } catch (error) {
      console.error('Error loading variables:', error);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleOpenDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        company_id: template.company_id,
        url_mapping_id: template.url_mapping_id,
        template_type: template.template_type,
        template_slug: template.template_slug,
        subject: template.subject,
        html_body: template.html_body,
        text_body: template.text_body || '',
        is_active: template.is_active,
      });
      loadAvailableVariables(template.template_type);
    } else {
      setEditingTemplate(null);
      setFormData({
        company_id: currentUser?.role === 'super_admin' ? null : currentUser?.company_id || null,
        url_mapping_id: null,
        template_type: 'verification',
        template_slug: '',
        subject: '',
        html_body: '',
        text_body: '',
        is_active: true,
      });
      loadAvailableVariables('verification');
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTemplate(null);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === 'template_type') {
      loadAvailableVariables(value);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      if (!formData.template_slug || !formData.subject || !formData.html_body) {
        showSnackbar('Please fill in all required fields', 'error');
        return;
      }

      if (editingTemplate) {
        await api.put(`/companies/email-templates/${editingTemplate.id}`, formData);
        showSnackbar('Template updated successfully', 'success');
      } else {
        await api.post('/companies/email-templates', formData);
        showSnackbar('Template created successfully', 'success');
      }

      handleCloseDialog();
      loadData();
    } catch (error: any) {
      console.error('Error saving template:', error);
      showSnackbar(error.response?.data?.message || 'Failed to save template', 'error');
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/companies/email-templates/${id}`);
      showSnackbar('Template deleted successfully', 'success');
      loadData();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      showSnackbar(error.response?.data?.message || 'Failed to delete template', 'error');
    }
  };

  const handlePreviewTemplate = async (template: EmailTemplate) => {
    try {
      const response = await api.post(`/companies/email-templates/${template.id}/preview`, {
        sample_variables: {},
      });
      setPreviewData(response.data.data);
      setOpenPreview(true);
    } catch (error: any) {
      console.error('Error previewing template:', error);
      showSnackbar(error.response?.data?.message || 'Failed to preview template', 'error');
    }
  };

  const handleCopyVariable = (variable: string) => {
    navigator.clipboard.writeText(`{{${variable}}}`);
    showSnackbar(`Copied {{${variable}}} to clipboard`, 'success');
  };

  const getTemplateLevel = (template: EmailTemplate): string => {
    if (template.url_mapping_id) return 'URL Mapping';
    if (template.company_id) return 'Company';
    return 'Global';
  };

  const getTemplateLevelColor = (level: string) => {
    switch (level) {
      case 'URL Mapping': return 'primary';
      case 'Company': return 'secondary';
      case 'Global': return 'default';
      default: return 'default';
    }
  };

  const columns = [
    {
      id: 'template_slug',
      label: 'Template Slug',
      minWidth: 150,
      format: (_: any, row: any) => <strong>{row.template_slug}</strong>,
    },
    {
      id: 'template_type',
      label: 'Type',
      minWidth: 130,
      format: (_: any, row: any) => {
        const type = TEMPLATE_TYPES.find((t) => t.value === row.template_type);
        return type?.label || row.template_type;
      },
    },
    {
      id: 'level',
      label: 'Level',
      minWidth: 100,
      format: (_: any, row: any) => {
        const level = getTemplateLevel(row);
        return (
          <Chip
            label={level}
            color={getTemplateLevelColor(level) as any}
            size="small"
          />
        );
      },
    },
    {
      id: 'subject',
      label: 'Subject',
      minWidth: 200,
      format: (_: any, row: any) => row.subject,
    },
    {
      id: 'is_active',
      label: 'Status',
      minWidth: 100,
      format: (_: any, row: any) => (
        <Chip
          label={row.is_active ? 'Active' : 'Inactive'}
          color={row.is_active ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      minWidth: 150,
      format: (_: any, row: any) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Preview">
            <IconButton size="small" onClick={() => handlePreviewTemplate(row)}>
              <PreviewIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenDialog(row)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          {!row.is_default && (
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => handleDeleteTemplate(row.id)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Email Templates
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Create Template
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Template Hierarchy:</strong> URL Mapping templates override Company templates, which override Global templates.
        Use variables like <code>{'{{user_name}}'}</code>, conditionals like <code>{'{{#if condition}}...{{/if}}'}</code>,
        and filters like <code>{'{{value | uppercase}}'}</code> in your templates.
      </Alert>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            rows={templates}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Email Template' : 'Create Email Template'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {currentUser?.role === 'super_admin' && (
              <>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Company (Optional)</InputLabel>
                    <Select
                      value={formData.company_id || ''}
                      onChange={(e) => handleFormChange('company_id', e.target.value || null)}
                      label="Company (Optional)"
                    >
                      <MenuItem value="">Global (All Companies)</MenuItem>
                      {companies.map((company) => (
                        <MenuItem key={company.id} value={company.id}>
                          {company.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>URL Mapping (Optional)</InputLabel>
                    <Select
                      value={formData.url_mapping_id || ''}
                      onChange={(e) => handleFormChange('url_mapping_id', e.target.value || null)}
                      label="URL Mapping (Optional)"
                      disabled={!formData.company_id}
                    >
                      <MenuItem value="">Company-Wide</MenuItem>
                      {urlMappings
                        .filter((m) => m.company_id === formData.company_id)
                        .map((mapping) => (
                          <MenuItem key={mapping.id} value={mapping.id}>
                            {mapping.domain}
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Template Type</InputLabel>
                <Select
                  value={formData.template_type}
                  onChange={(e) => handleFormChange('template_type', e.target.value)}
                  label="Template Type"
                >
                  {TEMPLATE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Template Slug"
                value={formData.template_slug}
                onChange={(e) => handleFormChange('template_slug', e.target.value)}
                fullWidth
                required
                helperText="Unique identifier (e.g., email-verification)"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Subject"
                value={formData.subject}
                onChange={(e) => handleFormChange('subject', e.target.value)}
                fullWidth
                required
                helperText="Use variables like {{user_name}} or {{brand_name}}"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="HTML Body"
                value={formData.html_body}
                onChange={(e) => handleFormChange('html_body', e.target.value)}
                fullWidth
                required
                multiline
                rows={10}
                helperText="HTML content with variables and conditionals"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Plain Text Body (Optional)"
                value={formData.text_body}
                onChange={(e) => handleFormChange('text_body', e.target.value)}
                fullWidth
                multiline
                rows={5}
                helperText="Fallback for email clients that don't support HTML"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => handleFormChange('is_active', e.target.checked)}
                  />
                }
                label="Active"
              />
            </Grid>

            {availableVariables.length > 0 && (
              <Grid item xs={12}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Available Variables ({availableVariables.length})</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {availableVariables.map((variable) => (
                        <Chip
                          key={variable}
                          label={`{{${variable}}}`}
                          onClick={() => handleCopyVariable(variable)}
                          icon={<ContentCopyIcon fontSize="small" />}
                          variant="outlined"
                          size="small"
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveTemplate} variant="contained">
            {editingTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={openPreview} onClose={() => setOpenPreview(false)} maxWidth="md" fullWidth>
        <DialogTitle>Email Preview</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Subject:
            </Typography>
            <Typography variant="body1">{previewData.subject}</Typography>
          </Box>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              HTML Preview:
            </Typography>
            <Box
              sx={{
                border: '1px solid #ddd',
                borderRadius: 1,
                p: 2,
                bgcolor: '#f5f5f5',
                maxHeight: '400px',
                overflow: 'auto',
              }}
              dangerouslySetInnerHTML={{ __html: previewData.html }}
            />
          </Box>
          {previewData.text && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Plain Text Preview:
              </Typography>
              <Box
                sx={{
                  border: '1px solid #ddd',
                  borderRadius: 1,
                  p: 2,
                  bgcolor: '#f5f5f5',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {previewData.text}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPreview(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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
    </Container>
  );
};
export default EmailTemplatesPage;
