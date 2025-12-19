import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Breadcrumbs,
  Link as MuiLink,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Article as ArticleIcon,
  AccessTime as AccessTimeIcon,
  TrendingUp as TrendingUpIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon
} from '@mui/icons-material';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
}

interface FAQ {
  id: number;
  question: string;
  answer: string;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
}

interface Article {
  id: number;
  title: string;
  slug: string;
  summary: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_read_time: number;
  view_count: number;
  is_featured: boolean;
  published_at: string;
}

const HelpCategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [faqs, setFAQs] = useState<FAQ[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [faqFeedback, setFaqFeedback] = useState<Record<number, 'helpful' | 'not_helpful'>>({});

  useEffect(() => {
    loadData();
  }, [slug]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load category info
      const categoriesRes = await api.get('/help/categories');
      const foundCategory = categoriesRes.data.data?.find((c: Category) => c.slug === slug);

      if (!foundCategory) {
        setError('Category not found');
        setLoading(false);
        return;
      }
      setCategory(foundCategory);

      // Load FAQs and articles for this category
      const [faqsRes, articlesRes] = await Promise.all([
        api.get(`/help/faqs?category=${slug}`),
        api.get(`/help/articles?category=${slug}`)
      ]);

      setFAQs(faqsRes.data.data || []);
      setArticles(articlesRes.data.data || []);
    } catch (err: any) {
      console.error('Load category data error:', err);
      setError('Failed to load category content');
    } finally {
      setLoading(false);
    }
  };

  const handleFAQFeedback = async (faqId: number, isHelpful: boolean) => {
    if (faqFeedback[faqId]) return; // Already voted

    try {
      // Increment view count when expanded (if not already viewed)
      await api.post(`/help/faqs/${faqId}/view`);

      // Submit feedback
      await api.post(`/help/faqs/${faqId}/feedback`, {
        is_helpful: isHelpful
      });

      setFaqFeedback(prev => ({
        ...prev,
        [faqId]: isHelpful ? 'helpful' : 'not_helpful'
      }));

      // Update local counts
      setFAQs(prevFaqs => prevFaqs.map(faq => {
        if (faq.id === faqId) {
          return {
            ...faq,
            helpful_count: isHelpful ? faq.helpful_count + 1 : faq.helpful_count,
            not_helpful_count: !isHelpful ? faq.not_helpful_count + 1 : faq.not_helpful_count
          };
        }
        return faq;
      }));
    } catch (err: any) {
      console.error('FAQ feedback error:', err);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error || !category) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Category not found'}</Alert>
        <Box sx={{ mt: 2 }}>
          <MuiLink component={Link} to="/help" underline="hover">
            ← Back to Help Center
          </MuiLink>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <MuiLink component={Link} to="/" underline="hover" color="inherit">
          Home
        </MuiLink>
        <MuiLink component={Link} to="/help" underline="hover" color="inherit">
          Help Center
        </MuiLink>
        <Typography color="text.primary">{category.name}</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          {category.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {category.description}
        </Typography>
      </Box>

      {/* Articles Section */}
      {articles.length > 0 && (
        <>
          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            <ArticleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Articles
          </Typography>

          <Grid container spacing={3} sx={{ mb: 6 }}>
            {articles.map((article) => (
              <Grid item xs={12} md={6} key={article.id}>
                <Card>
                  <CardActionArea
                    component={Link}
                    to={`/help/article/${article.slug}`}
                  >
                    <CardContent>
                      {article.is_featured && (
                        <Chip
                          label="Featured"
                          size="small"
                          color="primary"
                          sx={{ mb: 1 }}
                        />
                      )}
                      <Typography variant="h6" gutterBottom>
                        {article.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {article.summary}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={article.difficulty}
                          size="small"
                          color={getDifficultyColor(article.difficulty) as any}
                          variant="outlined"
                        />
                        <Chip
                          icon={<AccessTimeIcon fontSize="small" />}
                          label={`${article.estimated_read_time} min read`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          icon={<TrendingUpIcon fontSize="small" />}
                          label={`${article.view_count} views`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* FAQs Section */}
      {faqs.length > 0 && (
        <>
          {articles.length > 0 && <Divider sx={{ mb: 4 }} />}

          <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
            Frequently Asked Questions
          </Typography>

          {faqs.map((faq) => (
            <Accordion key={faq.id}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">{faq.question}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                  {faq.answer}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={`${faq.view_count} views`}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`${faq.helpful_count} helpful`}
                      size="small"
                      variant="outlined"
                      color="success"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                      Was this helpful?
                    </Typography>
                    <Tooltip title="Helpful">
                      <IconButton
                        size="small"
                        onClick={() => handleFAQFeedback(faq.id, true)}
                        disabled={!!faqFeedback[faq.id]}
                        color={faqFeedback[faq.id] === 'helpful' ? 'success' : 'default'}
                      >
                        <ThumbUpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Not Helpful">
                      <IconButton
                        size="small"
                        onClick={() => handleFAQFeedback(faq.id, false)}
                        disabled={!!faqFeedback[faq.id]}
                        color={faqFeedback[faq.id] === 'not_helpful' ? 'error' : 'default'}
                      >
                        <ThumbDownIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {faqFeedback[faq.id] && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    Thank you for your feedback!
                  </Alert>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </>
      )}

      {articles.length === 0 && faqs.length === 0 && (
        <Alert severity="info">
          No content available in this category yet. Check back soon!
        </Alert>
      )}

      <Box sx={{ mt: 4 }}>
        <MuiLink component={Link} to="/help" underline="hover">
          ← Back to Help Center
        </MuiLink>
      </Box>
    </Container>
  );
};

export default HelpCategoryPage;
