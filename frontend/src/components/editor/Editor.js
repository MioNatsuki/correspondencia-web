// frontend/src/components/editor/Editor.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Grid,
  Alert,
  CircularProgress,
  Snackbar,
  Typography
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import EditorToolbar from './EditorToolbar';
import FieldsPanel from './FieldsPanel';
import PropertiesPanel from './PropertiesPanel';
import TemplateCanvas from './TemplateCanvas';
import { plantillasAPI } from '../../api/plantillas';

const Editor = () => {
  const { plantillaId } = useParams();
  const navigate = useNavigate();
  
  // Estados
  const [canvas, setCanvas] = useState(null);
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Consultas
  const { data: plantilla, isLoading: loadingPlantilla } = useQuery({
    queryKey: ['plantilla', plantillaId],
    queryFn: () => plantillasAPI.getPlantilla(plantillaId),
    enabled: !!plantillaId
  });
  
  const { data: camposDisponibles, isLoading: loadingCampos } = useQuery({
    queryKey: ['campos-disponibles', plantillaId],
    queryFn: () => plantillasAPI.getCamposDisponibles(plantillaId),
    enabled: !!plantillaId
  });
  
  const { data: datosEjemplo } = useQuery({
    queryKey: ['datos-ejemplo', plantillaId],
    queryFn: () => plantillasAPI.getDatosEjemplo(plantillaId, 5),
    enabled: !!plantillaId && isPreviewMode
  });
  
  // Mutaciones
  const guardarMutation = useMutation({
    mutationFn: (campos) => plantillasAPI.guardarCampos(plantillaId, campos),
    onSuccess: () => {
      showSnackbar('Plantilla guardada exitosamente', 'success');
    },
    onError: (error) => {
      showSnackbar(`Error al guardar: ${error.message}`, 'error');
    }
  });
  
  // Callbacks del canvas
  const handleCanvasReady = useCallback((canvasInstance) => {
    setCanvas(canvasInstance);
    
    // Cargar datos existentes si hay
    if (plantilla?.campos && plantilla.campos.length > 0) {
      cargarCamposExistente(canvasInstance, plantilla.campos);
    }
  }, [plantilla]);
  
  const handleSelectionChanged = useCallback((objects) => {
    setSelectedObjects(objects || []);
  }, []);
  
  // Funciones del toolbar
  const handleAddTextField = () => {
    if (!canvas) return;
    TemplateCanvas.addTextField(canvas, {
      left: 100,
      top: 100,
      text: 'Nuevo texto',
      fontSize: 12,
      fontFamily: 'Arial'
    });
  };
  
  const handleAddDynamicField = (fieldName) => {
    if (!canvas) return;
    TemplateCanvas.addDynamicField(canvas, fieldName, {
      left: 100,
      top: 150,
      fontSize: 12,
      fontFamily: 'Arial'
    });
  };
  
  const handleSave = () => {
    if (!canvas) return;
    
    const estado = TemplateCanvas.getCanvasState(canvas);
    const campos = convertirEstadoACampos(estado);
    
    guardarMutation.mutate(campos);
  };
  
  const handlePreview = () => {
    setIsPreviewMode(!isPreviewMode);
    
    if (!isPreviewMode && datosEjemplo?.length > 0) {
      // Aquí cargaríamos los datos de ejemplo en los campos
      // Esto requiere implementación adicional
    }
  };
  
  // Funciones auxiliares
  const cargarCamposExistente = (canvasInstance, campos) => {
    campos.forEach(campo => {
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
          textAlign: campo.alineacion
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
          textAlign: campo.alineacion
        });
      }
    });
  };
  
  const convertirEstadoACampos = (estado) => {
    return estado.objects.map((obj, index) => {
      const base = {
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
  
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };
  
  if (loadingPlantilla) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (!plantilla) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">Plantilla no encontrada</Alert>
      </Container>
    );
  }
  
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, borderRadius: 0, borderBottom: '1px solid #e0e0e0' }}>
        <Typography variant="h6" fontWeight={600}>
          Editor de Plantilla: {plantilla.nombre}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Proyecto: {plantilla.proyecto?.nombre} • {isPreviewMode ? 'Modo Vista Previa' : 'Modo Edición'}
        </Typography>
      </Paper>
      
      {/* Toolbar */}
      <EditorToolbar
        onAddTextField={handleAddTextField}
        onAddDynamicField={handleAddDynamicField}
        onSave={handleSave}
        onPreview={handlePreview}
        onUndo={() => canvas && canvas._undo && canvas._undo()}
        onRedo={() => canvas && canvas._redo && canvas._redo()}
        onDelete={() => canvas && canvas.remove(canvas.getActiveObject())}
        availableFields={camposDisponibles?.columnas || []}
        selectedObjects={selectedObjects}
        isPreviewMode={isPreviewMode}
      />
      
      {/* Contenido principal */}
      <Grid container sx={{ flex: 1, overflow: 'hidden' }}>
        {/* Panel izquierdo - Campos disponibles */}
        <Grid item xs={3} sx={{ height: '100%', overflow: 'auto', p: 1 }}>
          <FieldsPanel
            plantillaId={plantillaId}
            onFieldSelect={(field) => handleAddDynamicField(field.nombre)}
            selectedFields={[]}
          />
        </Grid>
        
        {/* Centro - Canvas del editor */}
        <Grid item xs={6} sx={{ height: '100%', p: 1 }}>
          <TemplateCanvas
            pdfUrl={plantilla.pdf_base ? `${UPLOADS_BASE_URL}/${plantilla.pdf_base}` : null}
            pageSize="OFICIO_MEXICO"
            height="100%"
            onCanvasReady={handleCanvasReady}
            onSelectionChanged={handleSelectionChanged}
            readOnly={isPreviewMode}
          />
        </Grid>
        
        {/* Panel derecho - Propiedades */}
        <Grid item xs={3} sx={{ height: '100%', overflow: 'auto', p: 1 }}>
          <PropertiesPanel
            selectedObject={selectedObjects.length === 1 ? selectedObjects[0] : null}
            onPropertyChange={(property, value) => {
              if (canvas && selectedObjects.length === 1) {
                const obj = selectedObjects[0];
                obj.set(property, value);
                canvas.renderAll();
              }
            }}
            readOnly={isPreviewMode}
          />
        </Grid>
      </Grid>
      
      {/* Snackbar para notificaciones */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default Editor;