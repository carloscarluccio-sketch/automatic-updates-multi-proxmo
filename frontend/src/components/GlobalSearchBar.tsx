import React, { useState, useEffect } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Chip,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Computer as VMIcon,
  Business as CompanyIcon,
  Person as UserIcon,
  ConfirmationNumber as TicketIcon,
  Storage as ClusterIcon,
  Folder as ProjectIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface SearchResult {
  vms: any[];
  companies: any[];
  users: any[];
  tickets: any[];
  clusters: any[];
  projects: any[];
}

interface SearchResponse {
  success: boolean;
  data: {
    results: SearchResult;
    totals: {
      vms: number;
      companies: number;
      users: number;
      tickets: number;
      clusters: number;
      projects: number;
      total: number;
    };
    query: string;
  };
}

export const GlobalSearchBar: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [totals, setTotals] = useState<any>(null);

  useEffect(() => {
    if (query.length >= 2) {
      const timer = setTimeout(() => {
        performSearch();
      }, 500); // Debounce search

      return () => clearTimeout(timer);
    } else {
      setResults(null);
      setTotals(null);
    }
  }, [query]);

  const performSearch = async () => {
    try {
      setLoading(true);
      const response = await api.get<SearchResponse>(`/search/global?query=${encodeURIComponent(query)}&limit=50`);
      if (response.data.success) {
        setResults(response.data.data.results);
        setTotals(response.data.data.totals);
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults(null);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (type: string, _item: any) => {
    const routes: any = {
      vms: `/vms`,
      companies: `/companies`,
      users: `/users`,
      tickets: `/support-tickets`,
      clusters: `/clusters`,
      projects: `/projects`
    };

    if (routes[type]) {
      navigate(routes[type]);
      setOpen(false);
      setQuery('');
    }
  };

  const getTotalResults = () => {
    return totals ? totals.total : 0;
  };

  const getIcon = (type: string) => {
    const icons: any = {
      vms: <VMIcon fontSize="small" />,
      companies: <CompanyIcon fontSize="small" />,
      users: <UserIcon fontSize="small" />,
      tickets: <TicketIcon fontSize="small" />,
      clusters: <ClusterIcon fontSize="small" />,
      projects: <ProjectIcon fontSize="small" />
    };
    return icons[type] || <SearchIcon fontSize="small" />;
  };

  const getItemText = (type: string, item: any) => {
    switch (type) {
      case 'vms':
        return {
          primary: `${item.name} (VMID: ${item.vmid})`,
          secondary: `Company: ${item.companies?.name || 'N/A'} | Cluster: ${item.proxmox_clusters?.name || 'N/A'} | IP: ${item.primary_ip_internal || item.primary_ip_external || 'No IP'}`
        };
      case 'companies':
        return {
          primary: item.name,
          secondary: `Email: ${item.email || 'N/A'} | Phone: ${item.phone || 'N/A'}`
        };
      case 'users':
        return {
          primary: `${item.username} (${item.email})`,
          secondary: `Role: ${item.role} | Company: ${item.companies?.name || 'N/A'}`
        };
      case 'tickets':
        return {
          primary: `${item.ticket_number} - ${item.subject}`,
          secondary: `Status: ${item.status} | Priority: ${item.priority} | Company: ${item.companies?.name || 'N/A'}`
        };
      case 'clusters':
        return {
          primary: item.name,
          secondary: `Host: ${item.host} | Location: ${item.location || 'N/A'}`
        };
      case 'projects':
        return {
          primary: item.name,
          secondary: `Company: ${item.companies?.name || 'N/A'} | ${item.description || ''}`
        };
      default:
        return {
          primary: item.name || 'Unknown',
          secondary: ''
        };
    }
  };

  const renderResults = (type: string, items: any[]) => {
    if (!items || items.length === 0) return null;

    const count = totals ? totals[type] : items.length;

    return (
      <Box sx={{ mb: 2 }} key={type}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 2, pb: 1 }}>
          {getIcon(type)}
          <Typography variant="subtitle2" color="text.secondary">
            {type.toUpperCase().replace('_', ' ')}
          </Typography>
          <Chip label={count} size="small" color="primary" />
        </Box>
        <Divider />
        <List dense>
          {items.slice(0, 5).map((item) => {
            const { primary, secondary } = getItemText(type, item);
            return (
              <ListItemButton
                key={item.id}
                onClick={() => handleResultClick(type, item)}
                sx={{
                  '&:hover': {
                    backgroundColor: 'action.hover'
                  }
                }}
              >
                <ListItemText
                  primary={primary}
                  secondary={secondary}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                  secondaryTypographyProps={{ variant: 'caption', noWrap: false }}
                />
              </ListItemButton>
            );
          })}
          {items.length > 5 && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1, display: 'block' }}>
              +{items.length - 5} more results
            </Typography>
          )}
        </List>
      </Box>
    );
  };

  return (
    <>
      <TextField
        placeholder="Search..."
        variant="outlined"
        size="small"
        onClick={() => setOpen(true)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{ minWidth: 250 }}
      />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SearchIcon />
            <Typography variant="h6">Global Search</Typography>
            <IconButton
              onClick={() => setOpen(false)}
              sx={{ ml: 'auto' }}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            placeholder="Search VMs, users, tickets, companies, clusters, and projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: loading && (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {query.length < 2 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography color="text.secondary">
                Type at least 2 characters to search across all entities
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                Search by name, IP address, email, VMID, or any identifier
              </Typography>
            </Box>
          )}

          {query.length >= 2 && results && getTotalResults() === 0 && !loading && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography color="text.secondary" gutterBottom>
                No results found for "{query}"
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Try a different search term or check your spelling
              </Typography>
            </Box>
          )}

          {results && getTotalResults() > 0 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, px: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Found <strong>{getTotalResults()}</strong> results across all entities
                </Typography>
              </Box>

              {renderResults('vms', results.vms)}
              {renderResults('tickets', results.tickets)}
              {renderResults('users', results.users)}
              {renderResults('companies', results.companies)}
              {renderResults('clusters', results.clusters)}
              {renderResults('projects', results.projects)}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GlobalSearchBar;
