// frontend/src/pages/plantillas/ListaPlantillas.js - VERSIÓN COMPLETA Y CORREGIDA
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
  Divider,
  Tooltip,
  Fab,
  Breadcrumbs,
  Link,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
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
  AiOutlineEdit,
  AiOutlineDelete,
  AiOutlineFileText,
  AiOutlineArrowLeft,
  AiOutlineReload,
  AiOutlineCopy,
  AiOutlineExport,
  AiOutlineFilePdf,
  AiOutlineCheckCircle,
  AiOutlineCloseCircle,
} from 'react-icons/ai';
import { BiCalendar} from 'react-icons/bi';
import { BsThreeDotsVertical } from 'react-icons/bs';

const ListaPlantillas = () => {
  const { id: proyectoId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  
  // Estados
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedPlantilla, setSelectedPlantilla] = useState(null);
  const [setOpenDeleteDialog] = useState(false);
  
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
      setOpenDeleteDialog(false);
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
  
  const handleMenuOpen = (event, plantilla) => {
    setMenuAnchor(event.currentTarget);
    setSelectedPlantilla(plantilla);
  };
  
  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedPlantilla(null);
  };
  
  const handleDeleteClick = () => {
    if (!selectedPlantilla) return;
    
    Swal.fire({
      title: '¿Eliminar plantilla?',
      text: `¿Estás seguro de eliminar "${selectedPlantilla.nombre}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e6b0aa',
      cancelButtonColor: '#aae6d9',
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(selectedPlantilla.id);
      }
    });
    
    handleMenuClose();
  };
  
  const handleDuplicate = () => {
    if (!selectedPlantilla) return;
    
    Swal.fire({
      title: 'Duplicar plantilla',
      text: `¿Deseas crear una copia de "${selectedPlantilla.nombre}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Duplicar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#aae6d9',
    }).then((result) => {
      if (result.isConfirmed) {
        // Por implementar: Lógica de duplicación
        Swal.fire({
          icon: 'info',
          title: 'Funcionalidad en desarrollo',
          text: 'La duplicación de plantillas estará disponible pronto.',
          timer: 2000,
          showConfirmButton: false,
        });
      }
    });
    
    handleMenuClose();
  };
  
  const handleExport = () => {
    if (!selectedPlantilla) return;
    
    // Por implementar: Lógica de exportación
    Swal.fire({
      icon: 'info',
      title: 'Exportar plantilla',
      text: 'La exportación de plantillas estará disponible pronto.',
      timer: 2000,
      showConfirmButton: false,
    });
    
    handleMenuClose();
  };
  
  // Formatear fecha
  const formatFecha = (fechaString) => {
    if (!fechaString) return 'Fecha desconocida';
    try {
      return new Date(fechaString).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Fecha inválida';
    }
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
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
                {proyecto?.nombre} • {plantillas.length} plantilla{plantillas.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              startIcon={<AiOutlineArrowLeft />}
              onClick={() => navigate(`/proyectos/${proyectoId}`)}
              sx={{ borderRadius: 2 }}
            >
              Volver al Proyecto
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, p: 2, bgcolor: 'rgba(230, 176, 170, 0.05)', borderRadius: 2 }}>
            {proyecto.descripcion}
          </Typography>
        )}
      </Paper>
      
      {/* Estadísticas rápidas */}
      {plantillas.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2.5, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={700} color="primary.main">
                {plantillas.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Plantillas totales
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2.5, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={700} color="success.main">
                {plantillas.filter(p => p.activa).length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Plantillas activas
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2.5, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={700} color="warning.main">
                {plantillas.filter(p => !p.activa).length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Plantillas inactivas
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2.5, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={700} color="info.main">
                {new Date().toLocaleDateString('es-MX')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Última actualización
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}
      
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
          <AiOutlineFileText size={64} color="#e6b0aa" style={{ marginBottom: 16, opacity: 0.5 }} />
          <Typography variant="h6" gutterBottom color="text.secondary">
            No hay plantillas en este proyecto
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            {isAdmin ? 'Comienza creando tu primera plantilla para generar documentos personalizados.' : 'Espera a que se agreguen plantillas a este proyecto.'}
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
          {/* Grid de plantillas */}
          <Grid container spacing={3}>
            {plantillas.map((plantilla) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={plantilla.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(230, 176, 170, 0.2)',
                    }
                  }}
                >
                  {/* Header de la card */}
                  <Box sx={{ 
                    p: 2.5, 
                    pb: 1.5,
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    bgcolor: plantilla.activa ? 'rgba(170, 230, 217, 0.05)' : 'rgba(161, 161, 161, 0.05)'
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography 
                        variant="h6" 
                        fontWeight={600} 
                        sx={{ 
                          maxWidth: '70%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          fontSize: '1rem',
                        }}
                      >
                        {plantilla.nombre}
                      </Typography>
                      <Chip
                        label={plantilla.activa ? 'Activa' : 'Inactiva'}
                        size="small"
                        sx={{ 
                          bgcolor: plantilla.activa ? 'rgba(129, 199, 132, 0.2)' : 'rgba(161, 161, 161, 0.2)',
                          color: plantilla.activa ? '#2e7d32' : '#616161',
                          height: 22,
                          fontSize: '0.7rem',
                          fontWeight: 500,
                        }}
                      />
                    </Box>
                    
                    {/* Descripción */}
                    {plantilla.descripcion && (
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          fontSize: '0.8rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          minHeight: '2.4rem',
                        }}
                      >
                        {plantilla.descripcion}
                      </Typography>
                    )}
                  </Box>
                  
                  <CardContent sx={{ flexGrow: 1, p: 2.5, pt: 2 }}>
                    {/* Información de la plantilla */}
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <AiOutlineFilePdf size={14} color="#a1a1a1" />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          Tipo: {plantilla.tipo_plantilla || 'Documento PDF'}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <BiCalendar size={14} color="#a1a1a1" />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          Creada: {formatFecha(plantilla.fecha_creacion)}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AiOutlineFileText size={14} color="#a1a1a1" />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          {plantilla.campos_json?.length || 0} campos definidos
                        </Typography>
                      </Box>
                    </Box>
                    
                    {/* Estado */}
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      p: 1, 
                      borderRadius: 1,
                      bgcolor: 'rgba(0,0,0,0.02)',
                      border: '1px solid rgba(0,0,0,0.05)'
                    }}>
                      {plantilla.activa ? (
                        <>
                          <AiOutlineCheckCircle size={12} color="#4caf50" />
                          <Typography variant="caption" color="success.main" fontWeight={500}>
                            Lista para usar
                          </Typography>
                        </>
                      ) : (
                        <>
                          <AiOutlineCloseCircle size={12} color="#f44336" />
                          <Typography variant="caption" color="error.main" fontWeight={500}>
                            No disponible
                          </Typography>
                        </>
                      )}
                    </Box>
                  </CardContent>
                  
                  <CardActions sx={{ p: 2, pt: 1, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <CustomButton
                        size="small"
                        icon="view"
                        variant="outlined"
                        onClick={() => navigate(`/plantillas/${plantilla.id}`)}
                        sx={{ flexGrow: 1, mr: 1 }}
                      >
                        Ver
                      </CustomButton>
                      
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/plantillas/${plantilla.id}/editor`)}
                            sx={{ 
                              color: 'primary.main',
                              '&:hover': { bgcolor: 'rgba(170, 230, 217, 0.1)' }
                            }}
                          >
                            <AiOutlineEdit size={16} />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Más opciones">
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, plantilla)}
                            sx={{ 
                              color: 'text.secondary',
                              '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' }
                            }}
                          >
                            <BsThreeDotsVertical size={16} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
          
          {/* Contador */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
            <Chip 
              label={`Mostrando ${plantillas.length} plantilla${plantillas.length !== 1 ? 's' : ''}`}
              sx={{ 
                bgcolor: 'rgba(230, 176, 170, 0.1)',
                color: '#b27a75',
                fontWeight: 500
              }}
            />
          </Box>
        </>
      )}
      
      {/* Menú de opciones */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { 
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            minWidth: 180,
          }
        }}
      >
        <MenuItem onClick={() => {
          if (selectedPlantilla) {
            navigate(`/plantillas/${selectedPlantilla.id}/editor`);
          }
          handleMenuClose();
        }}>
          <ListItemIcon>
            <AiOutlineEdit size={18} />
          </ListItemIcon>
          <ListItemText>Editor de plantilla</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={handleDuplicate}>
          <ListItemIcon>
            <AiOutlineCopy size={18} />
          </ListItemIcon>
          <ListItemText>Duplicar plantilla</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={handleExport}>
          <ListItemIcon>
            <AiOutlineExport size={18} />
          </ListItemIcon>
          <ListItemText>Exportar plantilla</ListItemText>
        </MenuItem>
        
        <Divider sx={{ my: 0.5 }} />
        
        <MenuItem 
          onClick={handleDeleteClick}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <AiOutlineDelete size={18} color="inherit" />
          </ListItemIcon>
          <ListItemText>Eliminar plantilla</ListItemText>
        </MenuItem>
      </Menu>
      
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