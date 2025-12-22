import React, { useState, useEffect } from 'react';
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
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { proyectosAPI } from '../../api/proyectos';
import { padronesAPI } from '../../api/padrones';
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
  AiOutlineCalendar,
  AiOutlineInfoCircle,
  AiOutlinePlus,
} from 'react-icons/ai';
import { BiStats, BiUpload } from 'react-icons/bi';
import { BsArrowRight } from 'react-icons/bs';

const DetalleProyecto = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [padronInfo, setPadronInfo] = useState(null);
  const [loadingPadron, setLoadingPadron] = useState(false);
  
  // Función para obtener URL completa del logo (CORREGIDA)
  const getLogoUrl = (logoPath) => {
    if (!logoPath) return null;
    
    // Si ya es una URL completa, devolverla
    if (logoPath.startsWith('http')) return logoPath;
    
    // Normalizar barras invertidas a forward slashes (Windows → Unix)
    let normalizedPath = logoPath.replace(/\\/g, '/');
    
    // Remover prefijo 'uploads/' si existe para evitar duplicación
    if (normalizedPath.startsWith('uploads/')) {
      normalizedPath = normalizedPath.substring(8); // Remueve "uploads/"
    }
    // Construir URL completa con el servidor backend
    return `http://localhost:8000/uploads/${normalizedPath}`;
  };
  
  // Obtener detalles del proyecto
  const { data: proyecto, isLoading, error, refetch } = useQuery({
    queryKey: ['proyecto', id],
    queryFn: () => proyectosAPI.getProyecto(id),
    enabled: !!id,
  });
  
  // Obtener estadísticas del proyecto
  const { data: estadisticas } = useQuery({
    queryKey: ['proyecto-estadisticas', id],
    queryFn: () => proyectosAPI.getEstadisticas(id),
    enabled: !!proyecto,
  });
  
  // Obtener información del padrón
  useEffect(() => {
    const obtenerInfoPadron = async () => {
      if (proyecto?.tabla_padron) {
        setLoadingPadron(true);
        try {
          const response = await padronesAPI.getPadrones({ activos: true });
          const padronEncontrado = response.find(p => p.uuid_padron === proyecto.tabla_padron);
          setPadronInfo(padronEncontrado || null);
        } catch (err) {
          console.error('Error obteniendo info del padrón:', err);
          setPadronInfo(null);
        } finally {
          setLoadingPadron(false);
        }
      }
    };
    
    if (proyecto) {
      obtenerInfoPadron();
    }
  }, [proyecto]);
  
  const handleDeleteClick = () => {
    Swal.fire({
      title: '¿Eliminar proyecto?',
      text: `¿Estás seguro de eliminar "${proyecto?.nombre}"?`,
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
            Swal.fire({
              icon: 'success',
              title: '¡Eliminado!',
              text: 'El proyecto ha sido eliminado.',
              timer: 1500,
              showConfirmButton: false,
            }).then(() => navigate('/proyectos'));
          })
          .catch((error) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: error.response?.data?.detail || 'Error al eliminar',
            });
          });
      }
    });
  };
  
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
          {error?.message || 'Proyecto no encontrado'}
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
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          {/* Logo/avatar */}
          <Avatar
            src={getLogoUrl(proyecto.logo)}
            sx={{
              width: 100,
              height: 100,
              bgcolor: 'linear-gradient(135deg, #aae6d9, #e6b0aa)',
              border: '3px solid #ffffff',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
              fontSize: '2.5rem',
              fontWeight: 700,
              position: 'relative',
              zIndex: 2,
            }}
            imgProps={{
              onError: (e) => {
                e.target.style.display = 'none';
              }
            }}
          >
            {proyecto.nombre?.charAt(0).toUpperCase() || 'P'}
          </Avatar>
          
          {/* Información */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="h4" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
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
                    <strong>Padrón:</strong> {
                      loadingPadron ? (
                        <CircularProgress size={12} sx={{ ml: 1 }} />
                      ) : padronInfo ? (
                        <Tooltip title={`UUID: ${proyecto.tabla_padron}`}>
                          <span>{padronInfo.nombre_tabla}</span>
                        </Tooltip>
                      ) : proyecto.tabla_padron ? (
                        <Tooltip title={`UUID: ${proyecto.tabla_padron}`}>
                          <span>{proyecto.tabla_padron.substring(0, 8)}...</span>
                        </Tooltip>
                      ) : (
                        'No asignado'
                      )
                    }
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Creado:</strong> {proyecto.fecha_creacion ? 
                    new Date(proyecto.fecha_creacion).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    }) : 'Fecha desconocida'}
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
              variant="outlined"
              onClick={() => navigate(`/proyectos/${id}/plantillas`)}
              fullWidth
              startIcon={<AiOutlineFileText />}
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
                  onClick={handleDeleteClick}
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
              minHeight: 48,
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
            
            <Grid container spacing={3}>
              {/* Estadísticas de plantillas */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(170, 230, 217, 0.05)' }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: '#7ab3a5' }}>
                    <AiOutlineFileText style={{ marginRight: 8, verticalAlign: 'middle' }} />
                    Plantillas
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" fontWeight={700} color="primary.main">
                          {estadisticas?.plantillas?.total || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Total
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" fontWeight={700} color="success.main">
                          {estadisticas?.plantillas?.activas || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Activas
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  <LinearProgress 
                    variant="determinate" 
                    value={estadisticas?.plantillas?.total ? 
                      ((estadisticas.plantillas.activas || 0) / estadisticas.plantillas.total * 100) : 0}
                    sx={{ mt: 2, height: 8, borderRadius: 4 }}
                  />
                </Paper>
              </Grid>
              
              {/* Información del padrón */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(230, 176, 170, 0.05)' }}>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: '#b27a75' }}>
                    <AiOutlineTeam style={{ marginRight: 8, verticalAlign: 'middle' }} />
                    Padrón Asociado
                  </Typography>
                  {padronInfo ? (
                    <Box>
                      <Typography variant="body1" fontWeight={600}>
                        {padronInfo.nombre_tabla}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {padronInfo.descripcion || 'Sin descripción'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                        <Chip
                          label={padronInfo.activo ? 'Activo' : 'Inactivo'}
                          size="small"
                          sx={{ 
                            bgcolor: padronInfo.activo ? 'rgba(129, 199, 132, 0.2)' : 'rgba(161, 161, 161, 0.2)',
                            color: padronInfo.activo ? '#2e7d32' : '#616161',
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          UUID: {proyecto.tabla_padron?.substring(0, 8)}...
                        </Typography>
                      </Box>
                    </Box>
                  ) : proyecto.tabla_padron ? (
                    <Box>
                      <Typography variant="body2" fontWeight={600} color="text.secondary">
                        UUID del padrón:
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, fontFamily: 'monospace' }}>
                        {proyecto.tabla_padron}
                      </Typography>
                      {loadingPadron && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
                          <CircularProgress size={16} />
                          <Typography variant="caption" color="text.secondary">
                            Cargando información del padrón...
                          </Typography>
                        </Box>
                      )}
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
                    <AiOutlineFolderOpen style={{ marginRight: 8, verticalAlign: 'middle' }} />
                    Acciones Rápidas
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<AiOutlineFileText />}
                        onClick={() => navigate(`/proyectos/${id}/plantillas`)}
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
                        disabled={!isAdmin}
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
          </Box>
        )}
        
        {tabValue === 1 && (
          // Tab Plantillas
          <Box>
            <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#7ab3a5', mb: 3 }}>
              Plantillas del Proyecto
            </Typography>
            <Alert 
              severity="info" 
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={() => navigate(`/proyectos/${id}/plantillas`)}
                  startIcon={<AiOutlineFileText />}
                >
                  Ver todas
                </Button>
              }
            >
              Para ver y gestionar todas las plantillas de este proyecto, haz clic en "Ver Plantillas" o ve a la pestaña específica.
            </Alert>
            
            {/* Mini vista de plantillas recientes */}
            {estadisticas?.plantillas?.total > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, color: '#7ab3a5' }}>
                  Resumen de plantillas
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="h5" fontWeight={700}>
                        {estadisticas.plantillas.total}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Total
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="h5" fontWeight={700} color="success.main">
                        {estadisticas.plantillas.activas}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Activas
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="h5" fontWeight={700} color="warning.main">
                        {estadisticas.plantillas.total - estadisticas.plantillas.activas}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Inactivas
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        size="small"
                        onClick={() => navigate(`/proyectos/${id}/plantillas`)}
                        sx={{ bgcolor: '#aae6d9', '&:hover': { bgcolor: '#7ab3a5' } }}
                      >
                        Ver todas
                      </Button>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}
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