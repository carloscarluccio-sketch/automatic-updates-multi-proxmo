import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Container,
  InputAdornment,
  IconButton,
  Collapse,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import SecurityIcon from '@mui/icons-material/Security';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [requires2FASetup, setRequires2FASetup] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loginData: any = { email, password };
      if (requires2FA && totp) {
        loginData.totp = totp;
      }

      const response: any = await authService.login(loginData);

      // Check if 2FA is required
      if (response.data?.requires2FA) {
        setRequires2FA(true);
        setError('');
        setLoading(false);
        return;
      }

      // Check if 2FA setup is required
      if (response.data?.requires2FASetup) {
        setRequires2FASetup(true);
        setError('2FA is required for your account. Please contact your administrator to enable 2FA.');
        setLoading(false);
        return;
      }

      // Successful login
      setUser(response.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed';

      // Check if response indicates 2FA requirement
      if (err.response?.data?.requires2FA) {
        setRequires2FA(true);
        setError('');
      } else if (err.response?.data?.requires2FASetup) {
        setRequires2FASetup(true);
        setError(message);
      } else {
        setError(message);
        setRequires2FA(false);
        setRequires2FASetup(false);
        setTotp(''); // Clear TOTP on error
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRequires2FA(false);
    setRequires2FASetup(false);
    setTotp('');
    setError('');
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
              <LockIcon sx={{ fontSize: 48, color: 'primary.main', mr: 2 }} />
              <Typography variant="h4" align="center">
                Proxmox Multi-Tenant
              </Typography>
            </Box>

            {error && (
              <Alert severity={requires2FASetup ? 'warning' : 'error'} sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              {!requires2FA && !requires2FASetup && (
                <>
                  <TextField
                    fullWidth
                    label="Email or Username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    margin="normal"
                    required
                    autoComplete="username"
                    autoFocus
                  />
                  <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    margin="normal"
                    required
                    autoComplete="current-password"
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </>
              )}

              <Collapse in={requires2FA}>
                <Box sx={{ mt: 2 }}>
                  <Alert severity="info" icon={<SecurityIcon />} sx={{ mb: 2 }}>
                    Two-factor authentication is enabled. Enter your 6-digit code from your authenticator app.
                  </Alert>
                  <TextField
                    fullWidth
                    label="2FA Code"
                    value={totp}
                    onChange={(e) => {
                      // Only allow digits and limit to 6 characters
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTotp(value);
                    }}
                    margin="normal"
                    required={requires2FA}
                    autoComplete="off"
                    autoFocus={requires2FA}
                    placeholder="000000"
                    inputProps={{
                      inputMode: 'numeric',
                      pattern: '[0-9]*',
                      maxLength: 6,
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SecurityIcon color="primary" />
                        </InputAdornment>
                      ),
                    }}
                    helperText="Enter the 6-digit code from your authenticator app"
                  />
                </Box>
              </Collapse>

              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={loading || (requires2FA && totp.length !== 6)}
                sx={{ mt: 3, py: 1.5 }}
              >
                {loading ? (
                  <CircularProgress size={24} />
                ) : requires2FA ? (
                  'Verify 2FA Code'
                ) : (
                  'Sign In'
                )}
              </Button>

              {requires2FA && (
                <Button
                  fullWidth
                  variant="text"
                  onClick={handleBackToLogin}
                  disabled={loading}
                  sx={{ mt: 1 }}
                >
                  Back to Login
                </Button>
              )}
            </form>

            {requires2FASetup && (
              <Box sx={{ mt: 3, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                <Typography variant="body2" align="center" color="warning.dark">
                  Your account requires two-factor authentication (2FA) to be enabled.
                  Please contact your administrator to set up 2FA before you can log in.
                </Typography>
              </Box>
            )}

            <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 3 }}>
              © {new Date().getFullYear()} Proxmox Multi-Tenant Platform
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};
