import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: { mode: 'light', primary: { main: '#1976d2' }, secondary: { main: '#dc004e' } },
  typography: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  components: { MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } } },
});
