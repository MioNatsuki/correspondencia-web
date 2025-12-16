import React, { useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Chip,
  Button,
  Tabs,
  Tab,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Breadcrumbs,
  Link,
  Alert,
  LinearProgress,
} from '@mui/material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { proyectosAPI } from '../../api/proyectos';
import CustomButton from '../../components/ui/CustomButton';
import Swal from 'sweetalert2';

// Iconos
import {
  AiOutlineArrowLeft,
  AiOutlineEdit,
  AiOutlineDelete,
  AiOutlineProject,
  AiOutlineFileText,
  AiOutlineTeam,
  AiOutlineSetting,
  AiOutlineHistory,
  AiOutlineBarChart,
  AiOutlineFolderOpen,
} from 'react-icons/ai';
import { BiStats, BiUpload } from 'react-icons/bi';
import { RiShieldKeyholeLine } from 'react-icons/ri';
import { BsArrowRight, BsThreeDotsVertical } from 'react-icons/bs';

const DetalleProyecto = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  
  // Obtener detalles del proyecto
  const { data: proyecto, isLoading, error } = useQuery({
    queryKey: ['proyecto', id],
    queryFn: () => proyectosAPI.getProyecto(id),
  });
  
  // Obtener estadísticas del proyecto
  const { data: estadisticas } = useQuery({
    queryKey: ['proyecto-estadisticas', id],
    queryFn: () => proyectosAPI.getEstadisticas(id),
    enabled: !!proyecto,
  });
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (error || !proyecto) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert 
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/proyectos')}>
              Volver
            </Button>
          }
        >
          Error cargando proyecto: {error?.message || 'Proyecto no encontrado'}
        </Alert>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link component={RouterLink} to="/proyectos" underline="hover" color="inherit">
          Proyectos
        </Link>
        <Typography color="text.primary">{proyecto.nombre}</Typography>
      </Breadcrumbs>
      
      {/* Header del proyecto */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
          {/* Logo/avatar */}
          <Avatar
            src={proyecto.logo}
            sx={{
              width: 100,
              height: 100,
              bgcolor: 'linear-gradient(135deg, #aae6d9, #e6b0aa)',
              border: '3px solid #ffffff',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
            }}
          >
            {proyecto.nombre.charAt(0).toUpperCase()}
          </Avatar>
          
          {/* Información */}
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h4" fontWeight={700}>
                {proyecto.nombre}
              </Typography>
              <Chip
                label={proyecto.activo ? 'Activo' : 'Inactivo'}
                color={proyecto.activo ? 'success' : 'default'}
                size="small"
                sx={{ 
                  bgcolor: proyecto.activo ? 'rgba(129, 199, 132, 0.2)' : 'rgba(161, 161, 161, 0.2)',
                  color: proyecto.activo ? '#2e7d32' : '#616161',
                  fontWeight: 600,
                }}
              />
              {proyecto.is_deleted && (
                <Chip
                  label="Eliminado"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(230, 176, 170, 0.2)',
                    color: '#b27a75',
                    fontWeight: 500,
                  }}
                />
              )}
            </Box>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {proyecto.descripcion || 'Sin descripción'}
            </Typography>
            
            {/* Información adicional */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AiOutlineFileText size={16} color="#a1a1a1" />
                  <Typography variant="body2">
                    <strong>Plantillas:</strong> {estadisticas?.plantillas?.total || 0} totales
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AiOutlineTeam size={16} color="#a1a1a1" />
                  <Typography variant="body2">
                    <strong>Padrón:</strong> {proyecto.padron_info?.nombre_tabla || 'No asignado'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Creado:</strong> {new Date(proyecto.fecha_creacion).toLocaleDateString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </Typography>
                {estadisticas?.ultima_actualizacion && (
                  <Typography variant="body2" color="text.secondary">
                    <strong>Última actualización:</strong> {new Date(estadisticas.ultima_actualizacion).toLocaleDateString('es-MX')}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Box>
          
          {/* Acciones */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 120 }}>
            <CustomButton
              size="small"
              icon="view"
              variant="outlined"
              onClick={() => navigate(`/plantillas?proyecto=${id}`)}
              fullWidth
            >
              Ver Plantillas
            </CustomButton>
            
            {isAdmin && !proyecto.is_deleted && (
              <>
                <CustomButton
                  size="small"
                  icon="edit"
                  variant="outlined"
                  onClick={() => navigate(`/proyectos/editar/${id}`)}
                  fullWidth
                >
                  Editar
                </CustomButton>
                
                <CustomButton
                  size="small"
                  icon="delete"
                  color="secondary"
                  onClick={() => {
                    Swal.fire({
                      title: '¿Eliminar proyecto?',
                      text: `¿Estás seguro de eliminar "${proyecto.nombre}"?`,
                      icon: 'warning',
                      showCancelButton: true,
                      confirmButtonText: 'Sí, eliminar',
                      cancelButtonText: 'Cancelar',
                      confirmButtonColor: '#e6b0aa',
                      cancelButtonColor: '#aae6d9',
                    }).then((result) => {
                      if (result.isConfirmed) {
                        proyectosAPI.deleteProyecto(id)
                          .then(() => {
                            Swal.fire(
                              '¡Eliminado!',
                              'El proyecto ha sido eliminado.',
                              'success'
                            ).then(() => navigate('/proyectos'));
                          })
                          .catch((error) => {
                            Swal.fire(
                              'Error',
                              error.response?.data?.detail || 'Error al eliminar',
                              'error'
                            );
                          });
                      }
                    });
                  }}
                  fullWidth
                >
                  Eliminar
                </CustomButton>
              </>
            )}
          </Box>
        </Box>
      </Paper>
      
      {/* Tabs de contenido */}
      <Paper sx={{ mb: 3, borderRadius: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{
            '& .MuiTab-root': {
              fontWeight: 600,
              textTransform: 'none',
            },
          }}
        >
          <Tab 
            icon={<AiOutlineBarChart style={{ marginRight: 8 }} />} 
            iconPosition="start" 
            label="Resumen" 
          />
          <Tab 
            icon={<AiOutlineFileText style={{ marginRight: 8 }} />} 
            iconPosition="start" 
            label="Plantillas" 
          />
          <Tab 
            icon={<AiOutlineSetting style={{ marginRight: 8 }} />} 
            iconPosition="start" 
            label="Configuración" 
          />
          {isAdmin && (
            <Tab 
              icon={<AiOutlineHistory style={{ marginRight: 8 }} />} 
              iconPosition="start" 
              label="Actividad" 
            />
          )}
        </Tabs>
      </Paper>
      
      {/* Contenido de las tabs */}
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        {tabValue === 0 && (
          // Tab Resumen
          <Box>
            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#7ab3a5', mb: 3 }}>
              Resumen del Proyecto
            </Typography>
            
            {estadisticas ? (
              <Grid container spacing={3}>
                {/* Estadísticas */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(170, 230, 217, 0.05)' }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: '#7ab3a5' }}>
                      Plantillas
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h3" fontWeight={700} color="primary.main">
                            {estadisticas.plantillas?.total || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Total
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h3" fontWeight={700} color="success.main">
                            {estadisticas.plantillas?.activas || 0}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Activas
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                    <LinearProgress 
                      variant="determinate" 
                      value={((estadisticas.plantillas?.activas || 0) / (estadisticas.plantillas?.total || 1)) * 100}
                      sx={{ mt: 2, height: 8, borderRadius: 4 }}
                    />
                  </Paper>
                </Grid>
                
                {/* Información del padrón */}
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(230, 176, 170, 0.05)' }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: '#b27a75' }}>
                      Padrón Asociado
                    </Typography>
                    {proyecto.padron_info ? (
                      <Box>
                        <Typography variant="body1" fontWeight={600}>
                          {proyecto.padron_info.nombre_tabla}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {proyecto.padron_info.descripcion || 'Sin descripción'}
                        </Typography>
                        <Chip
                          label={proyecto.padron_info.activo ? 'Activo' : 'Inactivo'}
                          size="small"
                          sx={{ 
                            mt: 2,
                            bgcolor: proyecto.padron_info.activo ? 'rgba(129, 199, 132, 0.2)' : 'rgba(161, 161, 161, 0.2)',
                            color: proyecto.padron_info.activo ? '#2e7d32' : '#616161',
                          }}
                        />
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        No hay padrón asociado
                      </Typography>
                    )}
                  </Paper>
                </Grid>
                
                {/* Acciones rápidas */}
                <Grid item xs={12}>
                  <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(200, 203, 193, 0.05)' }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: '#9a9d94' }}>
                      Acciones Rápidas
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<AiOutlineFileText />}
                          onClick={() => navigate(`/plantillas?proyecto=${id}`)}
                          sx={{
                            bgcolor: '#aae6d9',
                            '&:hover': { bgcolor: '#7ab3a5' },
                            borderRadius: 2,
                            py: 1.5,
                          }}
                        >
                          Ver Plantillas
                        </Button>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<AiOutlinePlus />}
                          onClick={() => navigate(`/plantillas/nueva?proyecto=${id}`)}
                          sx={{
                            bgcolor: '#e6b0aa',
                            '&:hover': { bgcolor: '#b27a75' },
                            borderRadius: 2,
                            py: 1.5,
                          }}
                        >
                          Nueva Plantilla
                        </Button>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Button
                          fullWidth
                          variant="contained"
                          startIcon={<BiUpload />}
                          onClick={() => navigate(`/procesamiento?proyecto=${id}`)}
                          sx={{
                            bgcolor: '#c8cbc1',
                            '&:hover': { bgcolor: '#9a9d94' },
                            borderRadius: 2,
                            py: 1.5,
                          }}
                        >
                          Procesar CSV
                        </Button>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              </Grid>
            ) : (
              <Alert severity="info">
                Cargando estadísticas del proyecto...
              </Alert>
            )}
          </Box>
        )}
        
        {tabValue === 1 && (
          // Tab Plantillas
          <Box>
            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#7ab3a5', mb: 3 }}>
              Plantillas del Proyecto
            </Typography>
            <Alert severity="info">
              Esta sección mostrará las plantillas asociadas al proyecto. (Por implementar)
            </Alert>
          </Box>
        )}
        
        {tabValue === 2 && (
          // Tab Configuración
          <Box>
            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#7ab3a5', mb: 3 }}>
              Configuración del Proyecto
            </Typography>
            <Alert severity="info">
              Configuración avanzada del proyecto. (Por implementar)
            </Alert>
          </Box>
        )}
        
        {tabValue === 3 && isAdmin && (
          // Tab Actividad
          <Box>
            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#7ab3a5', mb: 3 }}>
              Historial de Actividad
            </Typography>
            <Alert severity="info">
              Historial de acciones realizadas en este proyecto. (Por implementar)
            </Alert>
          </Box>
        )}
      </Paper>
      
      {/* Botón para volver */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-start' }}>
        <Button
          startIcon={<AiOutlineArrowLeft />}
          onClick={() => navigate('/proyectos')}
          sx={{ borderRadius: 2 }}
        >
          Volver a Proyectos
        </Button>
      </Box>
    </Container>
  );
};

export default DetalleProyecto;