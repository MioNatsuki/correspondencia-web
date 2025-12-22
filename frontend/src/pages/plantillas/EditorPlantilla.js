// frontend/src/pages/plantillas/EditorPlantilla.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  Alert,
  Snackbar,
  Breadcrumbs,
  Link,
  IconButton,
  Drawer,
  Divider
} from '@mui/material';
import { useParams, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { plantillasAPI } from '../../api/plantillas';
import { proyectosAPI } from '../../api/proyectos';

// Componentes del editor
import TemplateCanvas from '../../components/editor/TemplateCanvas';
import EditorToolbar from '../../components/editor/EditorToolbar';
import PropertiesPanel from '../../components/editor/PropertiesPanel';
import FieldsPanel from '../../components/editor/FieldsPanel';

// Iconos
import {
  AiOutlineArrowLeft,
  AiOutlineClose
} from 'react-icons/ai';

const EditorPlantilla = () => {
  const { id: plantillaId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  // Estados principales
  const [pageSize, setPageSize] = useState('OFICIO_MEXICO');
  const [pdfPreview, setPdfPreview] = useState(null);
  const [canvasInstance, setCanvasInstance] = useState(null);
  const [selectedObjects, setSelectedObjects] = useState([]);
  const [availableFields, setAvailableFields] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewRecordIndex, setPreviewRecordIndex] = useState(0);
  const [previewRecords, setPreviewRecords] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [setIsSaving] = useState(false);

  const fileInputRef = useRef(null);

  const isNewPlantilla = plantillaId === 'nueva';

  // Obtener proyecto (necesario para uuid_padron)
  const proyectoId = new URLSearchParams(location.search).get('proyecto');
  const { data: proyecto, isLoading: loadingProyecto } = useQuery({
    queryKey: ['proyecto-editor', proyectoId],
    queryFn: () => proyectosAPI.getProyecto(proyectoId),
    enabled: !!proyectoId,
  });

  // Obtener plantilla existente
  const { data: plantilla, isLoading: loadingPlantilla } = useQuery({
    queryKey: ['plantilla', plantillaId],
    queryFn: () => plantillasAPI.getPlantilla(plantillaId, { incluir_campos: true }),
    enabled: !!plantillaId && !isNewPlantilla,
  });

  // Obtener campos disponibles del padrón
  const { data: camposData, isLoading: loadingCampos } = useQuery({
    queryKey: ['campos-padron', proyecto?.uuid_padron],
    queryFn: () => plantillasAPI.getCamposDisponiblesPorPadron(proyecto.uuid_padron),
    enabled: !!proyecto?.uuid_padron,
  });

  // Cargar campos cuando estén disponibles
  useEffect(() => {
    if (camposData?.columnas) {
      setAvailableFields(camposData.columnas);
    }
  }, [camposData]);

  // Cargar configuración existente si es edición
  useEffect(() => {
    if (!plantilla || !canvasInstance) return;

    if (plantilla.config_json?.tamano_pagina) {
      setPageSize(plantilla.config_json.tamano_pagina);
    }
    if (plantilla.pdf_base) {
      setPdfPreview(plantilla.pdf_base);
    }
    // Cargar objetos guardados (por implementar en loadCanvasState)
    if (plantilla.campos_json?.objects) {
      // TemplateCanvas.loadCanvasState(canvasInstance, plantilla.campos_json);
    }
  }, [plantilla, canvasInstance]);

  // Handlers
  const handleCanvasReady = useCallback((canvas) => {
    setCanvasInstance(canvas);
  }, []);

  const handleSelectionChanged = useCallback((objects) => {
    setSelectedObjects(objects || []);
  }, []);

  const handleAddTextField = () => {
    if (!canvasInstance) return;
    TemplateCanvas.addTextField(canvasInstance);
  };

  const handleAddDynamicField = (field) => {
    if (!canvasInstance || !field?.nombre) return;
    TemplateCanvas.addDynamicField(canvasInstance, field.nombre);
  };

  const handlePropertyChange = (property, value) => {
    if (!canvasInstance || selectedObjects.length === 0) return;
    const activeObject = canvasInstance.getActiveObject();
    if (activeObject) {
      activeObject.set(property, value);
      canvasInstance.renderAll();
    }
  };

  const handleSave = async () => {
    if (!canvasInstance) return;
    setIsSaving(true);

    try {
      const canvasState = TemplateCanvas.getCanvasState(canvasInstance);

      const data = {
        proyecto_id: proyectoId,
        nombre: plantilla?.nombre || 'Plantilla sin título',
        descripcion: plantilla?.descripcion || '',
        config_json: {
          tamano_pagina: pageSize,
        },
        campos_json: canvasState,
      };

      if (isNewPlantilla) {
        await plantillasAPI.createPlantilla(data);
      } else {
        await plantillasAPI.updatePlantilla(plantillaId, data);
      }

      setSnackbar({ open: true, message: 'Plantilla guardada correctamente', severity: 'success' });
      queryClient.invalidateQueries(['plantillas-proyecto', proyectoId]);
    } catch (err) {
      setSnackbar({ open: true, message: 'Error al guardar', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!proyecto?.uuid_padron) {
      setSnackbar({ open: true, message: 'No hay padrón asignado', severity: 'warning' });
      return;
    }

    try {
      const response = await plantillasAPI.obtenerDatosPreview(proyecto.uuid_padron, { limit: 10 });
      if (response.datos?.length > 0) {
        setPreviewRecords(response.datos);
        setPreviewRecordIndex(0);
        setShowPreview(true);
      } else {
        setSnackbar({ open: true, message: 'No hay registros en el padrón', severity: 'info' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Error al cargar vista previa', severity: 'error' });
    }
  };

  const handleNextRecord = () => {
    if (previewRecordIndex < previewRecords.length - 1) {
      setPreviewRecordIndex(prev => prev + 1);
    }
  };

  const handlePrevRecord = () => {
    if (previewRecordIndex > 0) {
      setPreviewRecordIndex(prev => prev - 1);
    }
  };

  // Subir PDF
  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () => setPdfPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  if (loadingProyecto || loadingPlantilla) return <LoadingSpinner />;

  if (!isAdmin) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="warning">No tienes permisos para editar plantillas</Alert>
        <Button startIcon={<AiOutlineArrowLeft />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Volver
        </Button>
      </Container>
    );
  }

  return (
    <>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link component={RouterLink} to="/proyectos">Proyectos</Link>
          <Link component={RouterLink} to={`/proyectos/${proyectoId}`}>{proyecto?.nombre}</Link>
          <Link component={RouterLink} to={`/proyectos/${proyectoId}/plantillas`}>Plantillas</Link>
          <Typography color="text.primary">
            {isNewPlantilla ? 'Nueva Plantilla' : plantilla?.nombre || 'Editar'}
          </Typography>
        </Breadcrumbs>

        {/* Toolbar */}
        <EditorToolbar
          onAddTextField={handleAddTextField}
          onAddDynamicField={handleAddDynamicField}
          onSave={handleSave}
          onPreview={handlePreview}
          availableFields={availableFields}
          selectedObjects={selectedObjects}
          readOnly={false}
        />

        {/* Layout principal */}
        <Grid container spacing={3} sx={{ mt: 2 }}>
          {/* Panel izquierdo: Campos del padrón */}
          <Grid item xs={12} md={3}>
            <Drawer
              variant="permanent"
              anchor="left"
              PaperProps={{ sx: { width: 320, borderRight: '1px solid #e0e0e0', bgcolor: '#f9f9f9' } }}
            >
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  Campos del Padrón
                </Typography>
                {proyecto?.nombre_padron ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    Padrón: {proyecto.nombre_padron}
                  </Typography>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>No hay padrón asignado</Alert>
                )}
              </Box>
              <Divider />
              <FieldsPanel
                plantillaId={plantillaId}
                availableFields={availableFields}
                onFieldDragStart={() => {}}
                onFieldSelect={(field) => handleAddDynamicField(field)}
                readOnly={false}
              />
            </Drawer>
          </Grid>

          {/* Centro: Canvas */}
          <Grid item xs={12} md={6}>
            <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <TemplateCanvas
                pdfUrl={pdfPreview}
                pageSize={pageSize}
                onCanvasReady={handleCanvasReady}
                onSelectionChanged={handleSelectionChanged}
                readOnly={false}
              />
            </Paper>
          </Grid>

          {/* Derecha: Propiedades */}
          <Grid item xs={12} md={3}>
            <Paper sx={{ height: '100%', borderRadius: 2, p: 2 }}>
              <PropertiesPanel
                selectedObject={selectedObjects[0] || null}
                onPropertyChange={handlePropertyChange}
                readOnly={false}
              />
            </Paper>
          </Grid>
        </Grid>

        {/* Vista previa modal */}
        {showPreview && previewRecords.length > 0 && (
          <Dialog open={showPreview} onClose={() => setShowPreview(false)} maxWidth="lg" fullWidth>
            <DialogTitle>
              Vista Previa de Resultados
              <IconButton onClick={() => setShowPreview(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
                <AiOutlineClose />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ textAlign: 'center', my: 2 }}>
                <Typography variant="body2">
                  Registro {previewRecordIndex + 1} de {previewRecords.length}
                </Typography>
              </Box>
              <TemplateCanvas
                pdfUrl={pdfPreview}
                pageSize={pageSize}
                previewData={previewRecords[previewRecordIndex]}
                readOnly={true}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handlePrevRecord} disabled={previewRecordIndex === 0}>
                Anterior
              </Button>
              <Button onClick={handleNextRecord} disabled={previewRecordIndex === previewRecords.length - 1}>
                Siguiente
              </Button>
              <Button onClick={() => setShowPreview(false)} variant="contained">
                Cerrar
              </Button>
            </DialogActions>
          </Dialog>
        )}

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* Input oculto para PDF */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handlePdfUpload}
          accept=".pdf"
          style={{ display: 'none' }}
        />
      </Container>
    </>
  );
};

export default EditorPlantilla;