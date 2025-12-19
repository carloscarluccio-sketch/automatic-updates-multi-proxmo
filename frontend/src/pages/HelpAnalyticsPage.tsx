import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Visibility as VisibilityIcon,
  ThumbUp as ThumbUpIcon,
  Category as CategoryIcon,
  Article as ArticleIcon,
  HelpOutline as HelpOutlineIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface AnalyticsStats {
  totalArticles: number;
  totalFAQs: number;
  totalCategories: number;
  totalViews: number;
  totalHelpfulVotes: number;
  avgHelpfulRatio: number;
}

interface PopularArticle {
  id: number;
  title: string;
  slug: string;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  category_name: string;
}

interface PopularFAQ {
  id: number;
  question: string;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  category_name: string;
}

export const HelpAnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [popularArticles, setPopularArticles] = useState<PopularArticle[]>([]);
  const [popularFAQs, setPopularFAQs] = useState<PopularFAQ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Load all data in parallel
      const [categoriesRes, articlesRes, faqsRes] = await Promise.all([
        api.get('/help/categories'),
        api.get('/help/articles'),
        api.get('/help/faqs')
      ]);

      const categories = categoriesRes.data.data || [];
      const articles = articlesRes.data.data || [];
      const faqs = faqsRes.data.data || [];

      // Calculate stats
      const totalViews = articles.reduce((sum: number, a: any) => sum + (a.view_count || 0), 0) +
                        faqs.reduce((sum: number, f: any) => sum + (f.view_count || 0), 0);

      const totalHelpful = articles.reduce((sum: number, a: any) => sum + (a.helpful_count || 0), 0) +
                          faqs.reduce((sum: number, f: any) => sum + (f.helpful_count || 0), 0);

      const totalNotHelpful = articles.reduce((sum: number, a: any) => sum + (a.not_helpful_count || 0), 0) +
                             faqs.reduce((sum: number, f: any) => sum + (f.not_helpful_count || 0), 0);

      const totalVotes = totalHelpful + totalNotHelpful;
      const avgHelpfulRatio = totalVotes > 0 ? (totalHelpful / totalVotes) * 100 : 0;

      setStats({
        totalArticles: articles.length,
        totalFAQs: faqs.length,
        totalCategories: categories.length,
        totalViews,
        totalHelpfulVotes: totalHelpful,
        avgHelpfulRatio
      });

      // Sort and get top articles
      const topArticles = [...articles]
        .sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 10);
      setPopularArticles(topArticles);

      // Sort and get top FAQs
      const topFAQs = [...faqs]
        .sort((a: any, b: any) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 10);
      setPopularFAQs(topFAQs);

    } catch (err: any) {
      console.error('Load analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getHelpfulRatio = (helpful: number, notHelpful: number) => {
    const total = helpful + notHelpful;
    return total > 0 ? Math.round((helpful / total) * 100) : 0;
  };

  const getHelpfulColor = (ratio: number) => {
    if (ratio >= 80) return 'success';
    if (ratio >= 60) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>Help Center Analytics</Typography>
        <LinearProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        Help Center Analytics
      </Typography>

      {/* Stats Overview */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <CategoryIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Categories</Typography>
                </Box>
                <Typography variant="h3">{stats.totalCategories}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ArticleIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Articles</Typography>
                </Box>
                <Typography variant="h3">{stats.totalArticles}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <HelpOutlineIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">FAQs</Typography>
                </Box>
                <Typography variant="h3">{stats.totalFAQs}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <VisibilityIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Total Views</Typography>
                </Box>
                <Typography variant="h3">{stats.totalViews.toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ThumbUpIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Helpful Votes</Typography>
                </Box>
                <Typography variant="h3">{stats.totalHelpfulVotes.toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TrendingUpIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Avg Helpful Ratio</Typography>
                </Box>
                <Typography variant="h3">{Math.round(stats.avgHelpfulRatio)}%</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Popular Articles */}
      <Paper sx={{ mb: 4, p: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Most Viewed Articles
        </Typography>

        {popularArticles.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Rank</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="center">Views</TableCell>
                  <TableCell align="center">Helpful Ratio</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {popularArticles.map((article, index) => {
                  const ratio = getHelpfulRatio(article.helpful_count, article.not_helpful_count);
                  return (
                    <TableRow key={article.id}>
                      <TableCell>
                        <Chip
                          label={`#${index + 1}`}
                          size="small"
                          color={index < 3 ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/help/article/${article.slug}`}
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          {article.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Chip label={article.category_name} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <strong>{article.view_count.toLocaleString()}</strong>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${ratio}%`}
                          size="small"
                          color={getHelpfulColor(ratio)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography color="text.secondary">No articles yet</Typography>
        )}
      </Paper>

      {/* Popular FAQs */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Most Viewed FAQs
        </Typography>

        {popularFAQs.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Rank</TableCell>
                  <TableCell>Question</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="center">Views</TableCell>
                  <TableCell align="center">Helpful Ratio</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {popularFAQs.map((faq, index) => {
                  const ratio = getHelpfulRatio(faq.helpful_count, faq.not_helpful_count);
                  return (
                    <TableRow key={faq.id}>
                      <TableCell>
                        <Chip
                          label={`#${index + 1}`}
                          size="small"
                          color={index < 3 ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{faq.question}</TableCell>
                      <TableCell>
                        <Chip label={faq.category_name} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <strong>{faq.view_count.toLocaleString()}</strong>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={`${ratio}%`}
                          size="small"
                          color={getHelpfulColor(ratio)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography color="text.secondary">No FAQs yet</Typography>
        )}
      </Paper>
    </Container>
  );
};

export default HelpAnalyticsPage;
