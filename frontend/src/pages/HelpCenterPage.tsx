import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  TextField,
  InputAdornment,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Breadcrumbs,
  Link as MuiLink,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  RocketLaunch as RocketLaunchIcon,
  Computer as ComputerIcon,
  NetworkCheck as NetworkCheckIcon,
  Palette as PaletteIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  AttachMoney as AttachMoneyIcon,
  Code as CodeIcon,
  BugReport as BugReportIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  article_count: number;
  faq_count: number;
}

interface FAQ {
  id: number;
  question: string;
  answer: string;
  category_name: string;
}

const iconMap: Record<string, React.ReactElement> = {
  RocketLaunch: <RocketLaunchIcon />,
  Computer: <ComputerIcon />,
  Network: <NetworkCheckIcon />,
  Palette: <PaletteIcon />,
  People: <PeopleIcon />,
  Business: <BusinessIcon />,
  Storage: <StorageIcon />,
  Security: <SecurityIcon />,
  AttachMoney: <AttachMoneyIcon />,
  Code: <CodeIcon />,
  BugReport: <BugReportIcon />,
  Settings: <SettingsIcon />
};

const HelpCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [faqs, setFAQs] = useState<FAQ[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [_loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, faqsRes] = await Promise.all([
        api.get('/help/categories'),
        api.get('/help/faqs')
      ]);

      setCategories(categoriesRes.data.data || []);
      setFAQs(faqsRes.data.data || []);
    } catch (err: any) {
      console.error('Load help data error:', err);
      setError('Failed to load help content');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim().length >= 2) {
      navigate(`/help/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 3 }}>
        <MuiLink component={Link} to="/" underline="hover" color="inherit">
          Home
        </MuiLink>
        <Typography color="text.primary">Help Center</Typography>
      </Breadcrumbs>

      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h3" gutterBottom>
          Help Center
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Find answers and learn how to use the platform
        </Typography>

        <TextField
          fullWidth
          placeholder="Search for help articles, FAQs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ maxWidth: 600, mt: 3 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Browse by Category
      </Typography>

      <Grid container spacing={3} sx={{ mb: 6 }}>
        {categories.map((category) => (
          <Grid item xs={12} sm={6} md={4} key={category.id}>
            <Card>
              <CardActionArea
                component={Link}
                to={`/help/category/${category.slug}`}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ mr: 2, color: 'primary.main' }}>
                      {iconMap[category.icon] || <SettingsIcon />}
                    </Box>
                    <Typography variant="h6">{category.name}</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {category.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={`${category.article_count} articles`}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`${category.faq_count} FAQs`}
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

      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Frequently Asked Questions
      </Typography>

      {faqs.slice(0, 10).map((faq) => (
        <Accordion key={faq.id}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">{faq.question}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {faq.answer}
            </Typography>
            <Chip
              label={faq.category_name}
              size="small"
              sx={{ mt: 2 }}
              color="primary"
              variant="outlined"
            />
          </AccordionDetails>
        </Accordion>
      ))}

      {faqs.length > 10 && (
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <MuiLink component={Link} to="/help/faq" underline="hover">
            View all FAQs
          </MuiLink>
        </Box>
      )}
    </Container>
  );
};

export default HelpCenterPage;
