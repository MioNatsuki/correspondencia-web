// frontend/src/pages/plantillas/EditorPlantilla.js - VERSION CORREGIDA
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Grid,
  Typography,
  Button,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Snackbar,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AiOutlineEye,
  AiOutlineEdit,
  AiOutlineSave,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineHome,
  AiOutlineReload,
  AiOutlineWarning,
} from 'react-icons/ai';
import MuiAlert from '@mui/material/Alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import EditorToolbar from '../../components/editor/EditorToolbar';
import FieldsPanel from '../../components/editor/FieldsPanel';
import PropertiesPanel from '../../components/editor/PropertiesPanel';
import TemplateCanvas from '../../components/editor/TemplateCanvas';

import { plantillasAPI } from '../../api/plantillas';
import { UPLOADS_BASE_URL } from '../../utils/constants';

const AlertComponent = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const EditorPlantilla = () => {
  const { plantillaId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Refs
  const canvasRef = useRef(null);
  const originalStateRef = useRef(null);

  // Estados
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [mode, setMode] = useState('edit'); // 'edit' | 'preview'
  const [previewIndex, setPreviewIndex] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [forceRerender, setForceRerender] = useState(0);
  const [showInactiveAlert, setShowInactiveAlert] = useState(false);

  // ==================== QUERIES ====================
  const {
    data: plantilla,
    isLoading: loadingPlantilla,
    error: errorPlantilla,
    refetch: refetchPlantilla,
  } = useQuery({
    queryKey: ['plantilla', plantillaId],
    queryFn: () => plantillasAPI.getPlantilla(plantillaId),
    enabled: !!plantillaId,
    onSuccess: (data) => {
      // Mostrar alerta si la plantilla está inactiva
      if (data && !data.activa) {
        setShowInactiveAlert(true);
      }
    },
  });

  // Campos disponibles del padrón
  const {
    data: camposData = { columnas: [] },
    isLoading: loadingCampos,
  } = useQuery({
    queryKey: ['campos-disponibles', plantillaId],
    queryFn: () => plantillasAPI.getCamposDisponibles(plantillaId),
    enabled: !!plantillaId,
  });

  // Datos de ejemplo para preview
  const {
    data: previewData = { datos: [] },
    isLoading: loadingPreview,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ['datos-ejemplo', plantillaId],
    queryFn: () => plantillasAPI.getDatosEjemplo(plantillaId, 10),
    enabled: !!plantillaId && mode === 'preview' && plantilla?.activa,
  });

  // Obtener campos existentes de la plantilla
  const {
    data: camposExistente = [],
    isLoading: loadingCamposExistente,
    refetch: refetchCamposExistente,
  } = useQuery({
    queryKey: ['campos-plantilla', plantillaId],
    queryFn: () => plantillasAPI.getCampos(plantillaId),
    enabled: !!plantillaId,
  });

  // ==================== MUTATIONS ====================
  const saveMutation = useMutation({
    mutationFn: (campos) => plantillasAPI.guardarCampos(plantillaId, campos),
    onSuccess: (response) => {
      showSnackbar(response.message || 'Campos guardados y plantilla activada', 'success');
      queryClient.invalidateQueries(['plantilla', plantillaId]);
      queryClient.invalidateQueries(['campos-plantilla', plantillaId]);
      refetchPlantilla();
      refetchCamposExistente();
      setShowInactiveAlert(false); // Ocultar alerta después de activar
    },
    onError: (error) => {
      showSnackbar(`Error al guardar: ${error.message || 'Error desconocido'}`, 'error');
    },
  });

  // ==================== CALLBACKS ====================
  const handleCanvasReady = useCallback((canvasInstance) => {
    console.log('Canvas listo en EditorPlantilla');
  }, []);

  const handleSelectionChanged = useCallback((objects) => {
    console.log('Objetos seleccionados:', objects?.length || 0);
    setSelectedObjects(objects || []);
  }, []);

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // ==================== MÉTODOS CANVAS ====================
  const addTextField = () => {
    if (canvasRef.current) {
      const textbox = canvasRef.current.addTextField({
        left: 100,
        top: 100,
        text: 'Nuevo texto',
        fontSize: 12,
        fontFamily: 'Arial',
        fill: '#000000',
        textAlign: 'left',
      });
      
      if (textbox) {
        console.log('Cuadro de texto agregado:', textbox);
      }
    } else {
      console.error('Canvas ref no disponible');
    }
  };

  const addDynamicField = (field) => {
    if (canvasRef.current && field) {
      const fieldName = field.nombre || field;
      const textbox = canvasRef.current.addDynamicField(fieldName, {
        left: 100,
        top: 150,
        fontSize: 12,
        fontFamily: 'Arial',
        fill: '#2196f3',
        textAlign: 'left',
      });
      
      if (textbox) {
        console.log('Campo dinámico agregado:', fieldName);
      }
    } else {
      console.error('Canvas ref no disponible o campo inválido');
    }
  };

  const handleSave = async () => {
    if (!canvasRef.current) {
      showSnackbar('El canvas no está listo', 'error');
      return;
    }

    try {
      const estado = canvasRef.current.getCanvasState();
      console.log('Estado del canvas para guardar:', estado);
      
      if (!estado.objects || estado.objects.length === 0) {
        showSnackbar('No hay campos para guardar', 'warning');
        return;
      }
      
      const campos = convertirEstadoACampos(estado);
      console.log('Campos convertidos:', campos);
      
      saveMutation.mutate(campos);
      
    } catch (error) {
      console.error('Error en handleSave:', error);
      showSnackbar(`Error guardando: ${error.message}`, 'error');
    }
  };

  const convertirEstadoACampos = (estado) => {
    if (!estado || !estado.objects) return [];
    
    return estado.objects.map((obj, index) => {
      const base = {
        nombre: obj.metadata?.nombre || `campo_${index + 1}`,
        tipo: obj.metadata?.fieldType === 'dynamic' ? 'campo' : 'texto',
        x: obj.left || 0,
        y: obj.top || 0,
        ancho: obj.width || 200,
        alto: obj.height || 40,
        alineacion: obj.textAlign || 'left',
        fuente: obj.fontFamily || 'Arial',
        tamano_fuente: obj.fontSize || 12,
        color: obj.fill || '#000000',
        negrita: obj.fontWeight === 'bold',
        cursiva: obj.fontStyle === 'italic',
        orden: index,
        activo: true
      };

      if (obj.metadata?.fieldType === 'dynamic') {
        return {
          ...base,
          columna_padron: obj.metadata.fieldName,
          texto_fijo: null
        };
      } else {
        return {
          ...base,
          texto_fijo: obj.text || '',
          columna_padron: null
        };
      }
    });
  };

  // ==================== VISTA PREVIA ====================
  const togglePreviewMode = () => {
    // No permitir vista previa si la plantilla está inactiva
    if (!plantilla?.activa) {
      showSnackbar('La plantilla debe estar activa para usar la vista previa', 'warning');
      return;
    }

    const newMode = mode === 'edit' ? 'preview' : 'edit';
    console.log(`Cambiando modo: ${mode} -> ${newMode}`);

    if (newMode === 'preview' && canvasRef.current) {
      // Guardar estado actual antes de entrar en preview
      try {
        const currentState = canvasRef.current.getCanvasState();
        originalStateRef.current = currentState;
        console.log('Estado guardado para preview:', currentState);
        
        if (canvasRef.current.fabricInstance) {
          canvasRef.current.fabricInstance.renderAll();
        }
      } catch (error) {
        console.error('Error guardando estado para preview:', error);
      }
      
      // Cargar datos para preview
      refetchPreview();
    }

    if (mode === 'preview' && newMode === 'edit' && originalStateRef.current && canvasRef.current) {
      // Restaurar estado original
      try {
        console.log('Restaurando estado desde preview:', originalStateRef.current);
        canvasRef.current.loadFields(originalStateRef.current.objects);
        originalStateRef.current = null;
      } catch (error) {
        console.error('Error restaurando estado desde preview:', error);
        showSnackbar('Error al volver al modo edición', 'error');
      }
    }

    setMode(newMode);
    setPreviewIndex(0);
  };

  // ==================== CARGA INICIAL ====================
  useEffect(() => {
    if (canvasRef.current && camposExistente.length > 0 && mode === 'edit') {
      console.log('Cargando campos existentes:', camposExistente);
      try {
        canvasRef.current.loadFields(camposExistente);
      } catch (error) {
        console.error('Error cargando campos iniciales:', error);
      }
    }
  }, [canvasRef.current, camposExistente, mode, forceRerender]);

  // Forzar recarga cuando cambia el modo
  useEffect(() => {
    setForceRerender(prev => prev + 1);
  }, [mode]);

  // ==================== MANEJO DE ERRORES ====================
  if (loadingPlantilla) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={60} />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Cargando plantilla...
        </Typography>
      </Box>
    );
  }

  if (errorPlantilla) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert 
          severity="error"
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => navigate('/plantillas')}
            >
              Volver
            </Button>
          }
        >
          Error cargando plantilla: {errorPlantilla.message || 'Error desconocido'}
        </Alert>
      </Container>
    );
  }

  // ==================== RENDER ====================
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f7fa' }}>
      {/* Diálogo de alerta para plantilla inactiva */}
      <Dialog
        open={showInactiveAlert && !plantilla?.activa}
        onClose={() => setShowInactiveAlert(false)}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AiOutlineWarning color="#ff9800" />
          <Typography variant="h6">Plantilla Inactiva</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Esta plantilla está marcada como <strong>inactiva</strong>.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Para poder usar esta plantilla en procesos de generación, debes guardar los cambios 
            primero. La plantilla se activará automáticamente al guardar.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Nota:</strong> La vista previa solo está disponible para plantillas activas.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInactiveAlert(false)}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>

      {/* Header */}
      <Paper sx={{
        p: 2,
        borderRadius: 0,
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        bgcolor: !plantilla?.activa ? 'rgba(255, 152, 0, 0.1)' : 'white',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} size="small">
            <AiOutlineHome />
          </IconButton>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" fontWeight={600}>
                {plantilla?.nombre || 'Editor de Plantilla'}
              </Typography>
              {!plantilla?.activa && (
                <Chip
                  label="INACTIVA"
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {mode === 'edit' ? 'Modo Edición' : 'Modo Vista Previa'}
              {mode === 'preview' && previewData?.datos && previewData.datos.length > 0 && (
                ` • Registro ${previewIndex + 1} de ${previewData.datos.length}`
              )}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {mode === 'preview' && previewData?.datos && previewData.datos.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
              <IconButton size="small" onClick={handlePrevPreview}>
                <AiOutlineArrowLeft />
              </IconButton>
              <Typography variant="body2" sx={{ mx: 1 }}>
                {previewIndex + 1} / {previewData.datos.length}
              </Typography>
              <IconButton size="small" onClick={handleNextPreview}>
                <AiOutlineArrowRight />
              </IconButton>
            </Box>
          )}

          <ToggleButtonGroup 
            value={mode} 
            exclusive 
            onChange={togglePreviewMode}
            size="small"
            disabled={!plantilla?.activa && mode !== 'edit'}
          >
            <ToggleButton value="edit">
              <AiOutlineEdit /> Editar
            </ToggleButton>
            <ToggleButton value="preview" disabled={!plantilla?.activa}>
              <AiOutlineEye /> Vista Previa
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="contained"
            startIcon={<AiOutlineSave />}
            onClick={handleSave}
            disabled={saveMutation.isPending || mode === 'preview'}
            sx={{ 
              ml: 2, 
              bgcolor: plantilla?.activa ? '#aae6d9' : '#ffb74d', 
              '&:hover': { 
                bgcolor: plantilla?.activa ? '#7ab3a5' : '#ff9800' 
              },
              minWidth: 120
            }}
          >
            {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>

          <IconButton
            size="small"
            onClick={() => {
              refetchPlantilla();
              refetchCamposExistente();
              showSnackbar('Datos recargados', 'info');
            }}
            title="Recargar datos"
          >
            <AiOutlineReload />
          </IconButton>
        </Box>
      </Paper>

      {/* Toolbar */}
      <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
        <EditorToolbar
          onAddTextField={addTextField}
          onAddDynamicField={(field) => addDynamicField(field)}
          onSave={handleSave}
          onPreview={togglePreviewMode}
          onUndo={() => console.log('Undo - Por implementar')}
          onRedo={() => console.log('Redo - Por implementar')}
          onDelete={() => {
            if (canvasRef.current && selectedObjects.length > 0) {
              canvasRef.current.removeSelected();
            }
          }}
          availableFields={camposData?.columnas || []}
          selectedObjects={selectedObjects}
          isPreviewMode={mode === 'preview'}
          readOnly={mode === 'preview' || !plantilla?.activa}
          isPlantillaInactiva={!plantilla?.activa}
        />
      </Box>

      {/* Contenido principal */}
      <Grid container sx={{ flex: 1, overflow: 'hidden', px: 2, pb: 2, gap: 2, minHeight: 0 }}>
        {/* Panel izquierdo - Campos disponibles */}
        <Grid item xs={3} sx={{ height: '100%', minHeight: 0 }}>
          <FieldsPanel
            plantillaId={plantillaId}
            onFieldSelect={(field) => addDynamicField(field)}
            selectedFields={[]}
            readOnly={mode === 'preview' || !plantilla?.activa}
            isPlantillaInactiva={!plantilla?.activa}
          />
        </Grid>

        {/* Centro - Canvas del editor */}
        <Grid item xs={6} sx={{ height: '100%', minHeight: 0 }}>
          <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
            <TemplateCanvas
              ref={canvasRef}
              plantillaId={Number(plantillaId)}  // ← Esto es crucial
              pageSize="OFICIO_MEXICO"
              onCanvasReady={handleCanvasReady}
              onSelectionChanged={handleSelectionChanged}
              readOnly={mode === 'preview' || !plantilla?.activa}
              mode={mode}
              isPlantillaInactiva={!plantilla?.activa}
              key={`canvas-${mode}-${forceRerender}`}
            />
          </Paper>
        </Grid>

        {/* Panel derecho - Propiedades */}
        <Grid item xs={3} sx={{ height: '100%', minHeight: 0 }}>
          <PropertiesPanel
            selectedObject={selectedObjects.length === 1 ? selectedObjects[0] : null}
            onPropertyChange={(property, value) => {
              if (selectedObjects.length === 1 && canvasRef.current?.fabricInstance) {
                try {
                  selectedObjects[0].set(property, value);
                  canvasRef.current.fabricInstance.renderAll();
                } catch (error) {
                  console.error('Error cambiando propiedad:', error);
                }
              }
            }}
            readOnly={mode === 'preview' || !plantilla?.activa}
            isPlantillaInactiva={!plantilla?.activa}
          />
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <AlertComponent 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </AlertComponent>
      </Snackbar>
    </Box>
  );
};

export default EditorPlantilla;