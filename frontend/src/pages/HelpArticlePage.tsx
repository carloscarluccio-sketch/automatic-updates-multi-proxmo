import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Breadcrumbs,
  Link as MuiLink,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Button,
  ButtonGroup
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  TrendingUp as TrendingUpIcon,
  Star as StarIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon
} from '@mui/icons-material';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

interface Article {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_read_time: number;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  is_featured: boolean;
  published_at: string;
  updated_at: string;
  category_name: string;
  category_slug: string;
}

const HelpArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedbackGiven, setFeedbackGiven] = useState<'helpful' | 'not_helpful' | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');

  useEffect(() => {
    loadArticle();
  }, [slug]);

  const loadArticle = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(`/help/articles/${slug}`);

      if (response.data.success) {
        setArticle(response.data.data);
      } else {
        setError('Article not found');
      }
    } catch (err: any) {
      console.error('Load article error:', err);
      setError('Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (isHelpful: boolean) => {
    if (!article || feedbackGiven) return;

    try {
      await api.post(`/help/articles/${article.id}/feedback`, {
        is_helpful: isHelpful
      });

      setFeedbackGiven(isHelpful ? 'helpful' : 'not_helpful');
      setFeedbackSuccess('Thank you for your feedback!');

      // Update local counts
      if (article) {
        setArticle({
          ...article,
          helpful_count: isHelpful ? article.helpful_count + 1 : article.helpful_count,
          not_helpful_count: !isHelpful ? article.not_helpful_count + 1 : article.not_helpful_count
        });
      }

      setTimeout(() => setFeedbackSuccess(''), 3000);
    } catch (err: any) {
      console.error('Feedback error:', err);
      setError('Failed to submit feedback');
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

  if (error || !article) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Article not found'}</Alert>
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
        <MuiLink
          component={Link}
          to={`/help/category/${article.category_slug}`}
          underline="hover"
          color="inherit"
        >
          {article.category_name}
        </MuiLink>
        <Typography color="text.primary">{article.title}</Typography>
      </Breadcrumbs>

      <Paper sx={{ p: 4 }}>
        {article.is_featured && (
          <Chip
            icon={<StarIcon />}
            label="Featured"
            color="primary"
            sx={{ mb: 2 }}
          />
        )}

        <Typography variant="h3" gutterBottom>
          {article.title}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Chip
            label={article.difficulty}
            size="small"
            color={getDifficultyColor(article.difficulty) as any}
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

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontStyle: 'italic' }}>
          {article.summary}
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Box
          sx={{
            '& h1': { fontSize: '2rem', fontWeight: 600, mt: 3, mb: 2 },
            '& h2': { fontSize: '1.5rem', fontWeight: 600, mt: 3, mb: 2 },
            '& h3': { fontSize: '1.25rem', fontWeight: 600, mt: 2, mb: 1 },
            '& p': { mb: 2, lineHeight: 1.7 },
            '& ul, & ol': { mb: 2, pl: 3 },
            '& li': { mb: 1 },
            '& code': {
              bgcolor: '#f5f5f5',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.9em'
            },
            '& pre': {
              bgcolor: '#f5f5f5',
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              mb: 2
            },
            '& blockquote': {
              borderLeft: '4px solid #1976d2',
              pl: 2,
              ml: 0,
              fontStyle: 'italic',
              color: 'text.secondary'
            },
            '& img': {
              maxWidth: '100%',
              height: 'auto',
              borderRadius: 1,
              my: 2
            },
            '& table': {
              width: '100%',
              borderCollapse: 'collapse',
              mb: 2
            },
            '& th, & td': {
              border: '1px solid #ddd',
              p: 1,
              textAlign: 'left'
            },
            '& th': {
              bgcolor: '#f5f5f5',
              fontWeight: 600
            }
          }}
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        <Divider sx={{ my: 4 }} />

        {/* Feedback Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Was this article helpful?
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <ButtonGroup variant="outlined" disabled={!!feedbackGiven}>
              <Button
                startIcon={<ThumbUpIcon />}
                onClick={() => handleFeedback(true)}
                color={feedbackGiven === 'helpful' ? 'success' : 'primary'}
                variant={feedbackGiven === 'helpful' ? 'contained' : 'outlined'}
              >
                Helpful ({article.helpful_count})
              </Button>
              <Button
                startIcon={<ThumbDownIcon />}
                onClick={() => handleFeedback(false)}
                color={feedbackGiven === 'not_helpful' ? 'error' : 'primary'}
                variant={feedbackGiven === 'not_helpful' ? 'contained' : 'outlined'}
              >
                Not Helpful ({article.not_helpful_count})
              </Button>
            </ButtonGroup>
            {feedbackSuccess && (
              <Alert severity="success" sx={{ py: 0 }}>
                {feedbackSuccess}
              </Alert>
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Last updated: {new Date(article.updated_at).toLocaleDateString()}
          </Typography>
          <MuiLink component={Link} to={`/help/category/${article.category_slug}`} underline="hover">
            View more in {article.category_name}
          </MuiLink>
        </Box>
      </Paper>

      <Box sx={{ mt: 4 }}>
        <MuiLink component={Link} to="/help" underline="hover">
          ← Back to Help Center
        </MuiLink>
      </Box>
    </Container>
  );
};

export default HelpArticlePage;
