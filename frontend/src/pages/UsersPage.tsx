import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, CircularProgress } from '@mui/material';
import { usersService } from '../services/usersService';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersService.getAll().then(data => {
      setUsers(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Container><CircularProgress /></Container>;

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>Users Management</Typography>
        <Typography>Found {users.length} users</Typography>
        {users.map(u => (
          <Box key={u.id} sx={{ p: 2, border: '1px solid #ddd', my: 1 }}>
            <Typography><strong>{u.username}</strong> ({u.email}) - {u.role}</Typography>
          </Box>
        ))}
      </Box>
    </Container>
  );
};
