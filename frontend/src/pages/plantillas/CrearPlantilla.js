// frontend/src/pages/plantillas/CrearPlantilla.js
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
  CircularProgress
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AiOutlineArrowLeft, AiOutlineUpload, AiOutlineFilePdf } from 'react-icons/ai';
import { plantillasAPI } from '../../api/plantillas';

const steps = ['Información básica', 'Subir PDF base', 'Configuración inicial'];

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
  
  // Mutación para crear plantilla
  const createMutation = useMutation({
    mutationFn: (formData) => {
      const data = new FormData();
      data.append('nombre', formData.nombre);
      data.append('descripcion', formData.descripcion || '');
      data.append('proyecto_id', proyectoId);
      data.append('ruta_archivo', formData.pdfFile);
      
      return plantillasAPI.createPlantilla(data);
    },
    onSuccess: (data) => {
      // Navegar al editor con la nueva plantilla
      navigate(`/plantillas/${data.id}/editor`);
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    }
  });
  
  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 0) {
      if (!formData.nombre.trim()) {
        newErrors.nombre = 'El nombre es requerido';
      }
    }
    
    if (step === 1) {
      if (!formData.pdfFile) {
        newErrors.pdfFile = 'Debes subir un archivo PDF';
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
      if (file.type !== 'application/pdf') {
        setErrors({ pdfFile: 'Solo se permiten archivos PDF' });
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB
        setErrors({ pdfFile: 'El archivo no debe exceder 10MB' });
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        pdfFile: file,
        pdfPreview: URL.createObjectURL(file)
      }));
      
      if (errors.pdfFile) {
        setErrors(prev => ({ ...prev, pdfFile: null }));
      }
    }
  };
  
  const handleSubmit = () => {
    createMutation.mutate(formData);
  };
  
  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 3 }}>
            <TextField
              fullWidth
              label="Nombre de la plantilla"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              error={!!errors.nombre}
              helperText={errors.nombre}
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
              rows={4}
              placeholder="Describe el propósito de esta plantilla..."
            />
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Ejemplo: "Carta de cobranza para clientes morosos", "Notificación de vencimiento", etc.
            </Typography>
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
                  borderRadius: 3
                }}
              >
                Seleccionar archivo PDF
              </Button>
            </label>
            
            {errors.pdfFile && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errors.pdfFile}
              </Alert>
            )}
            
            {formData.pdfFile && (
              <Box sx={{ mt: 3 }}>
                <Paper sx={{ p: 2, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <AiOutlineFilePdf size={32} color="#e74c3c" />
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      {formData.pdfFile.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(formData.pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </Typography>
                  </Box>
                </Paper>
                
                <Alert severity="info" sx={{ mt: 2 }}>
                  Asegúrate de que el PDF esté en tamaño OFICIO MEXICO (21.6cm × 35.6cm) para mejores resultados.
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
                Resumen:
              </Typography>
              <Box sx={{ pl: 2 }}>
                <Typography variant="body2">
                  • Nombre: <strong>{formData.nombre}</strong>
                </Typography>
                <Typography variant="body2">
                  • Archivo: <strong>{formData.pdfFile?.name || 'No seleccionado'}</strong>
                </Typography>
                <Typography variant="body2">
                  • Proyecto ID: <strong>{proyectoId || 'No especificado'}</strong>
                </Typography>
              </Box>
            </Paper>
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
            {proyectoId ? `Para proyecto: ${proyectoId}` : 'Sin proyecto asignado'}
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
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            Atrás
          </Button>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              onClick={() => navigate(-1)}
              variant="outlined"
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