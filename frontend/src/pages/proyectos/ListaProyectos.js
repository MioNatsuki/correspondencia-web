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
  CardMedia,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Alert,
  Avatar,
  Tooltip,
  Fab,
  InputAdornment,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import CustomButton from '../../components/ui/CustomButton';
import { proyectosAPI } from '../../api/proyectos';
import { padronesAPI } from '../../api/padrones';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

// Iconos
import {
  AiOutlinePlus,
  AiOutlineEdit,
  AiOutlineDelete,
  AiOutlineEye,
  AiOutlineProject,
  AiOutlineFileText,
  AiOutlineTeam,
  AiOutlineReload,
  AiOutlineFilter,
  AiOutlineSearch,
  AiOutlineRest,
  AiOutlineInfoCircle,
  AiOutlineSortAscending,
  AiOutlineCalendar,
} from 'react-icons/ai';
import { BiStats, BiTrash, BiArchive } from 'react-icons/bi';
import { RiShieldKeyholeLine } from 'react-icons/ri';
import { BsArrowRight, BsThreeDotsVertical, BsSortAlphaDown, BsSortAlphaUp } from 'react-icons/bs';

const ListaProyectos = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Estados
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [proyectoToDelete, setProyectoToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [orden, setOrden] = useState('nombre_asc');
  
  // Obtener proyectos
  const { data: proyectos, isLoading, error, refetch } = useQuery({
    queryKey: ['proyectos'],
    queryFn: () => proyectosAPI.getProyectos({
      incluir_eliminados: false,
      solo_activos: true,
    }),
  });
  
  // Filtrar y ordenar proyectos
  const proyectosFiltrados = React.useMemo(() => {
    if (!proyectos) return [];
    
    let filtered = [...proyectos];
    
    // 1. Aplicar búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(proyecto => {
        // Buscar en nombre
        if (proyecto.nombre?.toLowerCase().includes(term)) return true;
        
        // Buscar en descripción
        if (proyecto.descripcion?.toLowerCase().includes(term)) return true;
        
        // Buscar en nombre del padrón
        if (proyecto.padron_info?.nombre_tabla?.toLowerCase().includes(term)) return true;
        
        // Buscar en UUID del padrón
        if (proyecto.tabla_padron?.toLowerCase().includes(term)) return true;
        
        return false;
      });
    }
    
    // 2. Aplicar ordenamiento
    filtered.sort((a, b) => {
      switch (orden) {
        case 'nombre_asc':
          return a.nombre?.localeCompare(b.nombre);
        
        case 'nombre_desc':
          return b.nombre?.localeCompare(a.nombre);
        
        case 'fecha_desc':
          return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
        
        case 'fecha_asc':
          return new Date(a.fecha_creacion) - new Date(b.fecha_creacion);
        
        case 'padron_asc':
          const padronA = a.padron_info?.nombre_tabla || 'ZZZ';
          const padronB = b.padron_info?.nombre_tabla || 'ZZZ';
          return padronA.localeCompare(padronB);
        
        case 'padron_desc':
          const padronA2 = a.padron_info?.nombre_tabla || '';
          const padronB2 = b.padron_info?.nombre_tabla || '';
          return padronB2.localeCompare(padronA2);
        
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [proyectos, searchTerm, orden]);
  
  // Mutación para eliminar proyecto
  const deleteMutation = useMutation({
    mutationFn: ({ id, permanente }) => 
      proyectosAPI.deleteProyecto(id, permanente),
    onSuccess: () => {
      queryClient.invalidateQueries(['proyectos']);
      setOpenDeleteDialog(false);
      Swal.fire({
        icon: 'success',
        title: '¡Eliminado!',
        text: 'El proyecto ha sido eliminado',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#aae6d9',
        timer: 1500,
        showConfirmButton: false,
      });
    },
    onError: (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.detail || 'Error eliminando proyecto',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#e6b0aa',
      });
    },
  });
  
  const handleDeleteClick = (proyecto, permanente = false) => {
    setProyectoToDelete({ 
      id: proyecto.id, 
      nombre: proyecto.nombre, 
      permanente 
    });
    setOpenDeleteDialog(true);
  };
  
  const handleConfirmDelete = () => {
    if (proyectoToDelete) {
      deleteMutation.mutate({
        id: proyectoToDelete.id,
        permanente: proyectoToDelete.permanente,
      });
    }
  };
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Reintentar
            </Button>
          }
        >
          Error cargando proyectos: {error.message}
        </Alert>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
              <AiOutlineProject size={32} color="#ffffff" />
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
                Gestión de Proyectos
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Crea y administra tus proyectos de correspondencia
              </Typography>
            </Box>
          </Box>
          
          {isAdmin && (
            <CustomButton
              icon="add"
              onClick={() => navigate('/proyectos/nuevo')}
              sx={{ height: 48 }}
            >
              Nuevo Proyecto
            </CustomButton>
          )}
        </Box>
        
        {/* Filtros y búsqueda MEJORADO */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: '#ffffff' }}>
          <Grid container spacing={3} alignItems="center">
            {/* Búsqueda AMPLIADA */}
            <Grid item xs={12} md={7}>
              <TextField
                fullWidth
                placeholder="🔍 Buscar proyectos por nombre, descripción, padrón..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AiOutlineSearch style={{ color: '#aae6d9' }} />
                    </InputAdornment>
                  ),
                  sx: { 
                    borderRadius: 2,
                    fontFamily: "'Nunito', sans-serif",
                    fontSize: '0.95rem'
                  }
                }}
              />
            </Grid>
            
            {/* Ordenamiento MEJORADO */}
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ color: '#5a6b70', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  Ordenar por:
                </Typography>
                
                <Select
                  value={orden}
                  onChange={(e) => setOrden(e.target.value)}
                  size="small"
                  sx={{ 
                    flexGrow: 1,
                    minWidth: 200,
                    borderRadius: 2,
                    bgcolor: '#ffffff',
                    fontFamily: "'Nunito', sans-serif",
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#aae6d9',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#7ab3a5',
                    }
                  }}
                >
                  <MenuItem value="nombre_asc">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BsSortAlphaDown />
                      <span>Nombre (A → Z)</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="nombre_desc">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BsSortAlphaUp />
                      <span>Nombre (Z → A)</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="fecha_desc">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AiOutlineCalendar />
                      <span>Más recientes</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="fecha_asc">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AiOutlineCalendar />
                      <span>Más antiguos</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="padron_asc">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AiOutlineTeam />
                      <span>Padrón (A → Z)</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="padron_desc">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AiOutlineTeam />
                      <span>Padrón (Z → A)</span>
                    </Box>
                  </MenuItem>
                </Select>
                
                {(searchTerm || orden !== 'nombre_asc') && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setSearchTerm('');
                      setOrden('nombre_asc');
                    }}
                    sx={{ 
                      borderRadius: 2,
                      borderColor: '#e6b0aa',
                      color: '#b27a75',
                      '&:hover': {
                        borderColor: '#b27a75',
                        bgcolor: 'rgba(230, 176, 170, 0.1)'
                      }
                    }}
                  >
                    Limpiar
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
          
          {/* Contador de resultados */}
          {proyectos && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip 
                label={`${proyectosFiltrados.length} de ${proyectos.length} proyectos`}
                size="small"
                sx={{ 
                  bgcolor: 'rgba(170, 230, 217, 0.1)',
                  color: '#7ab3a5',
                  fontWeight: 500
                }}
              />
              {searchTerm && (
                <Typography variant="caption" color="text.secondary">
                  Filtrados por: "{searchTerm}"
                </Typography>
              )}
            </Box>
          )}
        </Paper>
      </Box>
      
      {/* Lista de proyectos */}
      {proyectosFiltrados?.length === 0 ? (
        <Paper
          sx={{
            p: 8,
            textAlign: 'center',
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.7)',
          }}
        >
          <AiOutlineProject size={64} color="#aae6d9" style={{ marginBottom: 16 }} />
          <Typography variant="h6" gutterBottom color="text.secondary">
            {searchTerm ? 'No hay proyectos que coincidan con la búsqueda' : 'No hay proyectos disponibles'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {isAdmin && !searchTerm ? 'Crea tu primer proyecto para comenzar' :
             searchTerm ? 'Intenta con otros términos de búsqueda' :
             'Espera a que un administrador asigne proyectos'}
          </Typography>
          {isAdmin && !searchTerm && (
            <CustomButton
              icon="add"
              onClick={() => navigate('/proyectos/nuevo')}
            >
              Crear Primer Proyecto
            </CustomButton>
          )}
          {searchTerm && (
            <Button
              variant="outlined"
              onClick={() => setSearchTerm('')}
              sx={{ mt: 2, borderRadius: 2 }}
            >
              Limpiar búsqueda
            </Button>
          )}
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {proyectosFiltrados?.map((proyecto) => (
            <Grid item xs={12} sm={6} md={4} key={proyecto.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: proyecto.is_deleted ? '2px dashed #e6b0aa' : 'none',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
                  }
                }}
              >
                {/* Logo del proyecto */}
                {proyecto.logo ? (
                  <CardMedia
                    component="img"
                    height="160"
                    image={proyecto.logo}
                    alt={proyecto.nombre}
                    sx={{ 
                      objectFit: 'contain', 
                      p: 2, 
                      bgcolor: '#f8f9fa',
                      borderBottom: '1px solid rgba(0,0,0,0.05)'
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 160,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #aae6d9, #e6b0aa)',
                      borderBottom: '1px solid rgba(0,0,0,0.05)'
                    }}
                  >
                    <AiOutlineProject size={64} color="#ffffff" />
                  </Box>
                )}
                
                <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" fontWeight={600} sx={{ 
                      maxWidth: '70%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {proyecto.nombre}
                    </Typography>
                    <Chip
                      label={proyecto.activo ? 'Activo' : 'Inactivo'}
                      size="small"
                      color={proyecto.activo ? 'success' : 'default'}
                      sx={{ 
                        bgcolor: proyecto.activo ? 'rgba(129, 199, 132, 0.2)' : 'rgba(161, 161, 161, 0.2)',
                        color: proyecto.activo ? '#2e7d32' : '#616161',
                        fontWeight: 500,
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
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      minHeight: '40px',
                    }}
                  >
                    {proyecto.descripcion || 'Sin descripción'}
                  </Typography>
                  
                  {/* Información del padrón */}
                  <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(170, 230, 217, 0.05)', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <AiOutlineTeam size={14} color="#7ab3a5" />
                      <Typography variant="caption" fontWeight={500} color="#7ab3a5">
                        Padrón asociado:
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                      {proyecto.padron_info?.nombre_tabla || proyecto.tabla_padron?.substring(0, 8) + '...' || 'Sin padrón'}
                    </Typography>
                  </Box>
                  
                  {/* Estadísticas */}
                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AiOutlineFileText size={14} color="#a1a1a1" />
                        <Typography variant="caption" color="text.secondary">
                          {proyecto.num_plantillas || 0} plantillas
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Creado: {new Date(proyecto.fecha_creacion).toLocaleDateString('es-MX')}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
                
                <CardActions sx={{ p: 2, pt: 0 }}>
                  <CustomButton
                    size="small"
                    icon="view"
                    variant="outlined"
                    onClick={() => navigate(`/proyectos/${proyecto.id}`)}
                    sx={{ flexGrow: 1 }}
                  >
                    Abrir Proyecto
                  </CustomButton>
                  
                  {isAdmin && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/proyectos/editar/${proyecto.id}`)}
                          sx={{ color: 'primary.main' }}
                        >
                          <AiOutlineEdit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(proyecto, false)}
                          sx={{ color: 'secondary.main' }}
                        >
                          <AiOutlineDelete />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      {/* Diálogo de confirmación para eliminar */}
      <Dialog 
        open={openDeleteDialog} 
        onClose={() => setOpenDeleteDialog(false)}
        maxWidth="xs"
      >
        <DialogTitle sx={{ color: proyectoToDelete?.permanente ? 'error.main' : 'warning.main' }}>
          {proyectoToDelete?.permanente ? '⚠️ Eliminación permanente' : '¿Eliminar proyecto?'}
        </DialogTitle>
        <DialogContent>
          {proyectoToDelete?.permanente ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              Esta acción NO se puede deshacer
            </Alert>
          ) : null}
          <Typography>
            {proyectoToDelete?.permanente 
              ? `¿Estás seguro de eliminar permanentemente "${proyectoToDelete.nombre}"?`
              : `¿Estás seguro de eliminar "${proyectoToDelete?.nombre}"?`
            }
          </Typography>
          {!proyectoToDelete?.permanente && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              El proyecto se marcará como eliminado (soft delete).
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)} color="inherit">
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmDelete}
            color={proyectoToDelete?.permanente ? "error" : "warning"}
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Eliminando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Botón flotante para recargar */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          bgcolor: '#aae6d9',
          '&:hover': { bgcolor: '#7ab3a5' }
        }}
        onClick={() => refetch()}
      >
        <AiOutlineReload />
      </Fab>
    </Container>
  );
};

export default ListaProyectos;