import React from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Container,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Button,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { estadisticasAPI } from '../../api/estadisticas';
import { useNavigate } from 'react-router-dom';

// Iconos
import { 
  AiOutlineProject,
  AiOutlineFileText,
  AiOutlineRocket,
  AiOutlineFilePdf,
  AiOutlineTeam,
  AiOutlineDashboard,
  AiOutlineCheckCircle,
  AiOutlineClockCircle,
  AiOutlineUser,
  AiOutlinePlus,
  AiOutlineReload,
  AiOutlineWarning,
} from 'react-icons/ai';
import { BiStats, BiUpload } from 'react-icons/bi';
import { RiShieldKeyholeLine } from 'react-icons/ri';
import { BsArrowRight } from 'react-icons/bs';

// Función para formatear números
const formatNumber = (num) => {
  if (num === null || num === undefined || num === '-') return '-';
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
};

// Función para formatear fecha
const formatFecha = (fechaString) => {
  if (!fechaString) return '';
  try {
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
};

// Datos por defecto para cuando falle la API
const defaultStats = {
  proyectos: {
    total: '-',
    activos: '-',
    inactivos: '-'
  },
  plantillas: {
    total: '-',
    activas: '-',
    inactivas: '-'
  },
  emisiones: {
    usuario: '-',
    documentos_generados: '-',
    documentos_hoy: '-'
  },
  proyectos_recientes: [],
  actividad_reciente: [],
  usuario: {
    nombre: 'Usuario',
    rol: 'usuario',
    ultimo_login: null
  }
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Obtener estadísticas REALES con manejo de errores
  const { 
    data: stats = defaultStats, 
    isLoading, 
    error,
    refetch,
    isError
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => estadisticasAPI.getDashboardStats(),
    retry: 1,
    retryDelay: 1000,
    staleTime: 30000, // 30 segundos
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Usar datos reales o por defecto
  const displayStats = isError ? defaultStats : stats;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      {/* Mostrar error si existe */}
      {isError && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => refetch()}
              startIcon={<AiOutlineReload />}
            >
              Reintentar
            </Button>
          }
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AiOutlineWarning />
            <Typography variant="body2">
              No se pudieron cargar todas las estadísticas. Mostrando información básica.
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Header del Dashboard */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #aae6d9, #e6b0aa)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(170, 230, 217, 0.3)',
            }}
          >
            <AiOutlineDashboard size={32} color="#ffffff" />
          </Box>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #aae6d9, #e6b0aa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Panel Principal
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {user?.nombre ? `Bienvenido, ${user.nombre}` : 'Bienvenido'}
              {displayStats?.usuario?.ultimo_login && ` • Último acceso: ${formatFecha(displayStats.usuario.ultimo_login)}`}
            </Typography>
          </Box>
          <Chip
            label={user?.rol === 'superadmin' ? '⚡ SuperAdmin' : 
                   user?.rol === 'admin' ? '🛡️ Admin' : '👤 Usuario'}
            sx={{ 
              ml: 'auto',
              bgcolor: user?.rol === 'superadmin' ? 'rgba(229, 115, 115, 0.1)' : 
                      user?.rol === 'admin' ? 'rgba(255, 183, 77, 0.1)' : 
                      'rgba(170, 230, 217, 0.1)',
              color: user?.rol === 'superadmin' ? '#e53935' : 
                     user?.rol === 'admin' ? '#f57c00' : 
                     '#7ab3a5',
              fontWeight: 600,
            }}
          />
        </Box>
      </Box>

      {/* Grid de Estadísticas PRINCIPALES - Siempre visibles */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Proyectos Totales */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              height: '100%',
              background: 'linear-gradient(135deg, #aae6d9, #7ab3a5)',
              color: '#ffffff',
              transition: 'transform 0.3s, box-shadow 0.3s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 28px rgba(119, 179, 165, 0.4)',
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="h3" fontWeight={700} sx={{ mb: 0.5 }}>
                  {formatNumber(displayStats?.proyectos?.total)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Proyectos Totales
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                  <Chip
                    label={`${formatNumber(displayStats?.proyectos?.activos)} activos`}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      height: 22,
                    }}
                  />
                </Box>
              </Box>
              <AiOutlineProject size={40} opacity={0.9} />
            </Box>
          </Paper>
        </Grid>
        
        {/* Plantillas */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              height: '100%',
              background: 'linear-gradient(135deg, #e6b0aa, #b27a75)',
              color: '#ffffff',
              transition: 'transform 0.3s, box-shadow 0.3s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 28px rgba(178, 122, 117, 0.4)',
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="h3" fontWeight={700} sx={{ mb: 0.5 }}>
                  {formatNumber(displayStats?.plantillas?.total)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Plantillas
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                  <Chip
                    label={`${formatNumber(displayStats?.plantillas?.activas)} activas`}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      height: 22,
                    }}
                  />
                </Box>
              </Box>
              <AiOutlineFileText size={40} opacity={0.9} />
            </Box>
          </Paper>
        </Grid>
        
        {/* Emisiones del Usuario */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              height: '100%',
              background: 'linear-gradient(135deg, #c8cbc1, #9a9d94)',
              color: '#ffffff',
              transition: 'transform 0.3s, box-shadow 0.3s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 28px rgba(154, 157, 148, 0.4)',
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="h3" fontWeight={700} sx={{ mb: 0.5 }}>
                  {formatNumber(displayStats?.emisiones?.usuario)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Tus Emisiones
                </Typography>
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>
                    Sesiones de procesamiento
                  </Typography>
                </Box>
              </Box>
              <BiUpload size={40} opacity={0.9} />
            </Box>
          </Paper>
        </Grid>
        
        {/* Documentos Generados */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              height: '100%',
              background: 'linear-gradient(135deg, #a1a1a1, #7a7a7a)',
              color: '#ffffff',
              transition: 'transform 0.3s, box-shadow 0.3s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 28px rgba(122, 122, 122, 0.4)',
              },
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="h3" fontWeight={700} sx={{ mb: 0.5 }}>
                  {formatNumber(displayStats?.emisiones?.documentos_generados)}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Documentos Generados
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                  <AiOutlineFilePdf size={16} />
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {formatNumber(displayStats?.emisiones?.documentos_hoy)} hoy
                  </Typography>
                </Box>
              </Box>
              <AiOutlineFilePdf size={40} opacity={0.9} />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Sección Inferior - Proyectos Recientes y Actividad */}
      <Grid container spacing={3}>
        {/* Proyectos Recientes */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              height: '100%',
              background: '#ffffff',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <AiOutlineProject size={24} color="#7ab3a5" style={{ marginRight: 12 }} />
              <Typography variant="h6" fontWeight={600}>
                Proyectos Recientes
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {displayStats?.proyectos_recientes?.length || 0} proyectos
              </Typography>
            </Box>
            
            {displayStats?.proyectos_recientes?.length > 0 ? (
              <List sx={{ p: 0 }}>
                {displayStats.proyectos_recientes.map((proyecto, index) => (
                  <React.Fragment key={proyecto.id || index}>
                    <ListItem 
                      sx={{ 
                        px: 0, 
                        py: 1.5,
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'rgba(170, 230, 217, 0.05)',
                          borderRadius: 2,
                        }
                      }}
                      onClick={() => proyecto.id && navigate(`/proyectos/${proyecto.id}`)}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: proyecto.activo ? 'rgba(170, 230, 217, 0.2)' : 'rgba(161, 161, 161, 0.2)',
                            color: proyecto.activo ? '#7ab3a5' : '#a1a1a1',
                            fontSize: '1rem',
                            fontWeight: 600,
                          }}
                        >
                          {proyecto.nombre?.charAt(0).toUpperCase() || 'P'}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" fontWeight={600}>
                            {proyecto.nombre || 'Proyecto'}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                            <Chip
                              label={proyecto.activo ? 'Activo' : 'Inactivo'}
                              size="small"
                              sx={{
                                bgcolor: proyecto.activo ? 'rgba(129, 199, 132, 0.1)' : 'rgba(161, 161, 161, 0.1)',
                                color: proyecto.activo ? '#2e7d32' : '#616161',
                                height: 20,
                                fontSize: '0.7rem',
                              }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {proyecto.plantillas || 0} plantillas
                            </Typography>
                            {proyecto.fecha_creacion && (
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                {formatFecha(proyecto.fecha_creacion)}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      {proyecto.id && <BsArrowRight size={16} color="#a1a1a1" />}
                    </ListItem>
                    {index < displayStats.proyectos_recientes.length - 1 && (
                      <Divider sx={{ my: 1, opacity: 0.1 }} />
                    )}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <AiOutlineProject size={48} color="#e6e6e6" />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No hay proyectos recientes
                </Typography>
              </Box>
            )}
            
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(0, 0, 0, 0.05)' }}>
              <Typography 
                variant="button" 
                sx={{ 
                  color: 'primary.main', 
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' }
                }}
                onClick={() => navigate('/proyectos')}
              >
                Ver todos los proyectos →
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Actividad Reciente */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              height: '100%',
              background: '#ffffff',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <AiOutlineClockCircle size={24} color="#b27a75" style={{ marginRight: 12 }} />
              <Typography variant="h6" fontWeight={600}>
                Tu Actividad Reciente
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                Últimas acciones
              </Typography>
            </Box>
            
            {displayStats?.actividad_reciente?.length > 0 ? (
              <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
                {displayStats.actividad_reciente.map((actividad, index) => (
                  <React.Fragment key={index}>
                    <ListItem sx={{ px: 0, py: 1.5 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: actividad.accion === 'login' ? 'rgba(170, 230, 217, 0.2)' :
                                     actividad.accion === 'crear' ? 'rgba(129, 199, 132, 0.2)' :
                                     'rgba(255, 183, 77, 0.2)',
                            color: actividad.accion === 'login' ? '#7ab3a5' :
                                   actividad.accion === 'crear' ? '#2e7d32' :
                                   '#f57c00',
                          }}
                        >
                          {actividad.accion === 'login' && <AiOutlineUser size={16} />}
                          {actividad.accion === 'crear' && <AiOutlinePlus size={16} />}
                          {actividad.accion === 'cargar_csv' && <BiUpload size={16} />}
                          {!['login', 'crear', 'cargar_csv'].includes(actividad.accion) && 
                           <AiOutlineCheckCircle size={16} />}
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2">
                            {actividad.accion === 'login' && 'Inició sesión'}
                            {actividad.accion === 'logout' && 'Cerró sesión'}
                            {actividad.accion === 'crear' && 'Creó ' + (actividad.modulo || 'algo')}
                            {actividad.accion === 'cargar_csv' && 'Cargó archivo CSV'}
                            {!['login', 'logout', 'crear', 'cargar_csv'].includes(actividad.accion) && 
                             `${actividad.accion || 'Acción'} ${actividad.modulo || ''}`}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {formatFecha(actividad.fecha)}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < displayStats.actividad_reciente.length - 1 && (
                      <Divider sx={{ my: 1, opacity: 0.1 }} />
                    )}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <AiOutlineClockCircle size={48} color="#e6e6e6" />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No hay actividad reciente
                </Typography>
              </Box>
            )}
            
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(0, 0, 0, 0.05)' }}>
              <Typography variant="caption" color="text.secondary">
                Sistema de correspondencia • {new Date().getFullYear()}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Guía Rápida - Siempre visible */}
      <Paper sx={{ p: 3, mt: 4, borderRadius: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#7ab3a5' }}>
          ¿Cómo empezar?
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
              <Box sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                bgcolor: 'rgba(170, 230, 217, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AiOutlineProject size={20} color="#7ab3a5" />
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>1. Crear Proyecto</Typography>
                <Typography variant="caption" color="text.secondary">
                  Ve a "Proyectos" para crear uno nuevo
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
              <Box sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                bgcolor: 'rgba(230, 176, 170, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AiOutlineFileText size={20} color="#b27a75" />
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>2. Diseñar Plantilla</Typography>
                <Typography variant="caption" color="text.secondary">
                  Sube un PDF base y añade campos dinámicos
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
              <Box sx={{ 
                width: 40, 
                height: 40, 
                borderRadius: '50%', 
                bgcolor: 'rgba(200, 203, 193, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BiStats size={20} color="#9a9d94" />
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={600}>3. Generar Documentos</Typography>
                <Typography variant="caption" color="text.secondary">
                  Sube CSV y genera documentos personalizados
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default Dashboard;