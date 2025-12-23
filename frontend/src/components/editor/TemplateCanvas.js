// frontend/src/components/editor/TemplateCanvas.js - VERSIÓN CORREGIDA
import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const containerRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fabricLoaded, setFabricLoaded] = useState(false);
  
  // Cargar Fabric.js dinámicamente
  useEffect(() => {
    let mounted = true;
    
    const loadFabric = async () => {
      try {
        // Importar Fabric.js dinámicamente para evitar problemas con SSR
        const fabric = await import('fabric');
        if (mounted) {
          window.fabric = fabric;
          setFabricLoaded(true);
        }
      } catch (err) {
        console.error('Error cargando Fabric.js:', err);
        if (mounted) {
          setError('No se pudo cargar el editor de gráficos');
          setIsLoading(false);
        }
      }
    };
    
    loadFabric();
    
    return () => {
      mounted = false;
    };
  }, []);
  
  // Inicializar canvas cuando Fabric.js esté cargado
  useEffect(() => {
    if (!fabricLoaded || !canvasRef.current) return;
    
    const dimensions = getDimensions();
    
    try {
      const { Canvas, Textbox, FabricImage } = window.fabric;
      
      // Crear canvas de Fabric.js
      const canvas = new Canvas(canvasRef.current, {
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: '#ffffff',
        selectionColor: 'rgba(170, 230, 217, 0.3)',
        selectionBorderColor: '#aae6d9',
        selectionLineWidth: 2,
        preserveObjectStacking: true
      });
      
      fabricCanvasRef.current = canvas;
      
      // Configurar eventos
      canvas.on('selection:created', (e) => {
        if (onSelectionChanged && e.selected) {
          onSelectionChanged(e.selected);
        }
      });
      
      canvas.on('selection:updated', (e) => {
        if (onSelectionChanged && e.selected) {
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
  }, [fabricLoaded, onCanvasReady, onSelectionChanged]);
  
  // Cargar PDF como fondo
  useEffect(() => {
    if (!fabricCanvasRef.current || !pdfUrl || !window.fabric) return;
    
    const loadPdfBackground = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { FabricImage } = window.fabric;
        
        FabricImage.fromURL(pdfUrl, {
          crossOrigin: 'anonymous'
        }).then((img) => {
          if (!fabricCanvasRef.current) return;
          
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
            hasBorders: false
          });
          
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
          setIsLoading(false);
        }).catch(err => {
          console.error('Error cargando imagen:', err);
          setError('No se pudo cargar el PDF como fondo');
          setIsLoading(false);
        });
      } catch (err) {
        console.error('Error cargando PDF:', err);
        setError('No se pudo cargar el PDF como fondo');
        setIsLoading(false);
      }
    };
    
    loadPdfBackground();
  }, [pdfUrl]);
  
  const getDimensions = () => {
    const size = PAGE_SIZES[pageSize] || PAGE_SIZES.OFICIO_MEXICO;
    return {
      width: size.width * 3.78,  // mm a pixels (96 DPI)
      height: size.height * 3.78,
      mmWidth: size.width,
      mmHeight: size.height
    };
  };
  
  const dimensions = getDimensions();
  
  if (!fabricLoaded) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Cargando editor...
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Información del tamaño */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Tamaño: {dimensions.mmWidth.toFixed(1)}mm × {dimensions.mmHeight.toFixed(1)}mm
        </Typography>
      </Paper>
      
      {/* Contenedor del canvas */}
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: '100%',
          height: `calc(100% - 80px)`,
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
            margin: '0 auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }}
        />
      </Box>
    </Box>
  );
};

// Métodos para manipular el canvas
TemplateCanvas.addTextField = (canvas, options = {}) => {
  if (!canvas || !window.fabric) return null;
  
  const { Textbox } = window.fabric;
  
  const defaultOptions = {
    text: 'Texto de ejemplo',
    left: 100,
    top: 100,
    width: 200,
    fontSize: 12,
    fontFamily: 'Arial',
    fill: '#000000',
    textAlign: 'left'
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  const textbox = new Textbox(mergedOptions.text, mergedOptions);
  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  canvas.renderAll();
  
  return textbox;
};

TemplateCanvas.addDynamicField = (canvas, fieldName, options = {}) => {
  if (!canvas || !window.fabric) return null;
  
  const { Textbox } = window.fabric;
  
  const dynamicText = `<<${fieldName}>>`;
  const textbox = new Textbox(dynamicText, {
    left: 100,
    top: 150,
    width: 150,
    fontSize: 12,
    fontFamily: 'Arial',
    fill: '#2196f3',
    backgroundColor: 'rgba(170, 230, 217, 0.2)',
    ...options
  });
  
  canvas.add(textbox);
  canvas.setActiveObject(textbox);
  canvas.renderAll();
  
  return textbox;
};

export default TemplateCanvas;