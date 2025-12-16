import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Avatar,
  Badge,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  AiOutlineDashboard,
  AiOutlineProject,
  AiOutlineFileText,
  AiOutlineUser,
  AiOutlineSetting,
  AiOutlineLogout,
  AiOutlineTeam,
} from 'react-icons/ai';
import { BiStats } from 'react-icons/bi';
import { RiShieldKeyholeLine } from 'react-icons/ri';

const drawerWidth = 280;

const menuItems = [
  { text: 'Dashboard', icon: <AiOutlineDashboard />, path: '/dashboard' },
  { text: 'Proyectos', icon: <AiOutlineProject />, path: '/proyectos' },
  { text: 'Plantillas', icon: <AiOutlineFileText />, path: '/plantillas' },
  { text: 'Procesamiento', icon: <BiStats />, path: '/procesamiento' },
];

const adminMenuItems = [
  { text: 'Usuarios', icon: <AiOutlineTeam />, path: '/usuarios' },
  { text: 'Configuración', icon: <AiOutlineSetting />, path: '/configuracion' },
];

const Sidebar = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();

  const handleNavigation = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid rgba(0, 0, 0, 0.08)',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)',
          boxShadow: '2px 0 20px rgba(0, 0, 0, 0.05)',
        },
      }}
    >
      {/* Header del sidebar */}
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Box
          sx={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #aae6d9, #e6b0aa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(170, 230, 217, 0.3)',
          }}
        >
          <RiShieldKeyholeLine size={32} color="#ffffff" />
        </Box>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            background: 'linear-gradient(135deg, #aae6d9, #e6b0aa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Correspondencia Web
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Sistema de documentos
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgba(0, 0, 0, 0.05)' }} />

      {/* Perfil del usuario */}
      <Box sx={{ p: 2, mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderRadius: 2, bgcolor: 'rgba(170, 230, 217, 0.1)' }}>
          <Avatar
            sx={{
              width: 48,
              height: 48,
              mr: 2,
              bgcolor: 'primary.main',
              border: '2px solid #ffffff',
              boxShadow: '0 4px 12px rgba(170, 230, 217, 0.3)',
            }}
          >
            {user?.nombre?.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {user?.nombre}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <Badge
                variant="dot"
                color={user?.rol === 'superadmin' ? 'error' : user?.rol === 'admin' ? 'warning' : 'success'}
                sx={{ mr: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {user?.rol === 'superadmin' ? 'Super Administrador' : 
                 user?.rol === 'admin' ? 'Administrador' : 'Usuario'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Menú principal */}
      <List sx={{ p: 2 }}>
        {menuItems.map((item) => (
          <ListItem
            key={item.text}
            button
            onClick={() => handleNavigation(item.path)}
            sx={{
              mb: 1,
              borderRadius: 2,
              bgcolor: location.pathname === item.path ? 'rgba(170, 230, 217, 0.2)' : 'transparent',
              '&:hover': {
                bgcolor: 'rgba(170, 230, 217, 0.1)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: location.pathname === item.path ? 'primary.main' : 'text.secondary' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.text}
              primaryTypographyProps={{
                fontWeight: location.pathname === item.path ? 600 : 400,
                color: location.pathname === item.path ? 'primary.main' : 'text.primary',
              }}
            />
          </ListItem>
        ))}
      </List>

      {/* Menú de administración (solo para admins) */}
      {isAdmin && (
        <>
          <Divider sx={{ mx: 2, my: 1, borderColor: 'rgba(0, 0, 0, 0.05)' }} />
          <Typography variant="caption" sx={{ px: 3, py: 1, color: 'text.secondary' }}>
            Administración
          </Typography>
          <List sx={{ p: 2 }}>
            {adminMenuItems.map((item) => (
              <ListItem
                key={item.text}
                button
                onClick={() => handleNavigation(item.path)}
                sx={{
                  mb: 1,
                  borderRadius: 2,
                  bgcolor: location.pathname === item.path ? 'rgba(170, 230, 217, 0.2)' : 'transparent',
                  '&:hover': {
                    bgcolor: 'rgba(170, 230, 217, 0.1)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: location.pathname === item.path ? 'primary.main' : 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: location.pathname === item.path ? 600 : 400,
                    color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                  }}
                />
              </ListItem>
            ))}
          </List>
        </>
      )}

      {/* Espacio flexible */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Cerrar sesión */}
      <List sx={{ p: 2 }}>
        <ListItem
          button
          onClick={logout}
          sx={{
            borderRadius: 2,
            '&:hover': {
              bgcolor: 'rgba(230, 176, 170, 0.1)',
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: 'secondary.main' }}>
            <AiOutlineLogout />
          </ListItemIcon>
          <ListItemText
            primary="Cerrar Sesión"
            primaryTypographyProps={{ color: 'secondary.main', fontWeight: 500 }}
          />
        </ListItem>
      </List>

      {/* Footer del sidebar */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          v1.0.0 • Ambiente local
        </Typography>
      </Box>
    </Drawer>
  );
};

export default Sidebar;