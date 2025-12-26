// frontend/src/components/editor/TemplateCanvas.js - VERSIÓN COMPLETA CON IFRAME
import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Box, Alert, CircularProgress, Typography } from '@mui/material';
import { PAGE_SIZES, UPLOADS_BASE_URL } from '../../utils/constants';
import api from '../../api/index';
import PropTypes from 'prop-types';

// Componente PdfViewer integrado
const PdfViewer = ({ plantillaId, width, height }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargarPdf = async () => {
      if (!plantillaId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Obtener la plantilla para construir URL del PDF
        const response = await api.get(`/plantillas/${plantillaId}`);
        const plantilla = response.data;

        if (!plantilla) {
          throw new Error('Plantilla no encontrada');
        }

        let urlFinal = null;

        // Prioridad 1: Usar pdf_base si está disponible
        if (plantilla.pdf_base) {
          urlFinal = `${UPLOADS_BASE_URL}${plantilla.pdf_base}`;
        }
        // Prioridad 2: Usar ruta_archivo
        else if (plantilla.ruta_archivo) {
          // Normalizar ruta de Windows
          const rutaNormalizada = plantilla.ruta_archivo
            .replace(/^\.\/uploads\\/, '/uploads/')
            .replace(/\\/g, '/')
            .replace('//', '/');
          
          urlFinal = `${UPLOADS_BASE_URL}${rutaNormalizada}`;
        }

        if (!urlFinal) {
          throw new Error('No se encontró el PDF de la plantilla');
        }

        console.log('URL del PDF:', urlFinal);
        setPdfUrl(urlFinal);

      } catch (err) {
        console.error('Error obteniendo PDF:', err);
        setError(err.message);
        // Usar un PDF de ejemplo como fallback
        setPdfUrl('/ejemplo.pdf');
      } finally {
        setLoading(false);
      }
    };

    cargarPdf();
  }, [plantillaId]);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        bgcolor: '#f5f5f5'
      }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        bgcolor: '#f5f5f5',
        p: 2
      }}>
        <Alert severity="warning" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!pdfUrl) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        bgcolor: '#f5f5f5'
      }}>
        <Typography variant="body2" color="text.secondary">
          Sin PDF disponible
        </Typography>
      </Box>
    );
  }

  return (
    <iframe
      src={pdfUrl}
      title="PDF de plantilla"
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        pointerEvents: 'none' // No interactúa con el mouse
      }}
      onLoad={() => console.log('PDF cargado')}
    />
  );
};

// Componente principal TemplateCanvas
const TemplateCanvas = forwardRef(({
  pageSize = 'OFICIO_MEXICO',
  onCanvasReady,
  onSelectionChanged,
  readOnly = false,
  mode = 'edit',
  plantillaId = null,
  isPlantillaInactiva = false
}, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fabricRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fabricLoaded, setFabricLoaded] = useState(false);
  const [canvasInstance, setCanvasInstance] = useState(null);
  
  // Dimensiones del canvas (OFICIO MEXICO en píxeles)
  const dimensions = {
    width: 816,  // 215.9mm * 3.78 ≈ 816px
    height: 1285, // 340.1mm * 3.78 ≈ 1285px
    mmWidth: 215.9,
    mmHeight: 340.1
  };

  // ==================== CARGAR FABRIC.JS ====================
  useEffect(() => {
    const loadFabric = async () => {
      try {
        const fabricModule = await import('fabric');
        fabricRef.current = fabricModule;
        setFabricLoaded(true);
        console.log('Fabric.js cargado correctamente');
      } catch (err) {
        console.error('Error cargando Fabric.js:', err);
        setError('No se pudo cargar el editor de gráficos');
        setIsLoading(false);
      }
    };

    loadFabric();

    return () => {
      if (canvasInstance) {
        canvasInstance.dispose();
      }
    };
  }, []);

  // ==================== INICIALIZAR CANVAS ====================
  useEffect(() => {
    if (!fabricLoaded || !canvasRef.current || canvasInstance) return;

    try {
      const { Canvas, Textbox } = fabricRef.current;

      // Crear canvas transparente
      const canvas = new Canvas(canvasRef.current, {
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: 'rgba(0,0,0,0)', // Transparente
        selectionColor: 'rgba(170, 230, 217, 0.3)',
        selectionBorderColor: '#aae6d9',
        selectionLineWidth: 2,
        preserveObjectStacking: true,
        selection: !readOnly && mode === 'edit' && !isPlantillaInactiva,
        hoverCursor: readOnly || mode === 'preview' || isPlantillaInactiva ? 'default' : 'move',
        stopContextMenu: true
      });

      // Configurar propiedades por defecto
      fabricRef.current.Object.prototype.transparentCorners = false;
      fabricRef.current.Object.prototype.cornerColor = '#aae6d9';
      fabricRef.current.Object.prototype.cornerStrokeColor = '#7ab3a5';
      fabricRef.current.Object.prototype.cornerStyle = 'circle';
      fabricRef.current.Object.prototype.borderColor = '#aae6d9';
      fabricRef.current.Object.prototype.cornerSize = 8;
      fabricRef.current.Object.prototype.touchCornerSize = 16;
      fabricRef.current.Object.prototype.padding = 4;

      // Textbox por defecto
      fabricRef.current.Textbox.prototype.backgroundColor = 'rgba(255,255,255,0.7)';
      fabricRef.current.Textbox.prototype.editable = !readOnly && mode === 'edit' && !isPlantillaInactiva;
      fabricRef.current.IText.prototype.editable = !readOnly && mode === 'edit' && !isPlantillaInactiva;

      // Configurar eventos
      canvas.on('selection:created', (e) => {
        if (onSelectionChanged) {
          onSelectionChanged(e.selected || []);
        }
      });

      canvas.on('selection:updated', (e) => {
        if (onSelectionChanged) {
          onSelectionChanged(e.selected || []);
        }
      });

      canvas.on('selection:cleared', () => {
        if (onSelectionChanged) {
          onSelectionChanged([]);
        }
      });

      // Evento para doble clic en texto
      canvas.on('mouse:dblclick', (e) => {
        if (readOnly || mode === 'preview' || isPlantillaInactiva) return;
        
        if (e.target && e.target.type === 'textbox') {
          e.target.enterEditing();
          e.target.hiddenTextarea.focus();
        }
      });

      // Evento para eliminar con tecla Delete
      const handleKeyDown = (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && canvas.getActiveObject()) {
          e.preventDefault();
          canvas.remove(canvas.getActiveObject());
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      setCanvasInstance(canvas);
      
      if (onCanvasReady) {
        onCanvasReady(canvas);
      }

      setIsLoading(false);

      // Cleanup
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (canvas) {
          canvas.dispose();
        }
      };

    } catch (err) {
      console.error('Error inicializando canvas:', err);
      setError('Error al inicializar el editor');
      setIsLoading(false);
    }
  }, [fabricLoaded, readOnly, mode, isPlantillaInactiva, onCanvasReady, onSelectionChanged]);

  // ==================== MÉTODOS DEL EDITOR ====================
  const addTextField = useCallback((options = {}) => {
    if (!canvasInstance || !fabricRef.current || isPlantillaInactiva) {
      console.error('Canvas no está listo o plantilla inactiva');
      return null;
    }

    try {
      const { Textbox } = fabricRef.current;
      const textbox = new Textbox(options.text || 'Nuevo texto', {
        left: options.left || 100,
        top: options.top || 100,
        width: options.width || 200,
        fontSize: options.fontSize || 12,
        fontFamily: options.fontFamily || 'Arial',
        fill: options.fill || '#000000',
        textAlign: options.textAlign || 'left',
        lineHeight: options.lineHeight || 1.2,
        selectable: !readOnly,
        evented: !readOnly,
        hasControls: !readOnly,
        hasBorders: !readOnly,
        editable: !readOnly,
        lockScalingFlip: true,
        splitByGrapheme: true,
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.7)',
        metadata: {
          fieldType: 'text',
          ...options.metadata
        }
      });

      canvasInstance.add(textbox);
      if (!readOnly) {
        canvasInstance.setActiveObject(textbox);
      }
      canvasInstance.renderAll();

      return textbox;

    } catch (err) {
      console.error('Error agregando texto:', err);
      return null;
    }
  }, [canvasInstance, readOnly, isPlantillaInactiva]);

  const addDynamicField = useCallback((fieldName, options = {}) => {
    if (!canvasInstance || !fabricRef.current || !fieldName || isPlantillaInactiva) {
      console.error('Canvas no está listo, campo inválido o plantilla inactiva');
      return null;
    }

    try {
      const { Textbox } = fabricRef.current;
      const textbox = new Textbox(`<<${fieldName}>>`, {
        left: options.left || 100,
        top: options.top || 150,
        width: options.width || 200,
        fontSize: options.fontSize || 12,
        fontFamily: options.fontFamily || 'Arial',
        fill: options.fill || '#2196f3',
        textAlign: options.textAlign || 'left',
        lineHeight: options.lineHeight || 1.2,
        selectable: !readOnly,
        evented: !readOnly,
        hasControls: !readOnly,
        hasBorders: !readOnly,
        editable: !readOnly,
        lockScalingFlip: true,
        splitByGrapheme: true,
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.7)',
        metadata: {
          fieldType: 'dynamic',
          fieldName: fieldName,
          ...options.metadata
        }
      });

      canvasInstance.add(textbox);
      if (!readOnly) {
        canvasInstance.setActiveObject(textbox);
      }
      canvasInstance.renderAll();

      return textbox;

    } catch (err) {
      console.error('Error agregando campo dinámico:', err);
      return null;
    }
  }, [canvasInstance, readOnly, isPlantillaInactiva]);

  const getCanvasState = useCallback(() => {
    if (!canvasInstance) return { objects: [] };
    
    try {
      const objects = canvasInstance.getObjects().map(obj => {
        const objData = obj.toObject();
        return {
          ...objData,
          metadata: obj.metadata || {}
        };
      });
      
      return { objects };
    } catch (err) {
      console.error('Error obteniendo estado del canvas:', err);
      return { objects: [] };
    }
  }, [canvasInstance]);

  const loadFields = useCallback((fields) => {
    if (!canvasInstance || !fabricRef.current || !Array.isArray(fields)) return;

    try {
      // Limpiar solo objetos de usuario
      const objects = canvasInstance.getObjects();
      objects.forEach(obj => {
        if (obj.metadata?.fieldType) {
          canvasInstance.remove(obj);
        }
      });

      // Agregar nuevos campos
      fields.forEach((field, index) => {
        if (!field) return;

        const text = field.tipo === 'texto' 
          ? field.texto_fijo || ''
          : `<<${field.columna_padron}>>`;

        const { Textbox } = fabricRef.current;
        const textbox = new Textbox(text, {
          left: field.x || 100,
          top: field.y || 100 + (index * 60),
          width: field.ancho || 200,
          fontSize: field.tamano_fuente || 12,
          fontFamily: field.fuente || 'Arial',
          fill: field.tipo === 'texto' ? (field.color || '#000000') : '#2196f3',
          textAlign: field.alineacion || 'left',
          fontWeight: field.negrita ? 'bold' : 'normal',
          fontStyle: field.cursiva ? 'italic' : 'normal',
          lineHeight: 1.2,
          selectable: !readOnly,
          evented: !readOnly,
          hasControls: !readOnly,
          hasBorders: !readOnly,
          editable: !readOnly,
          lockScalingFlip: true,
          splitByGrapheme: true,
          padding: 4,
          backgroundColor: 'rgba(255,255,255,0.7)',
          metadata: {
            fieldType: field.tipo === 'texto' ? 'text' : 'dynamic',
            campoId: field.id,
            fieldName: field.columna_padron,
            ...field
          }
        });

        canvasInstance.add(textbox);
      });

      canvasInstance.renderAll();
      console.log(`${fields.length} campos cargados en el canvas`);

    } catch (err) {
      console.error('Error cargando campos:', err);
    }
  }, [canvasInstance, readOnly]);

  const updatePreview = useCallback((data) => {
    if (!canvasInstance || !data) return;

    try {
      canvasInstance.getObjects().forEach(obj => {
        if (obj.metadata?.fieldType === 'dynamic' && obj.metadata?.fieldName) {
          const fieldName = obj.metadata.fieldName;
          const value = data[fieldName] || `[${fieldName}]`;
          obj.set('text', value);
          obj.set('fill', '#2c3e50');
          obj.set('backgroundColor', 'rgba(255,255,255,0.7)');
        }
      });

      canvasInstance.renderAll();
      console.log('Preview actualizado con datos:', data);

    } catch (err) {
      console.error('Error actualizando preview:', err);
    }
  }, [canvasInstance]);

  const clearCanvas = useCallback(() => {
    if (!canvasInstance) return;

    try {
      const objects = canvasInstance.getObjects();
      objects.forEach(obj => {
        if (obj.metadata?.fieldType) {
          canvasInstance.remove(obj);
        }
      });
      canvasInstance.renderAll();
    } catch (err) {
      console.error('Error limpiando canvas:', err);
    }
  }, [canvasInstance]);

  const removeSelected = useCallback(() => {
    if (!canvasInstance) return;

    try {
      const activeObject = canvasInstance.getActiveObject();
      if (activeObject) {
        canvasInstance.remove(activeObject);
        canvasInstance.discardActiveObject();
        canvasInstance.renderAll();
      }
    } catch (err) {
      console.error('Error eliminando objeto seleccionado:', err);
    }
  }, [canvasInstance]);

  // ==================== EXPONER MÉTODOS VIA REF ====================
  useImperativeHandle(ref, () => ({
    addTextField,
    addDynamicField,
    getCanvasState,
    loadFields,
    updatePreview,
    clearCanvas,
    removeSelected,
    renderAll: () => canvasInstance?.renderAll(),
    fabricInstance: canvasInstance
  }));

  // ==================== RENDER ====================
  return (
    <Box sx={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%',
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Información del tamaño */}
      <Box sx={{ 
        p: 1, 
        bgcolor: 'rgba(0,0,0,0.02)', 
        borderBottom: '1px solid #e0e0e0',
        flexShrink: 0
      }}>
        <Typography variant="caption" color="text.secondary">
          Tamaño: {dimensions.mmWidth.toFixed(1)}mm × {dimensions.mmHeight.toFixed(1)}mm
          {mode === 'preview' && ' (Vista previa)'}
          {isPlantillaInactiva && ' (Plantilla inactiva)'}
        </Typography>
      </Box>

      {/* Contenedor principal con scroll */}
      <Box 
        ref={containerRef}
        sx={{ 
          flex: 1,
          position: 'relative',
          overflow: 'auto',
          bgcolor: '#f5f5f5'
        }}
      >
        {error && (
          <Alert severity="error" sx={{ m: 2, position: 'absolute', zIndex: 10, width: 'calc(100% - 32px)' }}>
            {error}
          </Alert>
        )}

        {/* Contenedor con tamaño fijo para el PDF y canvas */}
        <Box sx={{
          position: 'relative',
          width: dimensions.width,
          height: dimensions.height,
          margin: '20px auto',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          bgcolor: 'white'
        }}>
          {/* PDF como fondo (iframe) */}
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1
          }}>
            <PdfViewer
              plantillaId={plantillaId}
              width="100%"
              height="100%"
            />
          </Box>

          {/* Canvas de Fabric.js superpuesto */}
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 2,
            pointerEvents: readOnly || mode === 'preview' || isPlantillaInactiva ? 'none' : 'auto'
          }}>
            <canvas
              ref={canvasRef}
              width={dimensions.width}
              height={dimensions.height}
              style={{
                display: 'block'
              }}
            />
          </Box>

          {/* Indicador de carga */}
          {isLoading && (
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: 'rgba(255,255,255,0.9)',
              zIndex: 3
            }}>
              <CircularProgress size={40} />
              <Typography variant="body2" sx={{ ml: 2 }}>
                Inicializando editor...
              </Typography>
            </Box>
          )}

          {/* Mensaje para plantilla inactiva */}
          {isPlantillaInactiva && !isLoading && (
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: 'rgba(255, 152, 0, 0.1)',
              zIndex: 4,
              pointerEvents: 'none'
            }}>
              <Alert 
                severity="warning" 
                sx={{ 
                  maxWidth: '80%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <Typography variant="body2" fontWeight="bold">
                  Plantilla Inactiva
                </Typography>
                <Typography variant="caption">
                  Guarda los cambios para activar esta plantilla
                </Typography>
              </Alert>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
});

TemplateCanvas.propTypes = {
  pageSize: PropTypes.string,
  onCanvasReady: PropTypes.func,
  onSelectionChanged: PropTypes.func,
  readOnly: PropTypes.bool,
  mode: PropTypes.oneOf(['edit', 'preview']),
  plantillaId: PropTypes.number,
  isPlantillaInactiva: PropTypes.bool
};

TemplateCanvas.defaultProps = {
  pageSize: 'OFICIO_MEXICO',
  readOnly: false,
  mode: 'edit',
  plantillaId: null,
  isPlantillaInactiva: false
};

TemplateCanvas.displayName = 'TemplateCanvas';

export default TemplateCanvas;