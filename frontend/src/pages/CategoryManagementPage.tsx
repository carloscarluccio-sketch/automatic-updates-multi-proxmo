import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import api from '../services/api';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  _count?: {
    help_articles: number;
    help_faqs: number;
  };
}

export const CategoryManagementPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Partial<Category>>({});
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/help-admin/categories');
      setCategories(response.data.data || []);
    } catch (err: any) {
      console.error('Load categories error:', err);
      setError(err.response?.data?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditMode(true);
      setCurrentCategory(category);
    } else {
      setEditMode(false);
      setCurrentCategory({
        is_active: true,
        display_order: 0
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentCategory({});
  };

  const handleSave = async () => {
    try {
      setError('');
      if (!currentCategory.name || !currentCategory.slug) {
        setError('Name and slug are required');
        return;
      }

      if (editMode && currentCategory.id) {
        await api.put(`/help-admin/categories/${currentCategory.id}`, currentCategory);
        setSuccess('Category updated successfully');
      } else {
        await api.post('/help-admin/categories', currentCategory);
        setSuccess('Category created successfully');
      }

      handleCloseDialog();
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save category');
    }
  };

  const handleOpenDeleteDialog = (category: Category) => {
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    try {
      setError('');
      await api.delete(`/help-admin/categories/${categoryToDelete.id}`);
      setSuccess('Category deleted successfully');
      handleCloseDeleteDialog();
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete category');
      handleCloseDeleteDialog();
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setCurrentCategory(prev => ({
      ...prev,
      name,
      // Auto-generate slug only for new categories
      ...(!editMode && { slug: generateSlug(name) })
    }));
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CategoryIcon sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h4">Category Management</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Category
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

      {loading ? (
        <Typography>Loading...</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="center">Articles</TableCell>
                <TableCell align="center">FAQs</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>{category.display_order}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {category.icon}
                      <strong>{category.name}</strong>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <code>{category.slug}</code>
                  </TableCell>
                  <TableCell>{category.description || '-'}</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={category._count?.help_articles || 0}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={category._count?.help_faqs || 0}
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={category.is_active ? 'Active' : 'Inactive'}
                      color={category.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleOpenDialog(category)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleOpenDeleteDialog(category)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit Category' : 'Add New Category'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Name"
              value={currentCategory.name || ''}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              fullWidth
            />

            <TextField
              label="Slug"
              value={currentCategory.slug || ''}
              onChange={(e) => setCurrentCategory({ ...currentCategory, slug: e.target.value })}
              required
              fullWidth
              helperText="URL-friendly identifier (e.g., getting-started)"
            />

            <TextField
              label="Description"
              value={currentCategory.description || ''}
              onChange={(e) => setCurrentCategory({ ...currentCategory, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />

            <TextField
              label="Icon (emoji or text)"
              value={currentCategory.icon || ''}
              onChange={(e) => setCurrentCategory({ ...currentCategory, icon: e.target.value })}
              fullWidth
              helperText="e.g., 📚, 🚀, or text"
            />

            <TextField
              label="Display Order"
              type="number"
              value={currentCategory.display_order || 0}
              onChange={(e) => setCurrentCategory({ ...currentCategory, display_order: parseInt(e.target.value) })}
              fullWidth
            />

            <FormControlLabel
              control={
                <Switch
                  checked={currentCategory.is_active !== false}
                  onChange={(e) => setCurrentCategory({ ...currentCategory, is_active: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the category <strong>{categoryToDelete?.name}</strong>?
          </Typography>
          {categoryToDelete && (categoryToDelete._count?.help_articles || 0) > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This category has {categoryToDelete._count?.help_articles} articles.
              You must reassign or delete them first.
            </Alert>
          )}
          {categoryToDelete && (categoryToDelete._count?.help_faqs || 0) > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This category has {categoryToDelete._count?.help_faqs} FAQs.
              You must reassign or delete them first.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CategoryManagementPage;
