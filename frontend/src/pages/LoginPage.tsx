import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  CircularProgress,
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
import axios from 'axios';

interface Branding {
  panel_name?: string;
  logo_filename?: string;
  login_bg_color?: string;
}

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
  const [branding, setBranding] = useState<Branding | null>(null);

  // Load branding on mount (no auth required)
  useEffect(() => {
    const loadBranding = async () => {
      try {
        const response = await axios.get('/api/companies/branding/public');
        setBranding(response.data.data);
      } catch (error) {
        console.error('Failed to load branding:', error);
      }
    };
    loadBranding();
  }, []);

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
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: branding?.login_bg_color || '#1a1a2e',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'auto',
        padding: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 450,
          boxShadow: 6,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Logo and Title */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            {branding?.logo_filename ? (
              <Box sx={{ mb: 2 }}>
                <img
                  src={`/uploads/logos/${branding.logo_filename}`}
                  alt="Logo"
                  style={{
                    maxHeight: 80,
                    maxWidth: '100%',
                    objectFit: 'contain',
                  }}
                />
              </Box>
            ) : (
              <LockIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            )}
            <Typography variant="h4" component="h1" fontWeight={600}>
              {branding?.panel_name || 'Proxmox Multi-Tenant'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Sign in to continue
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity={requires2FASetup ? 'warning' : 'error'} sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Login Form */}
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
                  variant="outlined"
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
                  variant="outlined"
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
                <Box sx={{ textAlign: 'right', mt: 1 }}>
                  <Link
                    to="/forgot-password"
                    style={{
                      fontSize: '0.875rem',
                      textDecoration: 'none',
                      color: '#1976d2',
                    }}
                  >
                    Forgot Password?
                  </Link>
                </Box>
              </>
            )}

            {/* 2FA Input */}
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
                  variant="outlined"
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

            {/* Submit Button */}
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading || (requires2FA && totp.length !== 6)}
              sx={{
                mt: 3,
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : requires2FA ? (
                'Verify 2FA Code'
              ) : (
                'Sign In'
              )}
            </Button>

            {/* Back to Login Button */}
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

          {/* 2FA Setup Warning */}
          {requires2FASetup && (
            <Box
              sx={{
                mt: 3,
                p: 2.5,
                bgcolor: 'warning.light',
                borderRadius: 2,
                border: 1,
                borderColor: 'warning.main',
              }}
            >
              <Typography variant="body2" align="center" color="warning.dark" fontWeight={500}>
                Your account requires two-factor authentication (2FA) to be enabled.
                Please contact your administrator to set up 2FA before you can log in.
              </Typography>
            </Box>
          )}

          {/* Footer */}
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}
          >
            © {new Date().getFullYear()} {branding?.panel_name || 'Proxmox Multi-Tenant Platform'}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};
