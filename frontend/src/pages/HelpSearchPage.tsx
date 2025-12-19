import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Breadcrumbs,
  Link as MuiLink,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Article as ArticleIcon,
  HelpOutline as HelpOutlineIcon
} from '@mui/icons-material';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';

interface SearchResult {
  type: 'article' | 'faq';
  id: number;
  title?: string;
  question?: string;
  summary?: string;
  answer?: string;
  slug?: string;
  category_name: string;
  category_slug: string;
  relevance_score?: number;
}

const HelpSearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setError('Please enter at least 2 characters');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.get(`/help/search?q=${encodeURIComponent(searchQuery)}`);

      if (response.data.success) {
        setResults(response.data.data || []);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError('Failed to perform search');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const articles = results.filter(r => r.type === 'article');
  const faqs = results.filter(r => r.type === 'faq');

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <MuiLink component={Link} to="/" underline="hover" color="inherit">
          Home
        </MuiLink>
        <MuiLink component={Link} to="/help" underline="hover" color="inherit">
          Help Center
        </MuiLink>
        <Typography color="text.primary">Search Results</Typography>
      </Breadcrumbs>

      <Typography variant="h4" gutterBottom>
        Search Help Center
      </Typography>

      <Box component="form" onSubmit={handleSearch} sx={{ mb: 4 }}>
        <TextField
          fullWidth
          placeholder="Search for help articles, FAQs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ maxWidth: 600 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : results.length > 0 ? (
        <>
          <Typography variant="h6" gutterBottom>
            Found {results.length} results for "{initialQuery}"
          </Typography>

          {articles.length > 0 && (
            <>
              <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
                <ArticleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Articles ({articles.length})
              </Typography>

              <Grid container spacing={3} sx={{ mb: 4 }}>
                {articles.map((article) => (
                  <Grid item xs={12} md={6} key={article.id}>
                    <Card>
                      <CardActionArea
                        component={Link}
                        to={`/help/article/${article.slug}`}
                      >
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {article.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {article.summary}
                          </Typography>
                          <Chip
                            label={article.category_name}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </>
          )}

          {faqs.length > 0 && (
            <>
              <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
                <HelpOutlineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                FAQs ({faqs.length})
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
                    <Chip
                      label={faq.category_name}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </AccordionDetails>
                </Accordion>
              ))}
            </>
          )}
        </>
      ) : initialQuery && !loading ? (
        <Alert severity="info">
          No results found for "{initialQuery}". Try different keywords or browse by category.
        </Alert>
      ) : null}

      <Box sx={{ mt: 4 }}>
        <MuiLink component={Link} to="/help" underline="hover">
          ← Back to Help Center
        </MuiLink>
      </Box>
    </Container>
  );
};

export default HelpSearchPage;
