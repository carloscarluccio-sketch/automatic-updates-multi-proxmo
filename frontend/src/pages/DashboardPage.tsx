import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import { useAuthStore } from '../store/authStore';

export const DashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  return (
    <Container>
      <Box sx={{ py: 4 }}>
        <Typography variant="h4">Dashboard</Typography>
        <Typography>Welcome, {user?.username}!</Typography>
      </Box>
    </Container>
  );
};
