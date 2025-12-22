import React, { useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Button,
  Alert,
  Avatar,
  Tooltip,
  Fab,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import CustomButton from '../../components/ui/CustomButton';
import { plantillasAPI } from '../../api/plantillas';
import { proyectosAPI } from '../../api/proyectos';
import Swal from 'sweetalert2';

// Iconos
import {
  AiOutlinePlus,
  AiOutlineEdit,
  AiOutlineDelete,
  AiOutlineEye,
  AiOutlineFileText,
  AiOutlineArrowLeft,
  AiOutlineReload,
  AiOutlineProject,
} from 'react-icons/ai';
import { BiFile, BiCalendar } from 'react-icons/bi';

const ListaPlantillas = () => {
  const { id: proyectoId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  
  // Obtener proyecto
  const { data: proyecto, isLoading: loadingProyecto } = useQuery({
    queryKey: ['proyecto', proyectoId],
    queryFn: () => proyectosAPI.getProyecto(proyectoId),
    enabled: !!proyectoId,
  });
  
  // Obtener plantillas del proyecto
  const { 
    data: plantillas = [], 
    isLoading: loadingPlantillas, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['plantillas-proyecto', proyectoId],
    queryFn: () => plantillasAPI.getPlantillas({ proyecto_id: proyectoId }),
    enabled: !!proyectoId,
  });
  
  // Mutación para eliminar plantilla
  const deleteMutation = useMutation({
    mutationFn: (plantillaId) => plantillasAPI.deletePlantilla(plantillaId),
    onSuccess: () => {
      queryClient.invalidateQueries(['plantillas-proyecto', proyectoId]);
      Swal.fire({
        icon: 'success',
        title: '¡Eliminada!',
        text: 'La plantilla ha sido eliminada',
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.detail || 'Error eliminando plantilla',
      });
    },
  });
  
  const handleDeleteClick = (plantilla) => {
    Swal.fire({
      title: '¿Eliminar plantilla?',
      text: `¿Estás seguro de eliminar "${plantilla.nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e6b0aa',
      cancelButtonColor: '#aae6d9',
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(plantilla.id);
      }
    });
  };
  
  if (loadingProyecto || loadingPlantillas) {
    return <LoadingSpinner />;
  }
  
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert 
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => navigate(`/proyectos/${proyectoId}`)}>
              Volver
            </Button>
          }
        >
          Error cargando plantillas: {error.message}
        </Alert>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link component={RouterLink} to="/proyectos" underline="hover" color="inherit">
          Proyectos
        </Link>
        <Link component={RouterLink} to={`/proyectos/${proyectoId}`} underline="hover" color="inherit">
          {proyecto?.nombre || 'Proyecto'}
        </Link>
        <Typography color="text.primary">Plantillas</Typography>
      </Breadcrumbs>
      
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #e6b0aa, #b27a75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(230, 176, 170, 0.3)',
              }}
            >
              <AiOutlineFileText size={32} color="#ffffff" />
            </Box>
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #e6b0aa, #b27a75)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Plantillas del Proyecto
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {proyecto?.nombre} • {plantillas.length} plantillas
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              startIcon={<AiOutlineArrowLeft />}
              onClick={() => navigate(`/proyectos/${proyectoId}`)}
              sx={{ borderRadius: 2 }}
            >
              Volver
            </Button>
            
            {isAdmin && (
              <CustomButton
                icon="add"
                onClick={() => navigate(`/plantillas/nueva?proyecto=${proyectoId}`)}
                sx={{ height: 48 }}
              >
                Nueva Plantilla
              </CustomButton>
            )}
          </Box>
        </Box>
        
        {/* Descripción */}
        {proyecto?.descripcion && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, p: 2, bgcolor: 'rgba(170, 230, 217, 0.05)', borderRadius: 2 }}>
            {proyecto.descripcion}
          </Typography>
        )}
      </Paper>
      
      {/* Lista de plantillas */}
      {plantillas.length === 0 ? (
        <Paper
          sx={{
            p: 8,
            textAlign: 'center',
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.7)',
          }}
        >
          <AiOutlineFileText size={64} color="#e6b0aa" style={{ marginBottom: 16 }} />
          <Typography variant="h6" gutterBottom color="text.secondary">
            No hay plantillas en este proyecto
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {isAdmin ? 'Crea tu primera plantilla para comenzar' : 'Espera a que se agreguen plantillas'}
          </Typography>
          {isAdmin && (
            <CustomButton
              icon="add"
              onClick={() => navigate(`/plantillas/nueva?proyecto=${proyectoId}`)}
            >
              Crear Primera Plantilla
            </CustomButton>
          )}
        </Paper>
      ) : (
        <>
          {/* Estadísticas rápidas */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 3 }}>
                <Typography variant="h4" fontWeight={700} color="primary.main">
                  {plantillas.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Plantillas totales
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 3 }}>
                <Typography variant="h4" fontWeight={700} color="success.main">
                  {plantillas.filter(p => p.activa).length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Plantillas activas
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 3 }}>
                <Typography variant="h4" fontWeight={700} color="info.main">
                  {new Date().toLocaleDateString('es-MX')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Última actualización
                </Typography>
              </Paper>
            </Grid>
          </Grid>
          
          {/* Grid de plantillas */}
          <Grid container spacing={3}>
            {plantillas.map((plantilla) => (
              <Grid item xs={12} sm={6} md={4} key={plantilla.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" fontWeight={600} sx={{ 
                        maxWidth: '70%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {plantilla.nombre}
                      </Typography>
                      <Chip
                        label={plantilla.activa ? 'Activa' : 'Inactiva'}
                        size="small"
                        sx={{ 
                          bgcolor: plantilla.activa ? 'rgba(129, 199, 132, 0.2)' : 'rgba(161, 161, 161, 0.2)',
                          color: plantilla.activa ? '#2e7d32' : '#616161',
                        }}
                      />
                    </Box>
                    
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ 
                        mb: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        minHeight: '60px',
                      }}
                    >
                      {plantilla.descripcion || 'Sin descripción'}
                    </Typography>
                    
                    {/* Información de la plantilla */}
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <BiFile size={14} color="#a1a1a1" />
                        <Typography variant="caption" color="text.secondary">
                          Tipo: {plantilla.tipo_plantilla || 'PDF'}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BiCalendar size={14} color="#a1a1a1" />
                        <Typography variant="caption" color="text.secondary">
                          Creada: {plantilla.fecha_creacion ? 
                            new Date(plantilla.fecha_creacion).toLocaleDateString('es-MX') : 
                            'Fecha desconocida'}
                        </Typography>
                      </Box>
                    </Box>
                    
                    {/* Campos definidos */}
                    {plantilla.campos_json && Array.isArray(plantilla.campos_json) && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          Campos definidos: {plantilla.campos_json.length}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                  
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <CustomButton
                      size="small"
                      icon="view"
                      variant="outlined"
                      onClick={() => navigate(`/plantillas/${plantilla.id}`)}
                      sx={{ flexGrow: 1 }}
                    >
                      Ver Detalles
                    </CustomButton>
                    
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/plantillas/editar/${plantilla.id}`)}
                          sx={{ color: 'primary.main' }}
                        >
                          <AiOutlineEdit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(plantilla)}
                          sx={{ color: 'secondary.main' }}
                        >
                          <AiOutlineDelete />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}
      
      {/* Botón flotante para recargar */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          bgcolor: '#e6b0aa',
          '&:hover': { bgcolor: '#b27a75' }
        }}
        onClick={() => refetch()}
      >
        <AiOutlineReload />
      </Fab>
    </Container>
  );
};

export default ListaPlantillas;