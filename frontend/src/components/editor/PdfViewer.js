// frontend/src/components/editor/PdfViewer.js
import React, { useEffect, useState, useRef } from 'react';
import { Box, CircularProgress, Alert, IconButton } from '@mui/material';
import { AiOutlineZoomIn, AiOutlineZoomOut, AiOutlineFullscreen } from 'react-icons/ai';
import api from '../../api/index';
import { UPLOADS_BASE_URL } from '../../utils/constants';

const PdfViewer = ({ 
  plantillaId, 
  height = '100%', 
  width = '100%',
  showControls = false 
}) => {
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const cargarPdf = async () => {
      if (!plantillaId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Obtener la plantilla
        const response = await api.get(`/plantillas/${plantillaId}`);
        const plantilla = response.data;

        if (!plantilla || !plantilla.ruta_archivo) {
          throw new Error('La plantilla no tiene PDF asociado');
        }

        // Construir URL del PDF
        let urlPdf = '';
        
        if (plantilla.pdf_base) {
          // Si ya tenemos una URL normalizada
          urlPdf = `${UPLOADS_BASE_URL}${plantilla.pdf_base}`;
        } else if (plantilla.ruta_archivo) {
          // Normalizar ruta de Windows a URL
          const rutaNormalizada = plantilla.ruta_archivo
            .replace(/^\.\/uploads\\/, 'uploads/')
            .replace(/\\/g, '/');
          urlPdf = `${UPLOADS_BASE_URL}/${rutaNormalizada}`;
        }

        console.log('URL del PDF construida:', urlPdf);
        
        // Verificar que la URL sea válida
        if (!urlPdf.includes('.pdf')) {
          throw new Error('URL del PDF no válida');
        }

        setPdfUrl(urlPdf);

      } catch (error) {
        console.error('Error cargando PDF:', error);
        setError(`No se pudo cargar el PDF: ${error.message}`);
        
        // Mostrar PDF de ejemplo como fallback
        setPdfUrl('/ejemplo.pdf');
      } finally {
        setIsLoading(false);
      }
    };

    cargarPdf();
  }, [plantillaId]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        bgcolor: '#f5f5f5'
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        position: 'relative', 
        width, 
        height,
        overflow: 'auto',
        bgcolor: '#f5f5f5'
      }}
    >
      {/* Controles de zoom (opcional) */}
      {showControls && (
        <Box sx={{ 
          position: 'absolute', 
          top: 8, 
          right: 8, 
          zIndex: 10,
          display: 'flex', 
          gap: 1,
          bgcolor: 'rgba(255,255,255,0.9)',
          borderRadius: 1,
          p: 1,
          boxShadow: 2
        }}>
          <IconButton size="small" onClick={handleZoomOut} title="Zoom out">
            <AiOutlineZoomOut />
          </IconButton>
          <IconButton size="small" onClick={handleZoomReset} title="Zoom 100%">
            <Typography variant="caption">{Math.round(zoom * 100)}%</Typography>
          </IconButton>
          <IconButton size="small" onClick={handleZoomIn} title="Zoom in">
            <AiOutlineZoomIn />
          </IconButton>
        </Box>
      )}

      {/* Contenedor del PDF */}
      <Box
        sx={{
          transform: `scale(${zoom}) rotate(${rotation}deg)`,
          transformOrigin: 'top left',
          transition: 'transform 0.2s ease',
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}
      >
        {pdfUrl ? (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            title="PDF de plantilla"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              pointerEvents: 'none' // Para que no interfiera con Fabric.js
            }}
            onLoad={() => {
              console.log('PDF cargado en iframe');
              setIsLoading(false);
            }}
            onError={() => {
              setError('Error al cargar el PDF en el navegador');
              setIsLoading(false);
            }}
          />
        ) : (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%',
            width: '100%'
          }}>
            <Typography color="text.secondary">
              No hay PDF disponible
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PdfViewer;