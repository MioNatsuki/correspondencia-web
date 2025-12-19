import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import CustomButton from '../../components/ui/CustomButton';
import { proyectosAPI } from '../../api/proyectos';
import { padronesAPI } from '../../api/padrones';
import Swal from 'sweetalert2';

// Iconos
import {
  AiOutlineArrowLeft,
  AiOutlineSave,
  AiOutlineDelete,
  AiOutlineUpload,
  AiOutlineProject,
  AiOutlineInfoCircle,
} from 'react-icons/ai';

const EditarProyecto = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tabla_padron: '',
    activo: true,
    logo: null,
    logoPreview: null,
  });
  
  const [logoFile, setLogoFile] = useState(null);
  const [eliminarLogo, setEliminarLogo] = useState(false);
  
  // Obtener datos del proyecto
  const { data: proyecto, isLoading, error } = useQuery({
    queryKey: ['proyecto', id],
    queryFn: () => proyectosAPI.getProyecto(id),
    enabled: !!id,
  });
  
  // Obtener padrones REALES
  const { data: padrones, isLoading: isLoadingPadrones } = useQuery({
    queryKey: ['padrones'],
    queryFn: () => padronesAPI.getPadrones({ activos: true }),
    enabled: !!id || true, // Siempre cargar padrones
  });
  
  // Mutación para actualizar
  const updateMutation = useMutation({
    mutationFn: (data) => proyectosAPI.updateProyecto(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['proyecto', id]);
      queryClient.invalidateQueries(['proyectos']);
      
      Swal.fire({
        icon: 'success',
        title: '¡Proyecto actualizado!',
        text: 'Los cambios han sido guardados exitosamente',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#aae6d9',
        timer: 2000,
        showConfirmButton: false,
      }).then(() => {
        navigate(`/proyectos/${id}`);
      });
    },
    onError: (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.detail || 'Error actualizando proyecto',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#e6b0aa',
      });
    },
  });
  
  // Cargar datos del proyecto cuando se obtengan
  useEffect(() => {
    if (proyecto) {
      setFormData({
        nombre: proyecto.nombre || '',
        descripcion: proyecto.descripcion || '',
        tabla_padron: proyecto.tabla_padron || '', // UUID del padrón
        activo: proyecto.activo !== undefined ? proyecto.activo : true,
        logoPreview: proyecto.logo || null,
      });
    }
  }, [proyecto]);
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setEliminarLogo(false);
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          logoPreview: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleRemoveLogo = () => {
    setLogoFile(null);
    setEliminarLogo(true);
    setFormData(prev => ({
      ...prev,
      logoPreview: null
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'El nombre del proyecto es obligatorio',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#aae6d9',
      });
      return;
    }
    
    if (!formData.tabla_padron) {
      Swal.fire({
        icon: 'warning',
        title: 'Campo requerido',
        text: 'Debes seleccionar un padrón',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#aae6d9',
      });
      return;
    }
    
    // Preparar datos para enviar
    const dataToSend = new FormData();
    dataToSend.append('nombre', formData.nombre);
    dataToSend.append('descripcion', formData.descripcion);
    dataToSend.append('tabla_padron', formData.tabla_padron); // UUID del padrón
    dataToSend.append('activo', formData.activo);
    dataToSend.append('eliminar_logo', eliminarLogo);
    
    if (logoFile) {
      dataToSend.append('logo', logoFile);
    }
    
    updateMutation.mutate(dataToSend);
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
            <Button color="inherit" size="small" onClick={() => navigate('/proyectos')}>
              Volver
            </Button>
          }
        >
          Error cargando proyecto: {error.message}
        </Alert>
      </Container>
    );
  }
  
  if (!isAdmin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="warning">
          No tienes permisos para editar proyectos
        </Alert>
        <Button
          startIcon={<AiOutlineArrowLeft />}
          onClick={() => navigate(`/proyectos/${id}`)}
          sx={{ mt: 2 }}
        >
          Volver al proyecto
        </Button>
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
        <Link component={RouterLink} to={`/proyectos/${id}`} underline="hover" color="inherit">
          {proyecto?.nombre || 'Proyecto'}
        </Link>
        <Typography color="text.primary">Editar</Typography>
      </Breadcrumbs>
      
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
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
              Editar Proyecto
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Modifica la información del proyecto
            </Typography>
          </Box>
        </Box>
      </Paper>
      
      {/* Formulario */}
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* Columna izquierda - Información básica */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#7ab3a5', mb: 3 }}>
                Información Básica
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nombre del proyecto *"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                    helperText="Nombre único para identificar el proyecto"
                    sx={{ mb: 2 }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Descripción"
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleChange}
                    multiline
                    rows={3}
                    helperText="Describe el propósito de este proyecto"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControl fullWidth required>
                    <InputLabel>Padrón asociado *</InputLabel>
                    <Select
                      name="tabla_padron"
                      value={formData.tabla_padron}
                      label="Padrón asociado *"
                      onChange={handleChange}
                      disabled={isLoadingPadrones}
                    >
                      <MenuItem value="">
                        <em>{isLoadingPadrones ? 'Cargando padrones...' : 'Seleccionar padrón'}</em>
                      </MenuItem>
                      {padrones?.map((padron) => (
                        <MenuItem key={padron.uuid_padron} value={padron.uuid_padron}>
                          {/* Mostrar nombre_tabla (como en Python) */}
                          {padron.nombre_tabla} 
                          {padron.descripcion && ` - ${padron.descripcion.substring(0, 30)}...`}
                        </MenuItem>
                      ))}
                    </Select>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Selecciona el padrón que usará este proyecto (se guarda el UUID)
                    </Typography>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2">
                      Estado del proyecto:
                    </Typography>
                    <Button
                      variant={formData.activo ? "contained" : "outlined"}
                      size="small"
                      onClick={() => setFormData(prev => ({ ...prev, activo: true }))}
                      sx={{
                        bgcolor: formData.activo ? '#aae6d9' : 'transparent',
                        color: formData.activo ? '#2c3e50' : 'text.secondary',
                        borderRadius: 2,
                      }}
                    >
                      Activo
                    </Button>
                    <Button
                      variant={!formData.activo ? "contained" : "outlined"}
                      size="small"
                      onClick={() => setFormData(prev => ({ ...prev, activo: false }))}
                      sx={{
                        bgcolor: !formData.activo ? '#e6b0aa' : 'transparent',
                        color: !formData.activo ? '#2c3e50' : 'text.secondary',
                        borderRadius: 2,
                      }}
                    >
                      Inactivo
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          
          {/* Columna derecha - Logo */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom fontWeight={600} sx={{ color: '#b27a75', mb: 3 }}>
                Logo del Proyecto
              </Typography>
              
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                {formData.logoPreview ? (
                  <>
                    <Avatar
                      src={formData.logoPreview}
                      sx={{
                        width: 150,
                        height: 150,
                        mx: 'auto',
                        mb: 2,
                        border: '3px solid #ffffff',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <Button
                      variant="outlined"
                      color="secondary"
                      size="small"
                      startIcon={<AiOutlineDelete />}
                      onClick={handleRemoveLogo}
                      sx={{ borderRadius: 2 }}
                    >
                      Eliminar Logo
                    </Button>
                  </>
                ) : (
                  <Box
                    sx={{
                      width: 150,
                      height: 150,
                      borderRadius: '50%',
                      bgcolor: 'rgba(170, 230, 217, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                      border: '2px dashed #aae6d9',
                    }}
                  >
                    <AiOutlineProject size={64} color="#aae6d9" />
                  </Box>
                )}
              </Box>
              
              <Button
                variant="outlined"
                component="label"
                fullWidth
                startIcon={<AiOutlineUpload />}
                sx={{ borderRadius: 2, mb: 1 }}
              >
                {logoFile ? 'Cambiar imagen' : 'Seleccionar imagen'}
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleLogoChange}
                />
              </Button>
              
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                Formatos: PNG, JPG, GIF, SVG
                <br />
                Tamaño máximo: 5MB
              </Typography>
              
              {logoFile && (
                <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                  Nueva imagen seleccionada: {logoFile.name}
                </Alert>
              )}
            </Paper>
            
            {/* Información adicional */}
            <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'rgba(200, 203, 193, 0.05)' }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: '#9a9d94' }}>
                <AiOutlineInfoCircle style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Información adicional
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  <strong>ID:</strong> {id}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  <strong>Creado:</strong> {proyecto?.fecha_creacion ? 
                    new Date(proyecto.fecha_creacion).toLocaleDateString('es-MX') : 'N/A'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  <strong>Plantillas:</strong> {proyecto?.num_plantillas || 0}
                </Typography>
                {proyecto?.tabla_padron && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    <strong>UUID Padrón:</strong> {proyecto.tabla_padron.substring(0, 8)}...
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
        
        {/* Acciones */}
        <Paper sx={{ p: 3, mt: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              startIcon={<AiOutlineArrowLeft />}
              onClick={() => navigate(`/proyectos/${id}`)}
              sx={{ borderRadius: 2 }}
            >
              Cancelar
            </Button>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <CustomButton
                type="submit"
                icon="confirm"
                isLoading={updateMutation.isPending}
                sx={{ minWidth: 120 }}
              >
                Guardar Cambios
              </CustomButton>
            </Box>
          </Box>
        </Paper>
      </form>
    </Container>
  );
};

export default EditarProyecto;