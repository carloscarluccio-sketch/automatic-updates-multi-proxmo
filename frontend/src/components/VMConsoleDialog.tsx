/**
 * VM Console Dialog Component
 *
 * Provides an embedded noVNC console viewer within the application
 * using the backend WebSocket proxy to hide Proxmox cluster IPs.
 *
 * Features:
 * - Embedded console (no popup windows)
 * - Full-screen mode
 * - Clipboard support
 * - Keyboard shortcuts
 * - Connection status indicator
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Toolbar,
  Tooltip,
  Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { VM } from '../services/vmsService';

// Import noVNC RFB client
// @ts-ignore - noVNC doesn't have TypeScript definitions
import RFB from '@novnc/novnc/lib/rfb.js';

interface VMConsoleDialogProps {
  open: boolean;
  onClose: () => void;
  vm: VM | null;
}

export const VMConsoleDialog: React.FC<VMConsoleDialogProps> = ({ open, onClose, vm }) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [fullscreen, setFullscreen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<any>(null);
  const isConnectingRef = useRef(false);

  useEffect(() => {
    if (!open || !vm) {
      // Disconnect if dialog closes
      if (rfbRef.current) {
        console.log('[CONSOLE] Cleaning up connection');
        rfbRef.current.disconnect();
        rfbRef.current = null;
      }
      isConnectingRef.current = false;
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      console.log('[CONSOLE] ⏭️ Skipping - already connecting');
      return;
    }

    // Wait for canvas element to be ready in the DOM
    console.log('[CONSOLE] useEffect triggered - waiting for canvas ref');
    const initTimer = setTimeout(() => {
      console.log('[CONSOLE] Timer fired - attempting init console');
      initConsole();
    }, 100);

    return () => {
      clearTimeout(initTimer);
      if (rfbRef.current) {
        console.log('[CONSOLE] Cleanup function - disconnecting');
        rfbRef.current.disconnect();
        rfbRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, [open, vm]);

  const initConsole = async () => {
    console.log('[CONSOLE] 🚀 initConsole called');
    console.log('[CONSOLE] canvasRef.current:', !!canvasRef.current);
    console.log('[CONSOLE] vm:', vm);
    console.log('[CONSOLE] isConnectingRef.current:', isConnectingRef.current);

    if (!canvasRef.current) {
      console.error('[CONSOLE] ❌ No canvas ref!');
      return;
    }

    if (!vm) {
      console.error('[CONSOLE] ❌ No VM!');
      return;
    }

    if (isConnectingRef.current) {
      console.log('[CONSOLE] ⏭️ Already connecting, skipping');
      return;
    }

    try {
      isConnectingRef.current = true;
      console.log('[CONSOLE] Setting status to connecting...');
      setStatus('connecting');
      setErrorMessage('');

      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      console.log('[CONSOLE] Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'NULL');

      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Build WebSocket URL to our proxy (nginx will forward to backend)
      // IMPORTANT: Use wss: for HTTPS pages, ws: for HTTP pages (noVNC requires TLS in secure context)
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.hostname;
      // Use same port as the page (80/443) - nginx proxies to backend
      const wsPort = window.location.port ? `:${window.location.port}` : '';
      const wsUrl = `${wsProtocol}//${wsHost}${wsPort}/console-proxy?vmId=${vm.id}&token=${token}`;

      console.log('[CONSOLE] 📊 Connection Details:');
      console.log('[CONSOLE]   VM ID:', vm.id);
      console.log('[CONSOLE]   VM Name:', vm.name);
      console.log('[CONSOLE]   Token exists:', !!token);
      console.log('[CONSOLE]   Token length:', token?.length);
      console.log('[CONSOLE]   WebSocket URL:', wsUrl);
      console.log('[CONSOLE]   Protocol:', wsProtocol);
      console.log('[CONSOLE]   Host:', wsHost);
      console.log('[CONSOLE]   Port:', wsPort || '(default)');

      // Create RFB (Remote Frame Buffer) connection
      // Note: Proxmox uses VNC None authentication (type 1) when ticket is in WebSocket URL
      console.log('[CONSOLE] 🔧 Creating RFB instance with wsUrl:', wsUrl);
      console.log('[CONSOLE] 🔧 Canvas ref:', canvasRef.current);
      console.log('[CONSOLE] 🔧 RFB options:', { shared: true, wsProtocols: ['binary'] });

      const rfb = new RFB(canvasRef.current, wsUrl, {
        shared: true,
        wsProtocols: ['binary']
      });

      console.log('[CONSOLE] 🔧 RFB instance created:', rfb);
      console.log('[CONSOLE] 🔧 RFB internal socket:', (rfb as any)._sock);

      // Store RFB instance for cleanup
      rfbRef.current = rfb;

      // Store VNC ticket received from backend
      let vncTicket: string | null = null;

      // Listen for VNC ticket from backend proxy
      const ws = (rfb as any)._sock?._websocket;
      if (ws) {
        const originalOnMessage = ws.onmessage;
        ws.onmessage = (event: MessageEvent) => {
          try {
            // Check if this is a JSON message with VNC ticket
            const data = JSON.parse(event.data);
            if (data.type === 'vnc-ticket') {
              console.log('[CONSOLE] 🎫 Received VNC ticket from backend');
              vncTicket = data.ticket;
              return; // Don't pass this to noVNC
            }
          } catch (e) {
            // Not JSON, pass through to noVNC
          }
          // Pass other messages to noVNC
          if (originalOnMessage) {
            originalOnMessage.call(ws, event);
          }
        };
      }

      // Event handlers
      rfb.addEventListener('connect', () => {
        console.log('[CONSOLE] ✅ Connected successfully');
        isConnectingRef.current = false;
        setStatus('connected');
        setErrorMessage('');
      });

      rfb.addEventListener('disconnect', (e: any) => {
        console.log('[CONSOLE] ❌ Disconnected:', e.detail);
        isConnectingRef.current = false;
        setStatus('disconnected');
        if (e.detail.clean) {
          setErrorMessage('Connection closed');
        } else {
          setErrorMessage(`Connection lost: ${e.detail?.reason || 'Unknown reason'}`);
        }
      });

      rfb.addEventListener('credentialsrequired', () => {
        console.log('[CONSOLE] 🔐 Credentials required');
        if (vncTicket) {
          console.log('[CONSOLE] 🎫 Using VNC ticket as password');
          rfb.sendCredentials({ password: vncTicket });
        } else {
          console.log('[CONSOLE] ⚠️ No VNC ticket received yet, trying empty password');
          rfb.sendCredentials({ password: '' });
        }
      });

      rfb.addEventListener('securityfailure', (e: any) => {
        console.error('[CONSOLE] 🚨 Security failure:', e.detail);
        isConnectingRef.current = false;
        setErrorMessage(`Security failure: ${e.detail.status}`);
        setStatus('error');
      });

      rfb.addEventListener('bell', () => {
        console.log('[CONSOLE] 🔔 Bell received');
      });

      rfb.addEventListener('clipboard', (e: any) => {
        console.log('[CONSOLE] 📋 Clipboard:', e.detail.text);
      });

      // Set display settings
      rfb.scaleViewport = true;
      rfb.resizeSession = true;
      rfb.clipViewport = false;
      rfb.dragViewport = false;

      rfbRef.current = rfb;

    } catch (error: any) {
      console.error('[CONSOLE] ❌ Connection error:', error);
      console.error('[CONSOLE] ❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      isConnectingRef.current = false;
      setErrorMessage(error.message || 'Failed to connect to console');
      setStatus('error');
    }
  };

  const handleFullscreen = () => {
    if (!fullscreen) {
      canvasRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  const handleSendKeys = (keys: string[]) => {
    if (rfbRef.current) {
      // Send Ctrl+Alt+Del or other key combinations
      keys.forEach(key => {
        rfbRef.current.sendKey(key);
      });
    }
  };

  const handleClipboardCopy = () => {
    if (rfbRef.current) {
      // Get clipboard from remote
      const text = rfbRef.current.clipboardPasteFrom;
      if (text) {
        navigator.clipboard.writeText(text);
      }
    }
  };

  const handleClipboardPaste = async () => {
    if (rfbRef.current) {
      try {
        const text = await navigator.clipboard.readText();
        rfbRef.current.clipboardPasteFrom = text;
      } catch (error) {
        console.error('Failed to read clipboard:', error);
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      fullScreen={fullscreen}
      PaperProps={{
        sx: {
          height: fullscreen ? '100vh' : '90vh',
          m: fullscreen ? 0 : 2
        }
      }}
    >
      <DialogTitle sx={{ p: 1 }}>
        <Toolbar variant="dense" sx={{ px: 1 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Console: {vm?.name} (VMID: {vm?.vmid})
          </Typography>

          {/* Status indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            {status === 'connecting' && (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                <Typography variant="body2">Connecting...</Typography>
              </>
            )}
            {status === 'connected' && (
              <Typography variant="body2" color="success.main">
                ● Connected
              </Typography>
            )}
            {status === 'disconnected' && (
              <Typography variant="body2" color="warning.main">
                ● Disconnected
              </Typography>
            )}
            {status === 'error' && (
              <Typography variant="body2" color="error.main">
                ● Error
              </Typography>
            )}
          </Box>

          {/* Toolbar buttons */}
          {status === 'connected' && (
            <>
              <Tooltip title="Send Ctrl+Alt+Del">
                <IconButton
                  size="small"
                  onClick={() => handleSendKeys(['ControlLeft', 'AltLeft', 'Delete'])}
                >
                  <KeyboardIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Copy from VM">
                <IconButton size="small" onClick={handleClipboardCopy}>
                  <ContentCopyIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Paste to VM">
                <IconButton size="small" onClick={handleClipboardPaste}>
                  <ContentPasteIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                <IconButton size="small" onClick={handleFullscreen}>
                  {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              </Tooltip>
            </>
          )}

          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </DialogTitle>

      <DialogContent sx={{ p: 0, overflow: 'hidden', bgcolor: '#000' }}>
        {errorMessage && (
          <Alert severity="error" sx={{ m: 2 }}>
            {errorMessage}
            <Button size="small" onClick={initConsole} sx={{ ml: 2 }}>
              Retry
            </Button>
          </Alert>
        )}

        <Box
          ref={canvasRef}
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#000'
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

export default VMConsoleDialog;
