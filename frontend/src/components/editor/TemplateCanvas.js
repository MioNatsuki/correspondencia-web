// frontend/src/components/editor/TemplateCanvas.js
import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Box, Paper, Typography, Alert, CircularProgress } from '@mui/material';
import { PAGE_SIZES } from '../../utils/constants';

const TemplateCanvas = ({
  pdfUrl,
  pageSize = 'OFICIO_MEXICO',
  width = 800,
  height = 600,
  onCanvasReady,
  onSelectionChanged,
  readOnly = false
}) => {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dimensiones en píxeles (1mm = 3.78 pixels a 96 DPI)
  const getDimensions = () => {
    const size = PAGE_SIZES[pageSize] || PAGE_SIZES.OFICIO_MEXICO;
    return {
      width: size.width * 3.78,  // mm a pixels
      height: size.height * 3.78,
      mmWidth: size.width,
      mmHeight: size.height
    };
  };
  
  // Inicializar canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const dimensions = getDimensions();
    
    try {
      // Crear canvas de Fabric.js
      const canvas = new fabric.Canvas(canvasRef.current, {
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: '#ffffff',
        selectionColor: 'rgba(170, 230, 217, 0.3)',
        selectionBorderColor: '#aae6d9',
        selectionLineWidth: 2,
        preserveObjectStacking: true,
        allowTouchScrolling: true,
        stopContextMenu: true,
        fireRightClick: true,
        fireMiddleClick: false
      });
      
      fabricCanvasRef.current = canvas;
      
      // Configurar eventos
      canvas.on('selection:created', (e) => {
        if (onSelectionChanged) {
          onSelectionChanged(e.selected);
        }
      });
      
      canvas.on('selection:updated', (e) => {
        if (onSelectionChanged) {
          onSelectionChanged(e.selected);
        }
      });
      
      canvas.on('selection:cleared', () => {
        if (onSelectionChanged) {
          onSelectionChanged([]);
        }
      });
      
      // Notificar que el canvas está listo
      if (onCanvasReady) {
        onCanvasReady(canvas);
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error inicializando canvas:', err);
      setError('Error al inicializar el editor');
      setIsLoading(false);
    }
    
    // Cleanup
    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []);
  
  // Cargar PDF como fondo
  useEffect(() => {
    if (!fabricCanvasRef.current || !pdfUrl) return;
    
    const loadPdfBackground = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Usar una imagen como placeholder (en producción, convertir PDF a imagen)
        fabric.Image.fromURL(pdfUrl, (img) => {
          if (!fabricCanvasRef.current) return;
          
          // Escalar imagen para que quepa en el canvas
          const canvas = fabricCanvasRef.current;
          const scaleX = canvas.width / img.width;
          const scaleY = canvas.height / img.height;
          const scale = Math.min(scaleX, scaleY);
          
          img.scale(scale);
          img.set({
            left: (canvas.width - img.width * scale) / 2,
            top: (canvas.height - img.height * scale) / 2,
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
            name: 'background'
          });
          
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
          setIsLoading(false);
        }, {
          crossOrigin: 'anonymous'
        });
      } catch (err) {
        console.error('Error cargando PDF:', err);
        setError('No se pudo cargar el PDF como fondo');
        setIsLoading(false);
      }
    };
    
    loadPdfBackground();
  }, [pdfUrl]);
  
  const dimensions = getDimensions();
  
  return (
    <Box sx={{ position: 'relative' }}>
      {/* Información del tamaño */}
      <Paper sx={{ p: 1.5, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Tamaño: {PAGE_SIZES[pageSize]?.name} ({dimensions.mmWidth.toFixed(1)}mm × {dimensions.mmHeight.toFixed(1)}mm)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {Math.round(dimensions.width)}px × {Math.round(dimensions.height)}px
        </Typography>
      </Paper>
      
      {/* Contenedor del canvas */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: height,
          border: '2px dashed #aae6d9',
          borderRadius: 1,
          overflow: 'auto',
          bgcolor: '#f8f9fa'
        }}
      >
        {isLoading && (
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.8)',
            zIndex: 10
          }}>
            <CircularProgress />
          </Box>
        )}
        
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              position: 'absolute',
              top: 16,
              left: 16,
              right: 16,
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
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        />
      </Box>
      
      {/* Guías de ayuda */}
      {!isLoading && !error && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          💡 Haz clic para seleccionar elementos, arrastra para mover, usa las teclas ←↑↓→ para ajustar posición
        </Typography>
      )}
    </Box>
  );
};

// Métodos para manipular el canvas desde fuera
TemplateCanvas.addTextField = (canvas, options = {}) => {
  if (!canvas) return null;
  
  const defaultOptions = {
    text: 'Texto de ejemplo',
    left: 100,
    top: 100,
    width: 200,
    fontSize: 12,
    fontFamily: 'Arial',
    fill: '#000000',
    textAlign: 'left',
    lineHeight: 1.2,
    editable: true
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  const textbox = new fabric.Textbox(mergedOptions.text, {
    left: mergedOptions.left,
    top: mergedOptions.top,
    width: mergedOptions.width,
    fontSize: mergedOptions.fontSize,
    fontFamily: mergedOptions.fontFamily,
    fill: mergedOptions.fill,
    textAlign: mergedOptions.textAlign,
    lineHeight: mergedOptions.lineHeight,
    editable: mergedOptions.editable,
    hasControls: true,
    hasBorders: true,
    lockUniScaling: false,
    lockScalingFlip: true,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
    name: 'text_field',
    type: 'text',
    metadata: {
      createdAt: new Date().toISOString(),
      fieldType: 'text'
    }
  });
  
  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  canvas.renderAll();
  
  return textbox;
};

TemplateCanvas.addDynamicField = (canvas, fieldName, options = {}) => {
  if (!canvas) return null;
  
  const defaultOptions = {
    left: 100,
    top: 100,
    width: 150,
    fontSize: 12,
    fontFamily: 'Arial',
    fill: '#000000',
    textAlign: 'left'
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Crear un campo dinámico (texto con marcador especial)
  const dynamicText = `<<${fieldName}>>`;
  const textbox = new fabric.Textbox(dynamicText, {
    left: mergedOptions.left,
    top: mergedOptions.top,
    width: mergedOptions.width,
    fontSize: mergedOptions.fontSize,
    fontFamily: mergedOptions.fontFamily,
    fill: mergedOptions.fill,
    textAlign: mergedOptions.textAlign,
    hasControls: true,
    hasBorders: true,
    padding: 4,
    backgroundColor: 'rgba(170, 230, 217, 0.2)',
    borderColor: '#aae6d9',
    name: 'dynamic_field',
    type: 'dynamic',
    metadata: {
      fieldName: fieldName,
      fieldType: 'dynamic',
      createdAt: new Date().toISOString()
    }
  });
  
  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  canvas.renderAll();
  
  return textbox;
};

TemplateCanvas.getCanvasState = (canvas) => {
  if (!canvas) return null;
  
  const objects = canvas.getObjects();
  const state = {
    objects: objects.map(obj => ({
      type: obj.type,
      left: obj.left,
      top: obj.top,
      width: obj.width,
      height: obj.height,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      angle: obj.angle,
      fill: obj.fill,
      fontSize: obj.fontSize,
      fontFamily: obj.fontFamily,
      textAlign: obj.textAlign,
      text: obj.text,
      metadata: obj.metadata || {},
      name: obj.name
    })),
    backgroundImage: canvas.backgroundImage ? {
      src: canvas.backgroundImage._element.src,
      scaleX: canvas.backgroundImage.scaleX,
      scaleY: canvas.backgroundImage.scaleY,
      left: canvas.backgroundImage.left,
      top: canvas.backgroundImage.top
    } : null
  };
  
  return state;
};

TemplateCanvas.loadCanvasState = (canvas, state) => {
  if (!canvas || !state) return;
  
  // Limpiar canvas
  canvas.clear();
  
  // Cargar fondo si existe
  if (state.backgroundImage) {
    fabric.Image.fromURL(state.backgroundImage.src, (img) => {
      img.set({
        scaleX: state.backgroundImage.scaleX,
        scaleY: state.backgroundImage.scaleY,
        left: state.backgroundImage.left,
        top: state.backgroundImage.top,
        selectable: false,
        evented: false
      });
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
    });
  }
  
  // Cargar objetos
  state.objects.forEach(objData => {
    let fabricObj;
    
    if (objData.type === 'textbox') {
      fabricObj = new fabric.Textbox(objData.text || '', {
        left: objData.left,
        top: objData.top,
        width: objData.width,
        height: objData.height,
        scaleX: objData.scaleX,
        scaleY: objData.scaleY,
        angle: objData.angle,
        fill: objData.fill,
        fontSize: objData.fontSize,
        fontFamily: objData.fontFamily,
        textAlign: objData.textAlign,
        hasControls: true,
        hasBorders: true,
        name: objData.name,
        metadata: objData.metadata
      });
    }
    // Puedes agregar más tipos aquí
    
    if (fabricObj) {
      canvas.add(fabricObj);
    }
  });
  
  canvas.renderAll();
};

export default TemplateCanvas;