import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Paper,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import api from '../services/api';

export const TwoFactorAuthPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openSetupDialog, setOpenSetupDialog] = useState(false);
  const [openDisableDialog, setOpenDisableDialog] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [qrCode, setQrCode] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showManualKey, setShowManualKey] = useState(false);

  const setupSteps = ['Generate QR Code', 'Scan Code', 'Verify Setup'];

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/2fa/status');
      setEnabled(response.data.data.enabled || false);
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
      showSnackbar('Failed to load 2FA status', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleStartSetup = async () => {
    try {
      setLoading(true);
      const response = await api.post('/2fa/setup');
      setQrCode(response.data.data.qrCode);
      setManualKey(response.data.data.manualEntryKey);
      setActiveStep(0);
      setOpenSetupDialog(true);
      showSnackbar(response.data.message || 'QR code generated successfully', 'success');
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Failed to setup 2FA', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showSnackbar('Please enter a valid 6-digit code', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/2fa/verify', {
        token: verificationCode,
      });
      showSnackbar(response.data.message || '2FA enabled successfully!', 'success');
      setOpenSetupDialog(false);
      setActiveStep(0);
      setVerificationCode('');
      await loadStatus();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Invalid verification code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disableCode || disableCode.length !== 6) {
      showSnackbar('Please enter a valid 6-digit code', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/2fa/disable', {
        token: disableCode,
      });
      showSnackbar(response.data.message || '2FA disabled successfully', 'success');
      setOpenDisableDialog(false);
      setDisableCode('');
      await loadStatus();
    } catch (error: any) {
      showSnackbar(error.response?.data?.message || 'Invalid verification code', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyManualKey = () => {
    navigator.clipboard.writeText(manualKey);
    showSnackbar('Manual key copied to clipboard', 'success');
  };

  const handleCloseSetupDialog = () => {
    setOpenSetupDialog(false);
    setActiveStep(0);
    setVerificationCode('');
  };

  const handleCloseDisableDialog = () => {
    setOpenDisableDialog(false);
    setDisableCode('');
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <QrCode2Icon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              QR Code Generated
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              A unique QR code has been generated for your account. You'll scan this in the next step.
            </Typography>
            <Alert severity="info">
              Make sure you have an authenticator app installed on your phone (Google Authenticator, Microsoft
              Authenticator, Authy, etc.)
            </Alert>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="h6" gutterBottom>
              Scan QR Code
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Open your authenticator app and scan this QR code
            </Typography>

            {qrCode && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <img src={qrCode} alt="2FA QR Code" style={{ maxWidth: '100%', height: 'auto' }} />
              </Box>
            )}

            <Box sx={{ mt: 3 }}>
              <Button
                size="small"
                startIcon={showManualKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                onClick={() => setShowManualKey(!showManualKey)}
              >
                {showManualKey ? 'Hide' : 'Show'} Manual Entry Key
              </Button>
            </Box>

            {showManualKey && (
              <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.100' }}>
                <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                  Manual Entry Key (if you can't scan the QR code):
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {manualKey}
                  </Typography>
                  <IconButton size="small" onClick={handleCopyManualKey}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            )}
          </Box>
        );

      case 2:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <VerifiedUserIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Verify Setup
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Enter the 6-digit code from your authenticator app to complete setup
            </Typography>

            <TextField
              label="Verification Code"
              value={verificationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setVerificationCode(value);
              }}
              fullWidth
              placeholder="000000"
              inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '24px', letterSpacing: '8px' } }}
              sx={{ mb: 2 }}
            />

            <Alert severity="warning" sx={{ mt: 2 }}>
              Make sure to save your authenticator app backup! If you lose access to your app, you won't be able to
              log in.
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  if (loading && !enabled) {
    return (
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <SecurityIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Two-Factor Authentication
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Add an extra layer of security to your account
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" gutterBottom>
                  Status: {enabled ? 'Enabled' : 'Disabled'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {enabled
                    ? 'Your account is protected with two-factor authentication'
                    : 'Two-factor authentication is not enabled for your account'}
                </Typography>
              </Box>
              <Box>
                {enabled ? (
                  <Alert severity="success" icon={<VerifiedUserIcon />}>
                    Active
                  </Alert>
                ) : (
                  <Alert severity="warning">Inactive</Alert>
                )}
              </Box>
            </Box>

            {!enabled && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>What is 2FA?</strong>
                  <br />
                  Two-factor authentication (2FA) adds an extra layer of security to your account. Even if someone
                  knows your password, they won't be able to access your account without the code from your
                  authenticator app.
                </Typography>
              </Alert>
            )}

            {enabled && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Your account is now protected with 2FA. You'll need to enter a code from your authenticator app each
                  time you log in.
                </Typography>
              </Alert>
            )}
          </CardContent>

          <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
            {!enabled ? (
              <Button variant="contained" onClick={handleStartSetup} disabled={loading}>
                Enable 2FA
              </Button>
            ) : (
              <Button variant="outlined" color="error" onClick={() => setOpenDisableDialog(true)} disabled={loading}>
                Disable 2FA
              </Button>
            )}
          </CardActions>
        </Card>

        {/* How it Works Section */}
        {!enabled && (
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              How to Set Up 2FA
            </Typography>
            <Box component="ol" sx={{ pl: 2 }}>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                Download an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy,
                etc.)
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                Click "Enable 2FA" and scan the QR code with your authenticator app
              </Typography>
              <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                Enter the 6-digit code from your app to verify setup
              </Typography>
              <Typography component="li" variant="body2">
                From now on, you'll need both your password and a code from your app to log in
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Setup Dialog */}
        <Dialog open={openSetupDialog} onClose={handleCloseSetupDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
          <DialogContent>
            <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
              {setupSteps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {getStepContent(activeStep)}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseSetupDialog} disabled={loading}>
              Cancel
            </Button>
            {activeStep > 0 && (
              <Button onClick={handleBack} disabled={loading}>
                Back
              </Button>
            )}
            {activeStep < setupSteps.length - 1 ? (
              <Button onClick={handleNext} variant="contained" disabled={loading}>
                Next
              </Button>
            ) : (
              <Button
                onClick={handleVerify}
                variant="contained"
                disabled={loading || verificationCode.length !== 6}
              >
                Verify & Enable
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Disable Dialog */}
        <Dialog open={openDisableDialog} onClose={handleCloseDisableDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 3 }}>
              Disabling 2FA will make your account less secure. You'll only need your password to log in.
            </Alert>

            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Enter the 6-digit code from your authenticator app to confirm:
            </Typography>

            <TextField
              label="Verification Code"
              value={disableCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setDisableCode(value);
              }}
              fullWidth
              placeholder="000000"
              inputProps={{ maxLength: 6, style: { textAlign: 'center', fontSize: '24px', letterSpacing: '8px' } }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDisableDialog} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleDisable}
              variant="contained"
              color="error"
              disabled={loading || disableCode.length !== 6}
            >
              Disable 2FA
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};
