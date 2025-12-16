import { createTheme } from '@mui/material/styles';

// Tu paleta de colores kawaii
const colorPalette = {
  color1: '#e6e6e6',  // Gris muy claro (fondo)
  color2: '#aae6d9',  // Verde agua pastel
  color3: '#c8cbc1',  // Gris verdoso suave
  color4: '#e6b0aa',  // Rosa pastel
  color5: '#a1a1a1',  // Gris medio
};

const theme = createTheme({
  palette: {
    primary: {
      main: colorPalette.color2,  // Verde agua como color principal
      light: '#d4f5ef',
      dark: '#7ab3a5',
      contrastText: '#2c3e50',
    },
    secondary: {
      main: colorPalette.color4,  // Rosa pastel como secundario
      light: '#f5d9d7',
      dark: '#b27a75',
      contrastText: '#2c3e50',
    },
    background: {
      default: colorPalette.color1,
      paper: '#ffffff',
    },
    text: {
      primary: '#2c3e50',
      secondary: '#5d6d7e',
    },
    success: {
      main: '#81c784',
    },
    warning: {
      main: '#ffb74d',
    },
    error: {
      main: '#e57373',
    },
    info: {
      main: '#64b5f6',
    },
  },
  typography: {
    fontFamily: [
      '"Nunito"',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1rem',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          textTransform: 'none',
          fontWeight: 600,
          padding: '8px 24px',
        },
        contained: {
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          '&:hover': {
            boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
          transition: 'transform 0.3s, box-shadow 0.3s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 28px rgba(0,0,0,0.1)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 16,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        },
      },
    },
  },
});

export default theme;