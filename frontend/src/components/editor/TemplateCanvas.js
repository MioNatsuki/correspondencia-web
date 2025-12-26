// frontend/src/components/editor/TemplateCanvas.js
import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Box, Alert, CircularProgress, Typography } from '@mui/material';
import { PAGE_SIZES, UPLOADS_BASE_URL } from '../../utils/constants';

const TemplateCanvas = forwardRef(({
  pdfUrl,
  pageSize = 'OFICIO_MEXICO',
  onCanvasReady,
  onSelectionChanged,
  readOnly = false,
  backgroundColor = '#ffffff'
}, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fabricRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fabricLoaded, setFabricLoaded] = useState(false);
  const [canvasInstance, setCanvasInstance] = useState(null);

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
      const dimensions = getDimensions();

      // Crear canvas
      const canvas = new Canvas(canvasRef.current, {
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: backgroundColor,
        selectionColor: 'rgba(170, 230, 217, 0.3)',
        selectionBorderColor: '#aae6d9',
        selectionLineWidth: 2,
        preserveObjectStacking: true,
        selection: !readOnly,
        hoverCursor: readOnly ? 'default' : 'move',
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

      // Textbox por defecto SIN FONDO y EDITABLE
      fabricRef.current.Textbox.prototype.backgroundColor = 'transparent';
      fabricRef.current.Textbox.prototype.editable = !readOnly;
      fabricRef.current.IText.prototype.editable = !readOnly;

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
        if (readOnly) return;
        
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
  }, [fabricLoaded, readOnly, onCanvasReady, onSelectionChanged]);

  // ==================== CARGAR FONDO PDF ====================
  useEffect(() => {
    if (!canvasInstance || !pdfUrl || !fabricRef.current) return;

    const loadBackground = () => {
      setIsLoading(true);
      setError(null);

      const absoluteUrl = pdfUrl.startsWith('http') 
        ? pdfUrl 
        : `${UPLOADS_BASE_URL}${pdfUrl}`;

      console.log('Cargando PDF desde:', absoluteUrl);

      fabricRef.current.Image.fromURL(absoluteUrl, (img) => {
        if (!canvasInstance || !img) {
          setIsLoading(false);
          return;
        }

        try {
          const dimensions = getDimensions();
          
          // Escalar imagen para que quepa en el canvas
          const scaleX = dimensions.width / img.width;
          const scaleY = dimensions.height / img.height;
          const scale = Math.min(scaleX, scaleY);

          img.scale(scale);

          // Centrar la imagen
          img.set({
            left: (dimensions.width - img.width * scale) / 2,
            top: (dimensions.height - img.height * scale) / 2,
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            lockRotation: true,
            lockScalingX: true,
            lockScalingY: true,
            originX: 'left',
            originY: 'top'
          });

          canvasInstance.setBackgroundImage(img, canvasInstance.renderAll.bind(canvasInstance), {
            crossOrigin: 'anonymous'
          });

          setIsLoading(false);
          console.log('Fondo PDF cargado correctamente');

        } catch (err) {
          console.error('Error configurando fondo:', err);
          setError('Error configurando el fondo del PDF');
          setIsLoading(false);
        }
      }, {
        crossOrigin: 'anonymous'
      }, () => {
        // Error callback
        console.error('No se pudo cargar la imagen del PDF');
        setError('No se pudo cargar el PDF como fondo. Verifica la URL.');
        setIsLoading(false);
        
        // Crear fondo de relleno
        canvasInstance.setBackgroundColor('#f8f9fa', canvasInstance.renderAll.bind(canvasInstance));
      });
    };

    loadBackground();
  }, [canvasInstance, pdfUrl]);

  // ==================== MÉTODOS INTERNOS ====================
  const getDimensions = useCallback(() => {
    const size = PAGE_SIZES[pageSize] || PAGE_SIZES.OFICIO_MEXICO;
    return {
      width: size.width * 3.78,  // mm a pixels (96 DPI)
      height: size.height * 3.78,
      mmWidth: size.width,
      mmHeight: size.height
    };
  }, [pageSize]);

  const addTextField = useCallback((options = {}) => {
    if (!canvasInstance || !fabricRef.current) {
      console.error('Canvas no está listo');
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
        backgroundColor: 'transparent', // SIN FONDO
        metadata: {
          fieldType: 'text',
          ...options.metadata
        }
      });

      // Hacer editable inmediatamente
      textbox.on('added', () => {
        if (!readOnly) {
          setTimeout(() => {
            textbox.enterEditing();
            textbox.selectAll();
          }, 50);
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
  }, [canvasInstance, readOnly]);

  const addDynamicField = useCallback((fieldName, options = {}) => {
    if (!canvasInstance || !fabricRef.current) {
      console.error('Canvas no está listo');
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
        editable: !readOnly, // EDITABLE
        lockScalingFlip: true,
        splitByGrapheme: true,
        padding: 4,
        backgroundColor: 'transparent', // SIN FONDO
        metadata: {
          fieldType: 'dynamic',
          fieldName: fieldName,
          ...options.metadata
        }
      });

      // Hacer editable inmediatamente
      textbox.on('added', () => {
        if (!readOnly) {
          setTimeout(() => {
            textbox.enterEditing();
            textbox.selectAll();
          }, 50);
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
  }, [canvasInstance, readOnly]);

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
      // Limpiar solo objetos de usuario (mantener fondo)
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
          editable: !readOnly, // EDITABLE
          lockScalingFlip: true,
          splitByGrapheme: true,
          padding: 4,
          backgroundColor: 'transparent', // SIN FONDO
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
          obj.set('backgroundColor', 'transparent');
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
    clear: clearCanvas,
    removeSelected,
    renderAll: () => canvasInstance?.renderAll(),
    fabricInstance: canvasInstance
  }));

  // ==================== RENDER ====================
  const dimensions = getDimensions();

  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        bgcolor: '#f8f9fa'
      }}>
        <CircularProgress size={40} />
        <Typography variant="body2" sx={{ mt: 2 }}>
          {fabricLoaded ? 'Cargando fondo...' : 'Cargando editor...'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Información del tamaño */}
      <Box sx={{ p: 1, bgcolor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary">
          Tamaño: {dimensions.mmWidth.toFixed(1)}mm × {dimensions.mmHeight.toFixed(1)}mm
          {readOnly && ' (Vista previa - Solo lectura)'}
        </Typography>
      </Box>

      {/* Contenedor del canvas */}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          position: 'relative',
          overflow: 'auto',
          bgcolor: backgroundColor
        }}
      >
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              position: 'absolute',
              top: 8,
              left: 8,
              right: 8,
              zIndex: 11
            }}
          >
            {error}
          </Alert>
        )}

        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{
            display: 'block',
            margin: '0 auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            cursor: readOnly ? 'default' : 'crosshair'
          }}
        />
      </Box>
    </Box>
  );
});

TemplateCanvas.displayName = 'TemplateCanvas';

export default TemplateCanvas;