import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { AiOutlineMenu, AiOutlineBell, AiOutlineSearch } from 'react-icons/ai';
import { useAuth } from '../../context/AuthContext';

const Header = ({ onMenuClick }) => {
  const location = useLocation();
  const { user } = useAuth();

  // Convertir path a breadcrumbs
  const pathnames = location.pathname.split('/').filter((x) => x);
  
  const getBreadcrumbName = (path) => {
    const map = {
      'dashboard': 'Dashboard',
      'proyectos': 'Proyectos',
      'plantillas': 'Plantillas',
      'procesamiento': 'Procesamiento',
      'usuarios': 'Usuarios',
      'configuracion': 'Configuración',
    };
    return map[path] || path.charAt(0).toUpperCase() + path.slice(1);
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { sm: `calc(100% - 280px)` },
        ml: { sm: `280px` },
        bgcolor: 'background.paper',
        borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
        {/* Botón menú (solo móvil) */}
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { sm: 'none' }, color: 'text.primary' }}
        >
          <AiOutlineMenu />
        </IconButton>

        {/* Breadcrumbs */}
        <Box sx={{ flexGrow: 1 }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              component={RouterLink}
              to="/dashboard"
              underline="hover"
              color="text.secondary"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              Inicio
            </Link>
            {pathnames.map((value, index) => {
              const last = index === pathnames.length - 1;
              const to = `/${pathnames.slice(0, index + 1).join('/')}`;

              return last ? (
                <Typography key={to} color="text.primary" fontWeight={600}>
                  {getBreadcrumbName(value)}
                </Typography>
              ) : (
                <Link
                  component={RouterLink}
                  to={to}
                  key={to}
                  underline="hover"
                  color="text.secondary"
                >
                  {getBreadcrumbName(value)}
                </Link>
              );
            })}
          </Breadcrumbs>
        </Box>

        {/* Acciones del header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': { bgcolor: 'rgba(170, 230, 217, 0.1)' },
            }}
          >
            <AiOutlineSearch />
          </IconButton>
          
          <IconButton
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': { bgcolor: 'rgba(170, 230, 217, 0.1)' },
            }}
          >
            <AiOutlineBell />
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: 'secondary.main',
              }}
            />
          </IconButton>

          {/* Indicador de rol */}
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              px: 2,
              py: 1,
              borderRadius: 2,
              bgcolor: user?.rol === 'superadmin' ? 'rgba(229, 115, 115, 0.1)' : 
                       user?.rol === 'admin' ? 'rgba(255, 183, 77, 0.1)' : 
                       'rgba(170, 230, 217, 0.1)',
              ml: 1,
            }}
          >
            <Typography variant="caption" fontWeight={600}>
              {user?.rol === 'superadmin' ? '⚡ SuperAdmin' : 
               user?.rol === 'admin' ? '🛡️ Admin' : '👤 Usuario'}
            </Typography>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;