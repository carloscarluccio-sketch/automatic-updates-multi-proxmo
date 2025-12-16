import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeProvider, createTheme, Theme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface BrandingContextType {
  branding: any;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: null,
  refreshBranding: async () => {},
});

export const useBranding = () => useContext(BrandingContext);

export const DynamicThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<any>(null);
  const [theme, setTheme] = useState<Theme>(createDefaultTheme());
  const user = useAuthStore((state) => state.user);

  const refreshBranding = async () => {
    try {
      const response = await api.get('/companies/branding');
      const brandingData = response.data.data;
      setBranding(brandingData);

      // Create comprehensive dynamic theme from branding
      const dynamicTheme = createTheme({
        palette: {
          mode: 'light',
          primary: {
            main: brandingData?.primary_color || brandingData?.header_color || '#1976d2',
          },
          secondary: {
            main: brandingData?.secondary_color || brandingData?.menu_color || '#dc004e',
          },
          background: {
            default: brandingData?.background_color || '#f5f5f5',
            paper: '#ffffff',
          },
          text: {
            primary: brandingData?.text_color || '#212121',
            secondary: '#666666',
          },
        },
        typography: {
          fontFamily: brandingData?.font_family || 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          h1: { fontWeight: 600 },
          h2: { fontWeight: 600 },
          h3: { fontWeight: 600 },
          h4: { fontWeight: 600 },
          h5: { fontWeight: 600 },
          h6: { fontWeight: 600 },
        },
        components: {
          // Global background
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundColor: brandingData?.background_color || '#f5f5f5',
                color: brandingData?.text_color || '#212121',
              },
            },
          },
          // Buttons
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                borderRadius: 8,
                fontWeight: 500,
              },
              containedPrimary: {
                backgroundColor: brandingData?.primary_color || brandingData?.header_color || '#1976d2',
                '&:hover': {
                  backgroundColor: adjustColor(brandingData?.primary_color || brandingData?.header_color || '#1976d2', -20),
                },
              },
              containedSecondary: {
                backgroundColor: brandingData?.secondary_color || '#dc004e',
                '&:hover': {
                  backgroundColor: adjustColor(brandingData?.secondary_color || '#dc004e', -20),
                },
              },
            },
          },
          // AppBar (Header)
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundColor: brandingData?.header_color || brandingData?.primary_color || '#1976d2',
                color: '#ffffff',
              },
            },
          },
          // Drawer (Sidebar/Menu)
          MuiDrawer: {
            styleOverrides: {
              paper: {
                backgroundColor: brandingData?.menu_color || '#424242',
                color: brandingData?.sidebar_text_color || '#ffffff',
                '& .MuiListItemIcon-root': {
                  color: brandingData?.sidebar_text_color || '#ffffff',
                },
                '& .MuiListItemText-primary': {
                  color: brandingData?.sidebar_text_color || '#ffffff',
                },
                '& .MuiListItemButton-root:hover': {
                  backgroundColor: adjustColor(brandingData?.menu_color || '#424242', 15),
                },
                '& .MuiListItemButton-root.Mui-selected': {
                  backgroundColor: adjustColor(brandingData?.menu_color || '#424242', 25),
                  '&:hover': {
                    backgroundColor: adjustColor(brandingData?.menu_color || '#424242', 30),
                  },
                },
              },
            },
          },
          // Cards
          MuiCard: {
            styleOverrides: {
              root: {
                backgroundColor: '#ffffff',
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              },
            },
          },
          // Paper (dialogs, menus, etc.)
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundColor: '#ffffff',
              },
              elevation1: {
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              },
              elevation2: {
                boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
              },
            },
          },
          // Table
          MuiTableHead: {
            styleOverrides: {
              root: {
                backgroundColor: brandingData?.background_color || '#f5f5f5',
                '& .MuiTableCell-head': {
                  fontWeight: 600,
                  color: brandingData?.text_color || '#212121',
                },
              },
            },
          },
          // Chip
          MuiChip: {
            styleOverrides: {
              colorPrimary: {
                backgroundColor: brandingData?.primary_color || '#1976d2',
                color: '#ffffff',
              },
              colorSecondary: {
                backgroundColor: brandingData?.secondary_color || '#dc004e',
                color: '#ffffff',
              },
            },
          },
          // Links
          MuiLink: {
            styleOverrides: {
              root: {
                color: brandingData?.primary_color || '#1976d2',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              },
            },
          },
          // Tabs
          MuiTabs: {
            styleOverrides: {
              indicator: {
                backgroundColor: brandingData?.primary_color || '#1976d2',
              },
            },
          },
          MuiTab: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 500,
                '&.Mui-selected': {
                  color: brandingData?.primary_color || '#1976d2',
                },
              },
            },
          },
          // TextField
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  '&.Mui-focused fieldset': {
                    borderColor: brandingData?.primary_color || '#1976d2',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: brandingData?.primary_color || '#1976d2',
                },
              },
            },
          },
          // Switch
          MuiSwitch: {
            styleOverrides: {
              switchBase: {
                '&.Mui-checked': {
                  color: brandingData?.primary_color || '#1976d2',
                  '& + .MuiSwitch-track': {
                    backgroundColor: brandingData?.primary_color || '#1976d2',
                  },
                },
              },
            },
          },
          // Checkbox
          MuiCheckbox: {
            styleOverrides: {
              root: {
                '&.Mui-checked': {
                  color: brandingData?.primary_color || '#1976d2',
                },
              },
            },
          },
          // Radio
          MuiRadio: {
            styleOverrides: {
              root: {
                '&.Mui-checked': {
                  color: brandingData?.primary_color || '#1976d2',
                },
              },
            },
          },
        },
      });

      setTheme(dynamicTheme);
    } catch (error) {
      console.error('Failed to load branding:', error);
      setTheme(createDefaultTheme());
    }
  };

  useEffect(() => {
    if (user) {
      refreshBranding();
    }
  }, [user]);

  return (
    <BrandingContext.Provider value={{ branding, refreshBranding }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </BrandingContext.Provider>
  );
};

function createDefaultTheme(): Theme {
  return createTheme({
    palette: {
      mode: 'light',
      primary: { main: '#1976d2' },
      secondary: { main: '#dc004e' },
      background: {
        default: '#f5f5f5',
        paper: '#ffffff',
      },
      text: {
        primary: '#212121',
        secondary: '#666666',
      },
    },
    typography: {
      fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontWeight: 600 },
      h2: { fontWeight: 600 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            fontWeight: 500,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          },
        },
      },
    },
  });
}

// Helper function to adjust color brightness
function adjustColor(color: string, amount: number): string {
  const clamp = (num: number) => Math.min(Math.max(num, 0), 255);

  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const newR = clamp(r + amount);
  const newG = clamp(g + amount);
  const newB = clamp(b + amount);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}
