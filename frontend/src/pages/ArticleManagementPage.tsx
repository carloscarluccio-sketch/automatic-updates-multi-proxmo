import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
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
  Snackbar,
  Tabs,
  Tab,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  FormLabel,
  Grid,
  Divider,
  Tooltip,
  SelectChangeEvent,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Publish as PublishIcon,
  UnpublishedOutlined as UnpublishIcon,
  Search as SearchIcon,
  Article as ArticleIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

// Markdown editor imports
import MarkdownIt from 'markdown-it';
import MdEditor from 'react-markdown-editor-lite';
import 'react-markdown-editor-lite/lib/index.css';

const mdParser = new MarkdownIt();

interface Article {
  id: number;
  title: string;
  slug: string;
  category: string;
  summary: string | null;
  content: string;
  visibility: 'global' | 'company_specific' | 'company_type' | 'role_specific';
  company_id: number | null;
  is_published: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  estimated_read_time: number | null;
  view_count: number;
  featured: boolean;
  page_context: string | null;
  feature_tag: string | null;
  meta_keywords: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number | null;
  help_categories?: {
    id: number;
    name: string;
    icon: string | null;
  };
  companies?: {
    id: number;
    name: string;
  } | null;
  users_help_articles_created_byTousers?: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  help_article_targeting?: ArticleTargeting[];
}

interface ArticleTargeting {
  id: number;
  article_id: number;
  target_type: 'company_id' | 'company_type' | 'role';
  target_value: string;
}

interface Company {
  id: number;
  name: string;
  company_type: string | null;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`article-tabpanel-${index}`}
      aria-labelledby={`article-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const ArticleManagementPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const isCompanyAdmin = user?.role === 'company_admin';
  const canEdit = isSuperAdmin || isCompanyAdmin;

  // State
  const [articles, setArticles] = useState<Article[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [publishedFilter, setPublishedFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);

  // Dialogs
  const [editorDialogOpen, setEditorDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [changelogDialogOpen, setChangelogDialogOpen] = useState(false);

  // Editor state
  const [currentArticle, setCurrentArticle] = useState<Partial<Article> | null>(null);
  const [editorTab, setEditorTab] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    category: 'general',
    summary: '',
    content: '',
    visibility: 'global' as 'global' | 'company_specific' | 'company_type' | 'role_specific',
    company_id: null as number | null,
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    estimated_read_time: 5,
    featured: false,
    page_context: '',
    feature_tag: '',
    meta_keywords: '',
    meta_description: '',
  });

  // Targeting state
  const [targetCompanies, setTargetCompanies] = useState<number[]>([]);
  const [targetCompanyTypes, setTargetCompanyTypes] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);

  const categories = [
    'general',
    'getting_started',
    'vm_management',
    'network',
    'billing',
    'troubleshooting',
    'api',
    'security',
  ];

  const companyTypes = ['standard', 'enterprise', 'partner', 'trial'];
  const roles = ['user', 'company_admin', 'super_admin', 'salesperson'];

  useEffect(() => {
    loadData();
  }, [searchQuery, categoryFilter, visibilityFilter, publishedFilter, page, rowsPerPage]);

  useEffect(() => {
    if (canEdit) {
      loadCompanies();
    }
  }, [canEdit]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const params: any = {
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      };

      if (searchQuery) params.search = searchQuery;
      if (categoryFilter) params.category = categoryFilter;
      if (visibilityFilter) params.visibility = visibilityFilter;
      if (publishedFilter) params.is_published = publishedFilter === 'published';

      const response = await api.get('/help-admin/articles', { params });
      setArticles(response.data.data || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data.data || []);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const handleCreateArticle = () => {
    setCurrentArticle(null);
    setIsEditMode(false);
    setFormData({
      title: '',
      slug: '',
      category: 'general',
      summary: '',
      content: '',
      visibility: 'global',
      company_id: null,
      difficulty: 'beginner',
      estimated_read_time: 5,
      featured: false,
      page_context: '',
      feature_tag: '',
      meta_keywords: '',
      meta_description: '',
    });
    setTargetCompanies([]);
    setTargetCompanyTypes([]);
    setTargetRoles([]);
    setEditorTab(0);
    setEditorDialogOpen(true);
  };

  const handleEditArticle = async (article: Article) => {
    setCurrentArticle(article);
    setIsEditMode(true);
    setFormData({
      title: article.title,
      slug: article.slug,
      category: article.help_categories?.name || '',
      summary: article.summary || '',
      content: article.content,
      visibility: article.visibility,
      company_id: article.company_id,
      difficulty: article.difficulty || 'beginner',
      estimated_read_time: article.estimated_read_time || 5,
      featured: article.featured,
      page_context: article.page_context || '',
      feature_tag: article.feature_tag || '',
      meta_keywords: article.meta_keywords || '',
      meta_description: article.meta_description || '',
    });

    // Load targeting data
    if (article.help_article_targeting) {
      const companies = article.help_article_targeting
        .filter((t) => t.target_type === 'company_id')
        .map((t) => parseInt(t.target_value));
      const companyTypes = article.help_article_targeting
        .filter((t) => t.target_type === 'company_type')
        .map((t) => t.target_value);
      const roles = article.help_article_targeting
        .filter((t) => t.target_type === 'role')
        .map((t) => t.target_value);

      setTargetCompanies(companies);
      setTargetCompanyTypes(companyTypes);
      setTargetRoles(roles);
    }

    setEditorTab(0);
    setEditorDialogOpen(true);
  };

  const handleDeleteArticle = (article: Article) => {
    setCurrentArticle(article);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!currentArticle?.id) return;

    try {
      await api.delete(`/help-admin/articles/${currentArticle.id}`);
      setSuccess('Article deleted successfully');
      setSnackbarOpen(true);
      setDeleteDialogOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete article');
      setSnackbarOpen(true);
    }
  };

  const handleTogglePublish = async (article: Article) => {
    try {
      await api.patch(`/help-admin/articles/${article.id}`, {
        is_published: !article.is_published,
      });
      setSuccess(`Article ${!article.is_published ? 'published' : 'unpublished'} successfully`);
      setSnackbarOpen(true);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update article');
      setSnackbarOpen(true);
    }
  };

  const handleSaveArticle = async (publish: boolean = false) => {
    try {
      // Validation
      if (!formData.title.trim()) {
        setError('Title is required');
        setSnackbarOpen(true);
        return;
      }

      if (!formData.content.trim()) {
        setError('Content is required');
        setSnackbarOpen(true);
        return;
      }

      // Build targeting array
      const targeting: Array<{ target_type: string; target_value: string }> = [];

      if (formData.visibility === 'company_specific') {
        targetCompanies.forEach((companyId) => {
          targeting.push({ target_type: 'company_id', target_value: String(companyId) });
        });
      } else if (formData.visibility === 'company_type') {
        targetCompanyTypes.forEach((type) => {
          targeting.push({ target_type: 'company_type', target_value: type });
        });
      } else if (formData.visibility === 'role_specific') {
        targetRoles.forEach((role) => {
          targeting.push({ target_type: 'role', target_value: role });
        });
      }

      const payload = {
        ...formData,
        is_published: publish,
        targeting,
      };

      if (isEditMode && currentArticle?.id) {
        await api.put(`/help-admin/articles/${currentArticle.id}`, payload);
        setSuccess('Article updated successfully');
      } else {
        await api.post('/help-admin/articles', payload);
        setSuccess('Article created successfully');
      }

      setSnackbarOpen(true);
      setEditorDialogOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save article');
      setSnackbarOpen(true);
    }
  };

  const handleViewChangelog = async (article: Article) => {
    // Future implementation: load changelog from API
    setCurrentArticle(article);
    setChangelogDialogOpen(true);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setFormData({
      ...formData,
      title: newTitle,
      slug: generateSlug(newTitle),
    });
  };

  const handleEditorChange = ({ text }: { html: string; text: string }) => {
    setFormData({ ...formData, content: text });
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  const handleCategoryFilterChange = (event: SelectChangeEvent) => {
    setCategoryFilter(event.target.value);
    setPage(0);
  };

  const handleVisibilityFilterChange = (event: SelectChangeEvent) => {
    setVisibilityFilter(event.target.value);
    setPage(0);
  };

  const handlePublishedFilterChange = (event: SelectChangeEvent) => {
    setPublishedFilter(event.target.value);
    setPage(0);
  };

  const getVisibilityChip = (visibility: string) => {
    const colors: any = {
      global: 'success',
      company_specific: 'primary',
      company_type: 'info',
      role_specific: 'warning',
    };
    return <Chip label={visibility.replace('_', ' ')} color={colors[visibility] || 'default'} size="small" />;
  };

  const formatUserName = (user: any) => {
    if (!user) return 'Unknown';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const name = `${firstName} ${lastName}`.trim();
    return name || user.email;
  };

  const canEditArticle = (article: Article) => {
    if (isSuperAdmin) return true;
    if (isCompanyAdmin && article.company_id === user?.company_id) return true;
    return false;
  };

  if (loading && articles.length === 0) {
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
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              <ArticleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Article Management
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Create and manage knowledge base articles
            </Typography>
          </Box>
          {canEdit && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateArticle}>
              Create Article
            </Button>
          )}
        </Box>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search articles..."
                value={searchQuery}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={categoryFilter} label="Category" onChange={handleCategoryFilterChange}>
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat.replace('_', ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth>
                <InputLabel>Visibility</InputLabel>
                <Select value={visibilityFilter} label="Visibility" onChange={handleVisibilityFilterChange}>
                  <MenuItem value="">All Visibility</MenuItem>
                  <MenuItem value="global">Global</MenuItem>
                  <MenuItem value="company_specific">Company Specific</MenuItem>
                  <MenuItem value="company_type">Company Type</MenuItem>
                  <MenuItem value="role_specific">Role Specific</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select value={publishedFilter} label="Status" onChange={handlePublishedFilterChange}>
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="published">Published</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Articles Table */}
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Visibility</TableCell>
                {isSuperAdmin && <TableCell>Company</TableCell>}
                <TableCell align="center">Views</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {articles.map((article) => (
                <TableRow key={article.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body1" fontWeight={article.featured ? 'bold' : 'normal'}>
                        {article.title}
                        {article.featured && (
                          <Chip label="Featured" size="small" color="secondary" sx={{ ml: 1 }} />
                        )}
                      </Typography>
                      {article.summary && (
                        <Typography variant="caption" color="textSecondary">
                          {article.summary.substring(0, 80)}...
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={article.help_categories?.name || 'Uncategorized'} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={article.is_published ? 'Published' : 'Draft'}
                      color={article.is_published ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{getVisibilityChip(article.visibility)}</TableCell>
                  {isSuperAdmin && (
                    <TableCell>{article.companies ? article.companies.name : 'Global'}</TableCell>
                  )}
                  <TableCell align="center">{article.view_count}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(article.updated_at).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      by {formatUserName(article.users_help_articles_created_byTousers)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      {canEditArticle(article) && (
                        <>
                          <Tooltip title={article.is_published ? 'Unpublish' : 'Publish'}>
                            <IconButton
                              size="small"
                              onClick={() => handleTogglePublish(article)}
                              color={article.is_published ? 'warning' : 'success'}
                            >
                              {article.is_published ? <UnpublishIcon /> : <PublishIcon />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleEditArticle(article)}>
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDeleteArticle(article)}>
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip title="View Changelog">
                        <IconButton size="small" onClick={() => handleViewChangelog(article)}>
                          <HistoryIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {articles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 8 : 7} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">No articles found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </TableContainer>

        {/* Editor Dialog */}
        <Dialog open={editorDialogOpen} onClose={() => setEditorDialogOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>{isEditMode ? 'Edit Article' : 'Create New Article'}</DialogTitle>
          <DialogContent>
            <Tabs value={editorTab} onChange={(_, newValue) => setEditorTab(newValue)}>
              <Tab label="Content" />
              <Tab label="Settings" />
              <Tab label="Targeting" />
            </Tabs>

            {/* Content Tab */}
            <TabPanel value={editorTab} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Title *"
                  value={formData.title}
                  onChange={handleTitleChange}
                  required
                />
                <TextField
                  fullWidth
                  label="Slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  helperText="URL-friendly identifier (auto-generated from title)"
                />
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    label="Category"
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map((cat) => (
                      <MenuItem key={cat} value={cat}>
                        {cat.replace('_', ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="Summary"
                  multiline
                  rows={2}
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  helperText="Brief description for search results"
                />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Content (Markdown) *
                  </Typography>
                  <MdEditor
                    value={formData.content}
                    style={{ height: '400px' }}
                    renderHTML={(text) => mdParser.render(text)}
                    onChange={handleEditorChange}
                  />
                </Box>
              </Box>
            </TabPanel>

            {/* Settings Tab */}
            <TabPanel value={editorTab} index={1}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Difficulty</InputLabel>
                  <Select
                    value={formData.difficulty}
                    label="Difficulty"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        difficulty: e.target.value as 'beginner' | 'intermediate' | 'advanced',
                      })
                    }
                  >
                    <MenuItem value="beginner">Beginner</MenuItem>
                    <MenuItem value="intermediate">Intermediate</MenuItem>
                    <MenuItem value="advanced">Advanced</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  type="number"
                  label="Estimated Read Time (minutes)"
                  value={formData.estimated_read_time}
                  onChange={(e) =>
                    setFormData({ ...formData, estimated_read_time: parseInt(e.target.value) || 0 })
                  }
                  inputProps={{ min: 1, max: 60 }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    />
                  }
                  label="Featured Article"
                />
                <TextField
                  fullWidth
                  label="Page Context"
                  value={formData.page_context}
                  onChange={(e) => setFormData({ ...formData, page_context: e.target.value })}
                  helperText="e.g., vm_management, dashboard (for contextual help)"
                />
                <TextField
                  fullWidth
                  label="Feature Tag"
                  value={formData.feature_tag}
                  onChange={(e) => setFormData({ ...formData, feature_tag: e.target.value })}
                  helperText="e.g., backup, networking (for categorization)"
                />
                <Divider />
                <Typography variant="subtitle2">SEO Metadata</Typography>
                <TextField
                  fullWidth
                  label="Meta Keywords"
                  value={formData.meta_keywords}
                  onChange={(e) => setFormData({ ...formData, meta_keywords: e.target.value })}
                  helperText="Comma-separated keywords for search"
                />
                <TextField
                  fullWidth
                  label="Meta Description"
                  multiline
                  rows={2}
                  value={formData.meta_description}
                  onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                  helperText="Search engine description (150-160 characters recommended)"
                />
              </Box>
            </TabPanel>

            {/* Targeting Tab */}
            <TabPanel value={editorTab} index={2}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Visibility</FormLabel>
                  <RadioGroup
                    value={formData.visibility}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        visibility: e.target.value as
                          | 'global'
                          | 'company_specific'
                          | 'company_type'
                          | 'role_specific',
                      })
                    }
                  >
                    <FormControlLabel value="global" control={<Radio />} label="Global (visible to all)" />
                    <FormControlLabel
                      value="company_specific"
                      control={<Radio />}
                      label="Company Specific"
                      disabled={!isSuperAdmin && !isCompanyAdmin}
                    />
                    <FormControlLabel
                      value="company_type"
                      control={<Radio />}
                      label="Company Type"
                      disabled={!isSuperAdmin}
                    />
                    <FormControlLabel
                      value="role_specific"
                      control={<Radio />}
                      label="Role Specific"
                      disabled={!isSuperAdmin}
                    />
                  </RadioGroup>
                </FormControl>

                {formData.visibility === 'company_specific' && (
                  <FormControl fullWidth>
                    <InputLabel>Select Companies</InputLabel>
                    <Select
                      multiple
                      value={targetCompanies}
                      label="Select Companies"
                      onChange={(e) => setTargetCompanies(e.target.value as number[])}
                      renderValue={(selected) =>
                        selected
                          .map((id) => companies.find((c) => c.id === id)?.name || id)
                          .join(', ')
                      }
                    >
                      {companies.map((company) => (
                        <MenuItem key={company.id} value={company.id}>
                          <Checkbox checked={targetCompanies.includes(company.id)} />
                          {company.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {formData.visibility === 'company_type' && (
                  <FormControl fullWidth>
                    <InputLabel>Select Company Types</InputLabel>
                    <Select
                      multiple
                      value={targetCompanyTypes}
                      label="Select Company Types"
                      onChange={(e) => setTargetCompanyTypes(e.target.value as string[])}
                      renderValue={(selected) => selected.join(', ')}
                    >
                      {companyTypes.map((type) => (
                        <MenuItem key={type} value={type}>
                          <Checkbox checked={targetCompanyTypes.includes(type)} />
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {formData.visibility === 'role_specific' && (
                  <FormControl fullWidth>
                    <InputLabel>Select Roles</InputLabel>
                    <Select
                      multiple
                      value={targetRoles}
                      label="Select Roles"
                      onChange={(e) => setTargetRoles(e.target.value as string[])}
                      renderValue={(selected) => selected.join(', ')}
                    >
                      {roles.map((role) => (
                        <MenuItem key={role} value={role}>
                          <Checkbox checked={targetRoles.includes(role)} />
                          {role.replace('_', ' ')}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {!isSuperAdmin && isCompanyAdmin && (
                  <Alert severity="info">
                    Company admins can only create articles for their own company or global articles.
                  </Alert>
                )}
              </Box>
            </TabPanel>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditorDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => handleSaveArticle(false)} variant="outlined">
              Save as Draft
            </Button>
            <Button onClick={() => handleSaveArticle(true)} variant="contained">
              {isEditMode ? 'Update & Publish' : 'Create & Publish'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete the article "<strong>{currentArticle?.title}</strong>"? This action
              cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmDelete} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Changelog Dialog (Future Implementation) */}
        <Dialog open={changelogDialogOpen} onClose={() => setChangelogDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Article Changelog</DialogTitle>
          <DialogContent>
            <Typography color="textSecondary">Changelog feature coming soon...</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setChangelogDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity={error ? 'error' : 'success'}
            sx={{ width: '100%' }}
          >
            {error || success}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default ArticleManagementPage;
