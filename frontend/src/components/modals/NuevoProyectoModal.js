import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  Avatar,
  Button,
  IconButton,
  Grid,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proyectosAPI } from '../../api/proyectos';
import { padronesAPI } from '../../api/padrones';
import CustomButton from '../ui/CustomButton';
import Swal from 'sweetalert2';

// Iconos
import { AiOutlineClose, AiOutlineProject, AiOutlineUpload, AiOutlineDelete, AiOutlineInfoCircle } from 'react-icons/ai';

const NuevoProyectoModal = ({ open, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tabla_padron: '', // UUID del padrón
  });
  
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  
  // Obtener padrones REALES
  const { 
    data: padrones = [], 
    isLoading: isLoadingPadrones, 
    error: errorPadrones,
    refetch: refetchPadrones 
  } = useQuery({
    queryKey: ['padrones-modal'],
    queryFn: () => padronesAPI.getPadrones({ activos: true }),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
  
  // Mutación para crear proyecto
  const createMutation = useMutation({
    mutationFn: (data) => {
      console.log('📤 Enviando datos para crear proyecto:', data);
      return proyectosAPI.createProyecto(data);
    },
    onSuccess: (data) => {
      console.log('✅ Proyecto creado:', data);
      queryClient.invalidateQueries(['proyectos']);
      
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
      
      resetForm();
      onClose();
      if (onSuccess) onSuccess(data);
    },
    onError: (error) => {
      console.error('❌ Error creando proyecto:', error);
      let errorMsg = 'Error creando proyecto';
      if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: errorMsg,
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#e6b0aa',
      });
    },
  });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tamaño (5MB)
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire({
          icon: 'warning',
          title: 'Archivo muy grande',
          text: 'El logo no debe exceder 5MB',
          confirmButtonColor: '#aae6d9',
        });
        return;
      }
      
      // Validar tipo
      const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        Swal.fire({
          icon: 'warning',
          title: 'Formato no válido',
          text: 'Solo se aceptan JPEG, PNG o GIF',
          confirmButtonColor: '#aae6d9',
        });
        return;
      }
      
      setLogoFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('📝 Validando formulario:', formData);
    
    // Validaciones básicas
    if (!formData.nombre || formData.nombre.trim() === '') {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre requerido',
        text: 'El nombre del proyecto es obligatorio',
        confirmButtonColor: '#aae6d9',
      });
      return;
    }
    
    if (!formData.tabla_padron) {
      Swal.fire({
        icon: 'warning',
        title: 'Padrón requerido',
        text: 'Debes seleccionar un padrón',
        confirmButtonColor: '#aae6d9',
      });
      return;
    }
    
    // Preparar FormData
    const formDataToSend = new FormData();
    formDataToSend.append('nombre', formData.nombre.trim());
    formDataToSend.append('descripcion', formData.descripcion?.trim() || '');
    formDataToSend.append('tabla_padron', formData.tabla_padron);
    
    if (logoFile) {
      formDataToSend.append('logo', logoFile);
    }
    
    // Debug: Ver qué se envía
    console.log('🚀 Enviando FormData:');
    for (let [key, value] of formDataToSend.entries()) {
      console.log(`${key}:`, value);
    }
    
    createMutation.mutate(formDataToSend);
  };
  
  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      tabla_padron: '',
    });
    setLogoFile(null);
    setLogoPreview(null);
  };
  
  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  // Si hay error cargando padrones, mostrar opción para reintentar
  const handleRetryPadrones = () => {
    refetchPadrones();
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid rgba(0,0,0,0.05)', 
        pb: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'rgba(170, 230, 217, 0.05)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #aae6d9, #e6b0aa)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AiOutlineProject size={24} color="#ffffff" />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Crear Nuevo Proyecto
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Completa la información básica del proyecto
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} size="small" disabled={createMutation.isPending}>
          <AiOutlineClose />
        </IconButton>
      </DialogTitle>
      
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={3}>
            {/* Columna izquierda - Formulario */}
            <Grid item xs={12} md={logoPreview ? 8 : 12}>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Nombre del proyecto *"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                  helperText="Nombre único para identificar el proyecto"
                  sx={{ mb: 2 }}
                  autoFocus
                  disabled={createMutation.isPending}
                />
                
                <TextField
                  fullWidth
                  label="Descripción"
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleChange}
                  multiline
                  rows={3}
                  helperText="Describe el propósito de este proyecto"
                  sx={{ mb: 2 }}
                  disabled={createMutation.isPending}
                />
                
                <FormControl fullWidth required error={!!errorPadrones} disabled={createMutation.isPending}>
                  <InputLabel>Seleccionar padrón *</InputLabel>
                  <Select
                    name="tabla_padron"
                    value={formData.tabla_padron}
                    label="Seleccionar padrón *"
                    onChange={handleChange}
                    disabled={isLoadingPadrones || createMutation.isPending}
                    sx={{ mb: 1 }}
                  >
                    <MenuItem value="">
                      <em>
                        {isLoadingPadrones ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={16} />
                            <span>Cargando padrones...</span>
                          </Box>
                        ) : '-- Seleccione un padrón --'}
                      </em>
                    </MenuItem>
                    {padrones.map((padron) => (
                      <MenuItem key={padron.uuid_padron} value={padron.uuid_padron}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {padron.nombre_tabla}
                          </Typography>
                          {padron.descripcion && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {padron.descripcion}
                            </Typography>
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  {errorPadrones ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      <Typography variant="caption" color="error">
                        Error cargando padrones
                      </Typography>
                      <Button size="small" onClick={handleRetryPadrones}>
                        Reintentar
                      </Button>
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      Selecciona el padrón que usará este proyecto
                    </Typography>
                  )}
                </FormControl>
              </Box>
            </Grid>
            
            {/* Columna derecha - Logo (solo si hay preview) */}
            {logoPreview && (
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, color: '#7ab3a5' }}>
                    Vista previa del logo
                  </Typography>
                  
                  <Avatar
                    src={logoPreview}
                    sx={{
                      width: 120,
                      height: 120,
                      mx: 'auto',
                      mb: 2,
                      border: '3px solid #ffffff',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Button
                    variant="outlined"
                    color="secondary"
                    size="small"
                    startIcon={<AiOutlineDelete />}
                    onClick={handleRemoveLogo}
                    sx={{ borderRadius: 2 }}
                    disabled={createMutation.isPending}
                  >
                    Eliminar logo
                  </Button>
                </Box>
              </Grid>
            )}
          </Grid>
          
          {/* Sección de logo (si no hay preview) */}
          {!logoPreview && (
            <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(170, 230, 217, 0.05)', borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: '#7ab3a5' }}>
                <AiOutlineInfoCircle style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Logo del proyecto (opcional)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  size="small"
                  startIcon={<AiOutlineUpload />}
                  sx={{ borderRadius: 2 }}
                  disabled={createMutation.isPending}
                >
                  Seleccionar logo
                  <input
                    type="file"
                    hidden
                    accept="image/jpeg,image/png,image/gif"
                    onChange={handleLogoChange}
                    disabled={createMutation.isPending}
                  />
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Formatos: JPEG, PNG, GIF • Máx. 5MB
                </Typography>
              </Box>
            </Box>
          )}
          
          {createMutation.isError && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
              Error al crear proyecto. Revisa la consola para más detalles.
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3, borderTop: '1px solid rgba(0,0,0,0.05)', pt: 2 }}>
          <Button 
            onClick={handleClose} 
            color="inherit"
            disabled={createMutation.isPending}
          >
            Cancelar
          </Button>
          <CustomButton
            type="submit"
            icon="confirm"
            isLoading={createMutation.isPending}
            disabled={!formData.nombre || !formData.tabla_padron || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creando...' : 'Crear Proyecto'}
          </CustomButton>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default NuevoProyectoModal;