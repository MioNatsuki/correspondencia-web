// frontend/src/components/plantillas/EditorPlantilla.js
import React, { useState, useCallback, useEffect, useRef } from 'react';
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
} from '@mui/material';
import {
  AiOutlineEye,
  AiOutlineEdit,
  AiOutlineSave,
  AiOutlineArrowLeft,
  AiOutlineArrowRight,
  AiOutlineClose,
  AiOutlineHome,
} from 'react-icons/ai';
import MuiAlert from '@mui/material/Alert'; // Necesario para Snackbar con severity
import { useQuery, useMutation } from '@tanstack/react-query';

import EditorToolbar from '../../components/editor/EditorToolbar';
import FieldsPanel from '../../components/editor/FieldsPanel';
import PropertiesPanel from '../../components/editor/PropertiesPanel';
import TemplateCanvas from '../../components/editor/TemplateCanvas';

import { plantillasAPI } from '../../api/plantillas';
import { UPLOADS_BASE_URL } from '../../utils/constants';

const EditorPlantilla = () => {
  const { plantillaId } = useParams();
  const navigate = useNavigate();

  // Estados
  const [canvas, setCanvas] = useState(null);
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [mode, setMode] = useState('edit'); // 'edit' | 'preview'
  const [previewIndex, setPreviewIndex] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const canvasRef = useRef(null);
  const originalStateRef = useRef(null); // Para restaurar al salir de preview

  // Callbacks del canvas
  const handleCanvasReady = useCallback((canvasInstance) => {
    canvasRef.current = canvasInstance;
    setCanvas(canvasInstance);
  }, []);

  const handleSelectionChanged = useCallback((objects) => {
    setSelectedObjects(objects || []);
  }, []);

  // ==================== QUERIES ====================
  const {
    data: plantilla,
    isLoading: loadingPlantilla,
    error: errorPlantilla,
  } = useQuery({
    queryKey: ['plantilla', plantillaId],
    queryFn: () => plantillasAPI.getPlantilla(plantillaId),
    enabled: !!plantillaId,
  });

  const {
    data: camposPlantilla = [],
    isLoading: loadingCamposPlantilla,
  } = useQuery({
    queryKey: ['plantilla-campos', plantillaId],
    queryFn: () => plantillasAPI.getCampos(plantillaId),
    enabled: !!plantillaId,
  });

  // Suponiendo que la plantilla tiene un padron_id o similar para obtener las columnas disponibles
  // Si no lo tienes, reemplaza esto con la lógica correcta de tu backend
  const {
    data: columnasPadron = [], // ← Aquí estaban usando "camposData" que no existía
  } = useQuery({
    queryKey: ['columnas-padron', plantilla?.padron_id],
    queryFn: () => plantillasAPI.getColumnasPadron(plantilla.padron_id),
    enabled: !!plantilla?.padron_id,
  });

  const {
    data: previewData,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ['datos-preview', plantillaId, previewIndex],
    queryFn: () => plantillasAPI.getDatosEjemplo(plantillaId, 10),
    enabled: !!plantillaId && mode === 'preview',
  });

  // ==================== MUTATIONS ====================
  const saveMutation = useMutation({
    mutationFn: (campos) => plantillasAPI.updateCampos(plantillaId, campos),
    onSuccess: () => {
      showSnackbar('Campos guardados exitosamente', 'success');
    },
    onError: (error) => {
      showSnackbar(`Error al guardar: ${error.message || 'Desconocido'}`, 'error');
    },
  });

  // ==================== FUNCIONES AUXILIARES ====================
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const loadExistingFields = (canvasInstance, campos) => {
    campos.forEach((campo, index) => {
      if (campo.tipo === 'texto') {
        TemplateCanvas.addTextField(canvasInstance, {
          left: campo.x,
          top: campo.y,
          width: campo.ancho,
          height: campo.alto,
          text: campo.texto_fijo || '',
          fontSize: campo.tamano_fuente,
          fontFamily: campo.fuente,
          fill: campo.color,
          textAlign: campo.alineacion,
          name: `text_${index}`,
          metadata: {
            fieldType: 'text',
            campoId: campo.id,
          },
        });
      } else if (campo.tipo === 'campo') {
        TemplateCanvas.addDynamicField(canvasInstance, campo.columna_padron, {
          left: campo.x,
          top: campo.y,
          width: campo.ancho,
          height: campo.alto,
          fontSize: campo.tamano_fuente,
          fontFamily: campo.fuente,
          fill: campo.color,
          textAlign: campo.alineacion,
          name: `field_${index}`,
          metadata: {
            fieldType: 'dynamic',
            campoId: campo.id,
            fieldName: campo.columna_padron,
          },
        });
      }
    });
  };

  const convertirEstadoACampos = (estado) => {
    return estado.objects.map((obj, index) => ({
      nombre: obj.name || `campo_${index}`,
      tipo: obj.metadata?.fieldType === 'dynamic' ? 'campo' : 'texto',
      x: obj.left,
      y: obj.top,
      ancho: obj.width,
      alto: obj.height,
      alineacion: obj.textAlign || 'left',
      fuente: obj.fontFamily || 'Arial',
      tamano_fuente: obj.fontSize || 12,
      color: obj.fill || '#000000',
      negrita: obj.fontWeight === 'bold',
      cursiva: obj.fontStyle === 'italic',
      texto_fijo: obj.metadata?.fieldType === 'text' ? obj.text : null,
      columna_padron: obj.metadata?.fieldName || null,
      orden: index,
      activo: true,
    }));
  };

  const handleSave = () => {
    if (!canvas) return;

    const estado = TemplateCanvas.getCanvasState(canvas);
    const campos = convertirEstadoACampos(estado);

    saveMutation.mutate(campos);
  };

  // ==================== VISTA PREVIA ====================
  const togglePreviewMode = () => {
    const newMode = mode === 'edit' ? 'preview' : 'edit';

    if (newMode === 'preview' && canvas) {
      // Guardar estado original antes de modificar textos
      originalStateRef.current = canvas.toJSON();
    }

    if (mode === 'preview' && newMode === 'edit' && originalStateRef.current && canvas) {
      // Restaurar estado original
      canvas.loadFromJSON(originalStateRef.current, canvas.renderAll.bind(canvas));
      originalStateRef.current = null;
    }

    setMode(newMode);
    setPreviewIndex(0);

    if (newMode === 'preview') {
      refetchPreview();
    }
  };

  const updatePreview = useCallback(() => {
    if (!canvas || !previewData?.datos || previewData.datos.length === 0) return;

    const datosRegistro = previewData.datos[previewIndex] || {};

    canvas.getObjects().forEach((obj) => {
      if (obj.metadata?.fieldType === 'dynamic' && obj.metadata?.fieldName) {
        const valor = datosRegistro[obj.metadata.fieldName] ?? `<<${obj.metadata.fieldName}>>`;
        obj.set('text', valor);
      }
    });

    canvas.renderAll();
  }, [canvas, previewData, previewIndex]);

  useEffect(() => {
    if (mode === 'preview' && canvas) {
      updatePreview();
    }
  }, [mode, previewIndex, previewData, canvas, updatePreview]);

  const handleNextPreview = () => {
    if (!previewData?.datos) return;
    setPreviewIndex((prev) => (prev < previewData.datos.length - 1 ? prev + 1 : 0));
  };

  const handlePrevPreview = () => {
    if (!previewData?.datos) return;
    setPreviewIndex((prev) => (prev > 0 ? prev - 1 : previewData.datos.length - 1));
  };

  // ==================== CARGA DE CAMPOS EXISTENTES ====================
  useEffect(() => {
    if (!canvas || camposPlantilla.length === 0) return;

    canvas.clear();
    loadExistingFields(canvas, camposPlantilla);
  }, [canvas, camposPlantilla]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (canvasRef.current) {
        try {
          canvasRef.current.dispose();
        } catch (err) {
          console.error('Error limpiando canvas:', err);
        }
      }
    };
  }, []);

  // ==================== FUNCIONES TOOLBAR ====================
  const handleAddTextField = () => {
    if (!canvas) return;
    TemplateCanvas.addTextField(canvas, {
      left: 100,
      top: 100,
      text: 'Texto de ejemplo',
      fontSize: 12,
      fontFamily: 'Arial',
      fill: '#000000',
    });
  };

  const handleAddDynamicField = (fieldName) => {
    if (!canvas) return;
    TemplateCanvas.addDynamicField(canvas, fieldName, {
      left: 100,
      top: 150,
      fontSize: 12,
      fontFamily: 'Arial',
      fill: '#2196f3',
    });
  };

  // ==================== RENDER ====================
  if (loadingPlantilla) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (errorPlantilla) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">
          Error cargando plantilla: {errorPlantilla.message || 'Desconocido'}
          <Button sx={{ ml: 2 }} onClick={() => navigate('/plantillas')}>
            Volver
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f7fa' }}>
      {/* Header */}
      <Paper
        sx={{
          p: 2,
          borderRadius: 0,
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/plantillas')} size="small">
            <AiOutlineHome />
          </IconButton>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {plantilla?.nombre || 'Editor de Plantilla'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {mode === 'edit' ? 'Modo Edición' : 'Modo Vista Previa'}
              {mode === 'preview' && previewData?.datos && (
                ` • Registro ${previewIndex + 1} de ${previewData.datos.length}`
              )}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <ToggleButtonGroup value={mode} exclusive onChange={togglePreviewMode} size="small">
            <ToggleButton value="edit">
              <AiOutlineEdit /> Editar
            </ToggleButton>
            <ToggleButton value="preview">
              <AiOutlineEye /> Vista Previa
            </ToggleButton>
          </ToggleButtonGroup>

          {mode === 'preview' && previewData?.datos && (
            <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
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

          <Button
            variant="contained"
            startIcon={<AiOutlineSave />}
            onClick={handleSave}
            disabled={saveMutation.isPending || mode === 'preview' || !canvas}
            sx={{ ml: 2, bgcolor: '#aae6d9', '&:hover': { bgcolor: '#7ab3a5' } }}
          >
            {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </Box>
      </Paper>

      {/* Toolbar */}
      <Box sx={{ px: 2, py: 1 }}>
        <EditorToolbar
          onAddTextField={handleAddTextField}
          onAddDynamicField={handleAddDynamicField}
          onSave={handleSave}
          onPreview={togglePreviewMode}
          onUndo={() => canvas?.undo && canvas.undo()}
          onRedo={() => canvas?.redo && canvas.redo()}
          onDelete={() => {
            if (canvas && selectedObjects.length > 0) {
              canvas.remove(...selectedObjects);
              canvas.discardActiveObject();
              canvas.renderAll();
            }
          }}
          availableFields={columnasPadron}
          selectedObjects={selectedObjects}
          readOnly={mode === 'preview'}
        />
      </Box>

      {/* Contenido principal */}
      <Grid container sx={{ flex: 1, overflow: 'hidden', px: 2, pb: 2, gap: 2 }}>
        <Grid item xs={3} sx={{ height: '100%' }}>
          <FieldsPanel
            plantillaId={plantillaId}
            onFieldSelect={(field) => handleAddDynamicField(field.nombre || field)}
            onFieldDragStart={(field) => handleAddDynamicField(field.nombre || field)}
            selectedFields={[]}
            readOnly={mode === 'preview'}
          />
        </Grid>

        <Grid item xs={6} sx={{ height: '100%' }}>
          <Paper sx={{ height: '100%', p: 2, borderRadius: 2 }}>
            <TemplateCanvas
              pdfUrl={plantilla?.ruta_archivo ? `${UPLOADS_BASE_URL}/${plantilla.ruta_archivo}` : null}
              pageSize="OFICIO_MEXICO"
              width="100%"
              height="100%"
              onCanvasReady={handleCanvasReady}
              onSelectionChanged={handleSelectionChanged}
              readOnly={mode === 'preview'}
            />
          </Paper>
        </Grid>

        <Grid item xs={3} sx={{ height: '100%' }}>
          <PropertiesPanel
            selectedObject={selectedObjects.length === 1 ? selectedObjects[0] : null}
            onPropertyChange={(property, value) => {
              if (canvas && selectedObjects.length === 1) {
                selectedObjects[0].set(property, value);
                canvas.renderAll();
              }
            }}
            readOnly={mode === 'preview'}
          />
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <MuiAlert
          elevation={6}
          variant="filled"
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default EditorPlantilla;