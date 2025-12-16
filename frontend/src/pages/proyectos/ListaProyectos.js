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
  Tabs,
  Tab,
  Alert,
  Avatar,
  Tooltip,
  Fab,
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
} from 'react-icons/ai';
import { BiStats, BiTrash, BiArchive } from 'react-icons/bi';
import { RiShieldKeyholeLine } from 'react-icons/ri';
import { BsArrowRight, BsThreeDotsVertical } from 'react-icons/bs';

const ListaProyectos = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Estados
  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [proyectoToDelete, setProyectoToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActivos, setFilterActivos] = useState(true);
  
  // Datos del formulario
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tabla_padron: '',
    logo: null,
  });
  
  // Obtener proyectos
  const { data: proyectos, isLoading, error, refetch } = useQuery({
    queryKey: ['proyectos', tabValue],
    queryFn: () => proyectosAPI.getProyectos({
      solo_activos: tabValue === 0,
      incluir_eliminados: tabValue === 2,
    }),
  });
  
  // Obtener padrones para el select
  const { data: padrones } = useQuery({
    queryKey: ['padrones'],
    queryFn: () => padronesAPI.getPadrones({ activos: true }),
    enabled: openDialog,
  });
  
  // Mutación para crear proyecto
  const createMutation = useMutation({
    mutationFn: (data) => proyectosAPI.createProyecto(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['proyectos']);
      setOpenDialog(false);
      resetForm();
      Swal.fire({
        icon: 'success',
        title: '¡Proyecto creado!',
        text: 'El proyecto ha sido creado exitosamente',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#aae6d9',
        timer: 2000,
        showConfirmButton: false,
      });
    },
    onError: (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.detail || 'Error creando proyecto',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#e6b0aa',
      });
    },
  });
  
  // Mutación para eliminar proyecto
  const deleteMutation = useMutation({
    mutationFn: ({ id, permanente }) => proyectosAPI.deleteProyecto(id, permanente),
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
  
  // Filtrar proyectos por búsqueda
  const filteredProyectos = proyectos?.filter(proyecto => {
    const matchesSearch = !searchTerm || 
      proyecto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proyecto.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterActivos ? proyecto.activo : true;
    
    return matchesSearch && matchesFilter;
  });
  
  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      tabla_padron: '',
      logo: null,
    });
  };
  
  const handleOpenDialog = () => {
    resetForm();
    setOpenDialog(true);
  };
  
  const handleCloseDialog = () => {
    setOpenDialog(false);
    resetForm();
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.tabla_padron) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos requeridos',
        text: 'Nombre y padrón son campos obligatorios',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#aae6d9',
      });
      return;
    }
    
    createMutation.mutate(formData);
  };
  
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
  
  const handleRestoreProject = async (proyectoId) => {
    try {
      await proyectosAPI.restaurarProyecto(proyectoId);
      queryClient.invalidateQueries(['proyectos']);
      Swal.fire({
        icon: 'success',
        title: '¡Restaurado!',
        text: 'El proyecto ha sido restaurado',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#aae6d9',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.detail || 'Error restaurando proyecto',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#e6b0aa',
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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
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
              onClick={handleOpenDialog}
              sx={{ height: 48 }}
            >
              Nuevo Proyecto
            </CustomButton>
          )}
        </Box>
        
        {/* Filtros y búsqueda */}
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar proyectos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <AiOutlineSearch style={{ marginRight: 8, color: '#aae6d9' }} />,
                }}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={filterActivos}
                      onChange={(e) => setFilterActivos(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Mostrar solo activos"
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AiOutlineFilter />}
                  onClick={() => {
                    setSearchTerm('');
                    setFilterActivos(true);
                  }}
                  sx={{ borderRadius: 2 }}
                >
                  Limpiar filtros
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Box>
      
      {/* Tabs */}
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
            icon={<AiOutlineProject style={{ marginRight: 8 }} />} 
            iconPosition="start" 
            label="Activos" 
          />
          <Tab 
            icon={<AiOutlineFileText style={{ marginRight: 8 }} />} 
            iconPosition="start" 
            label="Inactivos" 
          />
          {isAdmin && (
            <Tab 
              icon={<BiArchive style={{ marginRight: 8 }} />} 
              iconPosition="start" 
              label="Eliminados" 
            />
          )}
        </Tabs>
      </Paper>
      
      {/* Lista de proyectos */}
      {filteredProyectos?.length === 0 ? (
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
            {tabValue === 2 ? 'No hay proyectos eliminados' : 
             tabValue === 1 ? 'No hay proyectos inactivos' : 
             'No hay proyectos activos'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {isAdmin && tabValue !== 2 ? 'Crea tu primer proyecto para comenzar' :
             'Espera a que un administrador asigne proyectos'}
          </Typography>
          {isAdmin && tabValue !== 2 && (
            <CustomButton
              icon="add"
              onClick={handleOpenDialog}
            >
              Crear Primer Proyecto
            </CustomButton>
          )}
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredProyectos?.map((proyecto) => (
            <Grid item xs={12} sm={6} md={4} key={proyecto.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  opacity: proyecto.is_deleted ? 0.7 : 1,
                  border: proyecto.is_deleted ? '2px dashed #e6b0aa' : 'none',
                }}
              >
                {/* Logo del proyecto */}
                {proyecto.logo ? (
                  <CardMedia
                    component="img"
                    height="140"
                    image={proyecto.logo}
                    alt={proyecto.nombre}
                    sx={{ objectFit: 'contain', p: 2, bgcolor: '#f8f9fa' }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 140,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #aae6d9, #e6b0aa)',
                    }}
                  >
                    <AiOutlineProject size={64} color="#ffffff" />
                  </Box>
                )}
                
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" fontWeight={600} noWrap sx={{ maxWidth: '70%' }}>
                      {proyecto.nombre}
                    </Typography>
                    <Box>
                      {proyecto.is_deleted ? (
                        <Chip
                          label="Eliminado"
                          size="small"
                          sx={{
                            bgcolor: 'rgba(230, 176, 170, 0.2)',
                            color: '#b27a75',
                            fontWeight: 500,
                          }}
                        />
                      ) : (
                        <Chip
                          label={proyecto.activo ? 'Activo' : 'Inactivo'}
                          size="small"
                          color={proyecto.activo ? 'success' : 'default'}
                          sx={{ 
                            bgcolor: proyecto.activo ? 'rgba(129, 199, 132, 0.2)' : 'rgba(161, 161, 161, 0.2)',
                            color: proyecto.activo ? '#2e7d32' : '#616161',
                          }}
                        />
                      )}
                    </Box>
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
                  
                  {/* Estadísticas rápidas */}
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AiOutlineTeam size={14} color="#a1a1a1" />
                        <Typography variant="caption" color="text.secondary">
                          {proyecto.nombre_padron ? proyecto.nombre_padron.split('_').pop() : 'Sin padrón'}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  
                  {/* Fecha de creación */}
                  <Typography variant="caption" color="text.secondary">
                    Creado: {new Date(proyecto.fecha_creacion).toLocaleDateString('es-MX')}
                  </Typography>
                </CardContent>
                
                <CardActions sx={{ p: 2, pt: 0 }}>
                  <CustomButton
                    size="small"
                    icon="view"
                    variant="outlined"
                    onClick={() => navigate(`/proyectos/${proyecto.id}`)}
                    sx={{ flexGrow: 1 }}
                    disabled={proyecto.is_deleted}
                  >
                    {proyecto.is_deleted ? 'Ver Detalles' : 'Abrir'}
                  </CustomButton>
                  
                  {isAdmin && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {proyecto.is_deleted ? (
                        <>
                          <Tooltip title="Restaurar">
                            <IconButton
                              size="small"
                              onClick={() => handleRestoreProject(proyecto.id)}
                              sx={{ color: 'primary.main' }}
                            >
                              <AiOutlineRest />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar permanentemente">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteClick(proyecto, true)}
                              sx={{ color: 'error.main' }}
                            >
                              <BiTrash />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </Box>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      {/* Diálogo para crear proyecto */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #aae6d9, #e6b0aa)',
          color: '#ffffff',
          fontWeight: 600,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AiOutlinePlus />
            Nuevo Proyecto
          </Box>
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre del proyecto"
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  required
                  helperText="Nombre único para identificar el proyecto"
                  sx={{ mb: 2 }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Descripción"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  multiline
                  rows={3}
                  helperText="Describe el propósito de este proyecto"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Padrón asociado</InputLabel>
                  <Select
                    value={formData.tabla_padron}
                    label="Padrón asociado"
                    onChange={(e) => setFormData({...formData, tabla_padron: e.target.value})}
                  >
                    <MenuItem value="">
                      <em>Seleccionar padrón</em>
                    </MenuItem>
                    {padrones?.map((padron) => (
                      <MenuItem key={padron.uuid} value={padron.uuid}>
                        {padron.nombre_tabla} 
                        {padron.descripcion && ` - ${padron.descripcion.substring(0, 30)}...`}
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Selecciona la tabla de padrón que usará este proyecto
                  </Typography>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Logo del proyecto (opcional)
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                  sx={{ borderRadius: 2 }}
                >
                  {formData.logo?.name || 'Seleccionar imagen'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        setFormData({...formData, logo: e.target.files[0]});
                      }
                    }}
                  />
                </Button>
                {formData.logo && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Archivo seleccionado: {formData.logo.name}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={handleCloseDialog} color="inherit">
              Cancelar
            </Button>
            <CustomButton
              type="submit"
              icon="confirm"
              isLoading={createMutation.isPending}
            >
              Crear Proyecto
            </CustomButton>
          </DialogActions>
        </form>
      </Dialog>
      
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
              El proyecto se marcará como eliminado pero podrá restaurarse más tarde.
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