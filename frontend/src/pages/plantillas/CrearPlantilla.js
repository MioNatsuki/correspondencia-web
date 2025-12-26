// frontend/src/pages/plantillas/CrearPlantilla.js - VERSIÓN CORREGIDA
import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Grid,
  IconButton,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AiOutlineArrowLeft, AiOutlineUpload, AiOutlineFilePdf } from 'react-icons/ai';
import { plantillasAPI } from '../../api/plantillas';

const steps = ['Información básica', 'Subir PDF base', 'Confirmar'];

const CrearPlantilla = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const proyectoId = queryParams.get('proyecto');
  
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    pdfFile: null,
    pdfPreview: null
  });
  const [errors, setErrors] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Mutación para crear plantilla - CORREGIDA
  const createMutation = useMutation({
    mutationFn: (data) => {
      const formData = new FormData();
      formData.append('nombre', data.nombre);
      if (data.descripcion) {
        formData.append('descripcion', data.descripcion);
      }
      formData.append('proyecto_id', proyectoId);
      formData.append('pdf_file', data.pdfFile); // ← NOMBRE CORRECTO: pdf_file
      
      return plantillasAPI.createPlantilla(formData);
    },
    onSuccess: (response) => {
      console.log('Plantilla creada exitosamente:', response);
      // Navegar al editor con la nueva plantilla
      navigate(`/plantillas/${response.id}/editor`);
    },
    onError: (error) => {
      console.error('Error creando plantilla:', error);
      setErrors({ 
        submit: error.response?.data?.detail || error.message || 'Error desconocido' 
      });
    }
  });
  
  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 0) {
      if (!formData.nombre.trim()) {
        newErrors.nombre = 'El nombre es requerido';
      }
      if (!proyectoId) {
        newErrors.proyecto = 'Se requiere un proyecto';
      }
    }
    
    if (step === 1) {
      if (!formData.pdfFile) {
        newErrors.pdfFile = 'Debes subir un archivo PDF';
      } else if (formData.pdfFile.type !== 'application/pdf') {
        newErrors.pdfFile = 'Solo se permiten archivos PDF';
      } else if (formData.pdfFile.size > 10 * 1024 * 1024) {
        newErrors.pdfFile = 'El archivo no debe exceder 10MB';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleNext = () => {
    if (validateStep(activeStep)) {
      if (activeStep === steps.length - 1) {
        handleSubmit();
      } else {
        setActiveStep((prevStep) => prevStep + 1);
      }
    }
  };
  
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('Archivo seleccionado:', file.name, file.type, file.size);
      
      // Validaciones
      const validations = [];
      
      if (file.type !== 'application/pdf') {
        validations.push('Solo se permiten archivos PDF');
      }
      
      if (file.size > 10 * 1024 * 1024) {
        validations.push('El archivo no debe exceder 10MB');
      }
      
      if (validations.length > 0) {
        setErrors({ pdfFile: validations.join(', ') });
        return;
      }
      
      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({
          ...prev,
          pdfFile: file,
          pdfPreview: e.target.result
        }));
      };
      reader.readAsDataURL(file);
      
      if (errors.pdfFile) {
        setErrors(prev => ({ ...prev, pdfFile: null }));
      }
    }
  };
  
  const handleSubmit = () => {
    if (!formData.nombre || !formData.pdfFile) {
      setErrors({ submit: 'Nombre y PDF son requeridos' });
      return;
    }
    
    if (!proyectoId) {
      setErrors({ submit: 'Se requiere un proyecto' });
      return;
    }
    
    // Simular progreso de upload
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);
    
    createMutation.mutate(formData, {
      onSettled: () => {
        clearInterval(interval);
        setUploadProgress(100);
      }
    });
  };
  
  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 3 }}>
            <TextField
              fullWidth
              label="Nombre de la plantilla *"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              error={!!errors.nombre}
              helperText={errors.nombre || "Ej: 'Carta de cobranza', 'Notificación de vencimiento'"}
              required
              sx={{ mb: 3 }}
            />
            
            <TextField
              fullWidth
              label="Descripción (opcional)"
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              multiline
              rows={3}
              placeholder="Describe el propósito de esta plantilla..."
            />
            
            {errors.proyecto && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errors.proyecto}
              </Alert>
            )}
          </Box>
        );
        
      case 1:
        return (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <input
              accept=".pdf"
              style={{ display: 'none' }}
              id="pdf-upload"
              type="file"
              onChange={handleFileChange}
            />
            
            <label htmlFor="pdf-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<AiOutlineUpload />}
                sx={{ 
                  py: 2, 
                  px: 4,
                  mb: 3,
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  borderColor: errors.pdfFile ? 'error.main' : '#aae6d9',
                  borderRadius: 3,
                  '&:hover': {
                    borderColor: errors.pdfFile ? 'error.dark' : '#7ab3a5',
                    backgroundColor: 'rgba(170, 230, 217, 0.05)'
                  }
                }}
              >
                {formData.pdfFile ? 'Cambiar archivo PDF' : 'Seleccionar archivo PDF'}
              </Button>
            </label>
            
            {errors.pdfFile && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errors.pdfFile}
              </Alert>
            )}
            
            {formData.pdfFile && (
              <Box sx={{ mt: 3 }}>
                <Paper sx={{ 
                  p: 2, 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 2,
                  border: '1px solid #aae6d9'
                }}>
                  <AiOutlineFilePdf size={32} color="#e74c3c" />
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      {formData.pdfFile.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(formData.pdfFile.size / 1024 / 1024).toFixed(2)} MB • PDF
                    </Typography>
                  </Box>
                </Paper>
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    Asegúrate de que el PDF esté en tamaño OFICIO MEXICO (21.6cm × 35.6cm) para mejores resultados.
                  </Typography>
                </Alert>
              </Box>
            )}
          </Box>
        );
        
      case 2:
        return (
          <Box sx={{ mt: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                La plantilla se creará con configuración básica. Podrás personalizar los campos, 
                fuentes y estilos en el editor que se abrirá a continuación.
              </Typography>
            </Alert>
            
            <Paper sx={{ p: 3, bgcolor: 'rgba(170, 230, 217, 0.1)' }}>
              <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                Resumen de creación:
              </Typography>
              <Box sx={{ pl: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  • <strong>Nombre:</strong> {formData.nombre || 'No especificado'}
                </Typography>
                {formData.descripcion && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>Descripción:</strong> {formData.descripcion}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ mb: 1 }}>
                  • <strong>Archivo PDF:</strong> {formData.pdfFile?.name || 'No seleccionado'}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  • <strong>Proyecto ID:</strong> {proyectoId || 'No especificado'}
                </Typography>
              </Box>
            </Paper>
            
            {createMutation.isLoading && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Subiendo archivo y creando plantilla...
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={uploadProgress}
                  sx={{ mt: 1 }}
                />
              </Box>
            )}
          </Box>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <IconButton onClick={() => navigate(-1)}>
          <AiOutlineArrowLeft />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Crear Nueva Plantilla
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {proyectoId ? `Para proyecto ID: ${proyectoId}` : 'Sin proyecto asignado'}
          </Typography>
        </Box>
      </Box>
      
      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>
      
      {/* Form content */}
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        {renderStepContent(activeStep)}
        
        {errors.submit && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {errors.submit}
          </Alert>
        )}
        
        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            disabled={activeStep === 0 || createMutation.isLoading}
            onClick={handleBack}
            variant="outlined"
          >
            Atrás
          </Button>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              onClick={() => navigate(-1)}
              variant="outlined"
              disabled={createMutation.isLoading}
            >
              Cancelar
            </Button>
            
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={createMutation.isLoading}
              sx={{ 
                bgcolor: '#aae6d9',
                '&:hover': { bgcolor: '#7ab3a5' },
                minWidth: 120
              }}
            >
              {createMutation.isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : activeStep === steps.length - 1 ? (
                'Crear Plantilla'
              ) : (
                'Siguiente'
              )}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default CrearPlantilla;