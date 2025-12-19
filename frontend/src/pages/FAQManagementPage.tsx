import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import api from '../services/api';

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface FAQ {
  id: number;
  category_id: number;
  question: string;
  answer: string;
  is_published: boolean;
  display_order: number;
  page_context?: string;
  feature_tag?: string;
  view_count: number;
  helpful_count: number;
  help_categories?: {
    name: string;
    slug: string;
  };
}

export const FAQManagementPage: React.FC = () => {
  const [faqs, setFAQs] = useState<FAQ[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentFAQ, setCurrentFAQ] = useState<Partial<FAQ>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [faqsRes, catsRes] = await Promise.all([
        api.get('/help-admin/faqs'),
        api.get('/help/categories')
      ]);

      setFAQs(faqsRes.data.data || []);
      setCategories(catsRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (faq?: FAQ) => {
    if (faq) {
      setEditMode(true);
      setCurrentFAQ(faq);
    } else {
      setEditMode(false);
      setCurrentFAQ({
        category_id: categories[0]?.id || 0,
        question: '',
        answer: '',
        is_published: false,
        display_order: 0
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentFAQ({});
  };

  const handleSave = async () => {
    try {
      if (!currentFAQ.question || !currentFAQ.answer) {
        setError('Question and answer are required');
        return;
      }

      if (editMode && currentFAQ.id) {
        await api.put(`/help-admin/faqs/${currentFAQ.id}`, currentFAQ);
        setSuccess('FAQ updated successfully');
      } else {
        await api.post('/help-admin/faqs', currentFAQ);
        setSuccess('FAQ created successfully');
      }

      handleCloseDialog();
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save FAQ');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      await api.delete(`/help-admin/faqs/${id}`);
      setSuccess('FAQ deleted successfully');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete FAQ');
    }
  };

  const handleTogglePublish = async (faq: FAQ) => {
    try {
      if (faq.is_published) {
        await api.post(`/help-admin/faqs/${faq.id}/unpublish`);
        setSuccess('FAQ unpublished');
      } else {
        await api.post(`/help-admin/faqs/${faq.id}/publish`);
        setSuccess('FAQ published');
      }
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update FAQ');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">FAQ Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Create FAQ
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Question</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Stats</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center">Loading...</TableCell></TableRow>
            ) : faqs.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center">No FAQs found</TableCell></TableRow>
            ) : (
              faqs.map((faq) => (
                <TableRow key={faq.id}>
                  <TableCell>{faq.question}</TableCell>
                  <TableCell>{faq.help_categories?.name || 'Unknown'}</TableCell>
                  <TableCell>
                    <Chip
                      label={faq.is_published ? 'Published' : 'Draft'}
                      color={faq.is_published ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip label={`${faq.view_count} views`} size="small" variant="outlined" />
                      <Chip label={`${faq.helpful_count} helpful`} size="small" variant="outlined" />
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleTogglePublish(faq)} title={faq.is_published ? 'Unpublish' : 'Publish'}>
                      {faq.is_published ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                    <IconButton size="small" onClick={() => handleOpenDialog(faq)}><EditIcon /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(faq.id)} color="error"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editMode ? 'Edit FAQ' : 'Create FAQ'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={currentFAQ.category_id || ''}
                onChange={(e) => setCurrentFAQ({ ...currentFAQ, category_id: Number(e.target.value) })}
                label="Category"
              >
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Question"
              value={currentFAQ.question || ''}
              onChange={(e) => setCurrentFAQ({ ...currentFAQ, question: e.target.value })}
              fullWidth
              required
            />

            <TextField
              label="Answer"
              value={currentFAQ.answer || ''}
              onChange={(e) => setCurrentFAQ({ ...currentFAQ, answer: e.target.value })}
              multiline
              rows={6}
              fullWidth
              required
            />

            <TextField
              label="Display Order"
              type="number"
              value={currentFAQ.display_order || 0}
              onChange={(e) => setCurrentFAQ({ ...currentFAQ, display_order: Number(e.target.value) })}
              fullWidth
            />

            <TextField
              label="Page Context (optional)"
              value={currentFAQ.page_context || ''}
              onChange={(e) => setCurrentFAQ({ ...currentFAQ, page_context: e.target.value })}
              fullWidth
              helperText="e.g., dashboard, vm-creation, etc."
            />

            <TextField
              label="Feature Tag (optional)"
              value={currentFAQ.feature_tag || ''}
              onChange={(e) => setCurrentFAQ({ ...currentFAQ, feature_tag: e.target.value })}
              fullWidth
              helperText="e.g., sso, billing, etc."
            />

            <FormControl fullWidth>
              <InputLabel>Publish Status</InputLabel>
              <Select
                value={currentFAQ.is_published ? 'true' : 'false'}
                onChange={(e) => setCurrentFAQ({ ...currentFAQ, is_published: e.target.value === 'true' })}
                label="Publish Status"
              >
                <MenuItem value="false">Draft</MenuItem>
                <MenuItem value="true">Published</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">{editMode ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default FAQManagementPage;
