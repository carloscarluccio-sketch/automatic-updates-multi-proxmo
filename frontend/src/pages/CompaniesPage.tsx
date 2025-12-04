import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import { companiesService } from '../services/companiesService';

export const CompaniesPage: React.FC = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    companiesService.getAll().then(data => {
      setCompanies(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Container><CircularProgress /></Container>;

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>Companies Management</Typography>
        <Typography>Found {companies.length} companies</Typography>
        {companies.map(c => (
          <Box key={c.id} sx={{ p: 2, border: '1px solid #ddd', my: 1 }}>
            <Typography><strong>{c.name}</strong> - {c.primary_email}</Typography>
          </Box>
        ))}
      </Box>
    </Container>
  );
};
