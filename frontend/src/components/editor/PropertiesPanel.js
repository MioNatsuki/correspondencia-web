// frontend/src/components/editor/PropertiesPanel.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Divider,
  Button,
  IconButton,
  Grid,
  Switch,
  FormControlLabel,
  ColorPicker
} from '@mui/material';
import {
  AiOutlineSave,
  AiOutlineClose,
  AiOutlineFont,
  AiOutlineFontSize,
  AiOutlineFontColors,
  AiOutlineAlignLeft,
  AiOutlineAlignCenter,
  AiOutlineAlignRight,
  AiOutlineOrderedList,
  AiOutlineUnorderedList,
  AiOutlineBold,
  AiOutlineItalic,
  AiOutlineUnderline,
  AiOutlineLineHeight
} from 'react-icons/ai';
import { AVAILABLE_FONTS, FONT_SIZES, TEXT_ALIGN, COLORS } from '../../utils/constants';

const PropertiesPanel = ({
  selectedObject,
  onPropertyChange,
  readOnly = false
}) => {
  const [localProperties, setLocalProperties] = useState({});
  
  // Sincronizar propiedades cuando cambia el objeto seleccionado
  useEffect(() => {
    if (!selectedObject) {
      setLocalProperties({});
      return;
    }
    
    const props = {
      text: selectedObject.text || '',
      fontSize: selectedObject.fontSize || 12,
      fontFamily: selectedObject.fontFamily || 'Arial',
      fill: selectedObject.fill || '#000000',
      textAlign: selectedObject.textAlign || 'left',
      left: selectedObject.left || 0,
      top: selectedObject.top || 0,
      width: selectedObject.width || 100,
      height: selectedObject.height || 50,
      scaleX: selectedObject.scaleX || 1,
      scaleY: selectedObject.scaleY || 1,
      angle: selectedObject.angle || 0,
      fontWeight: selectedObject.fontWeight || 'normal',
      fontStyle: selectedObject.fontStyle || 'normal',
      textDecoration: selectedObject.textDecoration || '',
      lineHeight: selectedObject.lineHeight || 1.2,
      opacity: selectedObject.opacity || 1,
      backgroundColor: selectedObject.backgroundColor || 'transparent',
      stroke: selectedObject.stroke || null,
      strokeWidth: selectedObject.strokeWidth || 0,
      ...selectedObject.metadata
    };
    
    setLocalProperties(props);
  }, [selectedObject]);
  
  const handlePropertyChange = (property, value) => {
    const newProps = { ...localProperties, [property]: value };
    setLocalProperties(newProps);
    
    // Propagar cambios al objeto
    if (onPropertyChange) {
      onPropertyChange(property, value);
    }
  };
  
  const handleApplyAll = () => {
    if (!onPropertyChange || !selectedObject) return;
    
    // Aplicar todas las propiedades
    Object.entries(localProperties).forEach(([key, value]) => {
      onPropertyChange(key, value);
    });
  };
  
  const handleReset = () => {
    if (!selectedObject) return;
    
    // Resetear a propiedades originales
    const originalProps = {
      text: selectedObject.text || '',
      fontSize: selectedObject.fontSize || 12,
      fontFamily: selectedObject.fontFamily || 'Arial',
      fill: selectedObject.fill || '#000000',
      textAlign: selectedObject.textAlign || 'left',
      left: selectedObject.left || 0,
      top: selectedObject.top || 0,
      width: selectedObject.width || 100,
      height: selectedObject.height || 50,
      scaleX: selectedObject.scaleX || 1,
      scaleY: selectedObject.scaleY || 1,
      angle: selectedObject.angle || 0
    };
    
    setLocalProperties(originalProps);
    
    // Aplicar reset
    Object.entries(originalProps).forEach(([key, value]) => {
      if (onPropertyChange) onPropertyChange(key, value);
    });
  };
  
  if (!selectedObject) {
    return (
      <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Sin selección
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Selecciona un elemento en el editor para ver sus propiedades
          </Typography>
        </Box>
      </Paper>
    );
  }
  
  const isTextField = selectedObject.type === 'textbox' || 
                     selectedObject.type === 'i-text' || 
                     selectedObject.type === 'text';
  
  return (
    <Paper sx={{ p: 2.5, height: '100%', borderRadius: 2, overflow: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Propiedades
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              size="small" 
              variant="outlined" 
              onClick={handleReset}
              disabled={readOnly}
              startIcon={<AiOutlineClose />}
            >
              Resetear
            </Button>
            <Button 
              size="small" 
              variant="contained" 
              onClick={handleApplyAll}
              disabled={readOnly}
              startIcon={<AiOutlineSave />}
              sx={{ bgcolor: '#aae6d9', '&:hover': { bgcolor: '#7ab3a5' } }}
            >
              Aplicar
            </Button>
          </Box>
        </Box>
        
        <Typography variant="caption" color="text.secondary">
          Tipo: {selectedObject.type} • ID: {selectedObject.name || 'Sin nombre'}
        </Typography>
      </Box>
      
      <Divider sx={{ mb: 3 }} />
      
      {/* Propiedades de posición y tamaño */}
      <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: '#7ab3a5' }}>
        Posición y Tamaño
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Posición X"
            type="number"
            size="small"
            value={Math.round(localProperties.left || 0)}
            onChange={(e) => handlePropertyChange('left', parseFloat(e.target.value))}
            disabled={readOnly}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Posición Y"
            type="number"
            size="small"
            value={Math.round(localProperties.top || 0)}
            onChange={(e) => handlePropertyChange('top', parseFloat(e.target.value))}
            disabled={readOnly}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Ancho"
            type="number"
            size="small"
            value={Math.round(localProperties.width || 0)}
            onChange={(e) => handlePropertyChange('width', parseFloat(e.target.value))}
            disabled={readOnly}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Alto"
            type="number"
            size="small"
            value={Math.round(localProperties.height || 0)}
            onChange={(e) => handlePropertyChange('height', parseFloat(e.target.value))}
            disabled={readOnly}
          />
        </Grid>
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Rotación
          </Typography>
          <Slider
            value={localProperties.angle || 0}
            onChange={(e, value) => handlePropertyChange('angle', value)}
            min={0}
            max={360}
            step={1}
            valueLabelDisplay="auto"
            disabled={readOnly}
          />
        </Grid>
      </Grid>
      
      {/* Propiedades de texto (solo para elementos de texto) */}
      {isTextField && (
        <>
          <Divider sx={{ mb: 3 }} />
          
          <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: '#b27a75' }}>
            Texto y Fuente
          </Typography>
          
          <TextField
            fullWidth
            label="Contenido"
            multiline
            rows={3}
            value={localProperties.text || ''}
            onChange={(e) => handlePropertyChange('text', e.target.value)}
            disabled={readOnly}
            sx={{ mb: 2 }}
          />
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Fuente</InputLabel>
                <Select
                  value={localProperties.fontFamily || 'Arial'}
                  label="Fuente"
                  onChange={(e) => handlePropertyChange('fontFamily', e.target.value)}
                  disabled={readOnly}
                >
                  {AVAILABLE_FONTS.map((font) => (
                    <MenuItem key={font} value={font} sx={{ fontFamily: font }}>
                      {font}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Tamaño</InputLabel>
                <Select
                  value={localProperties.fontSize || 12}
                  label="Tamaño"
                  onChange={(e) => handlePropertyChange('fontSize', e.target.value)}
                  disabled={readOnly}
                >
                  {FONT_SIZES.map((size) => (
                    <MenuItem key={size} value={size}>
                      {size} pt
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Alineación</InputLabel>
                <Select
                  value={localProperties.textAlign || 'left'}
                  label="Alineación"
                  onChange={(e) => handlePropertyChange('textAlign', e.target.value)}
                  disabled={readOnly}
                >
                  <MenuItem value="left">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AiOutlineAlignLeft />
                      <span>Izquierda</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AiOutlineAlignCenter />
                      <span>Centro</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AiOutlineAlignRight />
                      <span>Derecha</span>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Interlineado"
                type="number"
                size="small"
                InputProps={{
                  inputProps: { 
                    min: 0.5, 
                    max: 3, 
                    step: 0.1 
                  }
                }}
                value={localProperties.lineHeight || 1.2}
                onChange={(e) => handlePropertyChange('lineHeight', parseFloat(e.target.value))}
                disabled={readOnly}
              />
            </Grid>
          </Grid>
          
          {/* Estilos de texto */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Estilos
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant={localProperties.fontWeight === 'bold' ? 'contained' : 'outlined'}
                onClick={() => handlePropertyChange('fontWeight', 
                  localProperties.fontWeight === 'bold' ? 'normal' : 'bold'
                )}
                disabled={readOnly}
                startIcon={<AiOutlineBold />}
                sx={{ 
                  minWidth: 'auto',
                  px: 1.5,
                  bgcolor: localProperties.fontWeight === 'bold' ? '#aae6d9' : 'transparent'
                }}
              >
                N
              </Button>
              
              <Button
                size="small"
                variant={localProperties.fontStyle === 'italic' ? 'contained' : 'outlined'}
                onClick={() => handlePropertyChange('fontStyle', 
                  localProperties.fontStyle === 'italic' ? 'normal' : 'italic'
                )}
                disabled={readOnly}
                startIcon={<AiOutlineItalic />}
                sx={{ 
                  minWidth: 'auto',
                  px: 1.5,
                  bgcolor: localProperties.fontStyle === 'italic' ? '#aae6d9' : 'transparent'
                }}
              >
                I
              </Button>
              
              <Button
                size="small"
                variant={localProperties.textDecoration === 'underline' ? 'contained' : 'outlined'}
                onClick={() => handlePropertyChange('textDecoration', 
                  localProperties.textDecoration === 'underline' ? '' : 'underline'
                )}
                disabled={readOnly}
                startIcon={<AiOutlineUnderline />}
                sx={{ 
                  minWidth: 'auto',
                  px: 1.5,
                  bgcolor: localProperties.textDecoration === 'underline' ? '#aae6d9' : 'transparent'
                }}
              >
                S
              </Button>
            </Box>
          </Box>
          
          {/* Color del texto */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Color del texto
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: 1,
                  bgcolor: localProperties.fill || '#000000',
                  border: '2px solid #ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  cursor: readOnly ? 'default' : 'pointer'
                }}
                onClick={() => !readOnly && handlePropertyChange('fill', '#FF0000')}
              />
              <TextField
                size="small"
                value={localProperties.fill || '#000000'}
                onChange={(e) => handlePropertyChange('fill', e.target.value)}
                disabled={readOnly}
                sx={{ flexGrow: 1 }}
              />
            </Box>
          </Box>
        </>
      )}
      
      {/* Propiedades adicionales */}
      <Divider sx={{ mb: 3 }} />
      
      <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: '#9a9d94' }}>
        Apariencia
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Opacidad
          </Typography>
          <Slider
            value={(localProperties.opacity || 1) * 100}
            onChange={(e, value) => handlePropertyChange('opacity', value / 100)}
            min={0}
            max={100}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${value}%`}
            disabled={readOnly}
          />
        </Grid>
        
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={!!localProperties.backgroundColor && localProperties.backgroundColor !== 'transparent'}
                onChange={(e) => handlePropertyChange('backgroundColor', 
                  e.target.checked ? 'rgba(170, 230, 217, 0.3)' : 'transparent'
                )}
                disabled={readOnly}
              />
            }
            label="Fondo visible"
          />
        </Grid>
      </Grid>
      
      {/* Metadatos personalizados */}
      {selectedObject.metadata && Object.keys(selectedObject.metadata).length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ color: '#7ab3a5' }}>
            Metadatos
          </Typography>
          
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'rgba(0,0,0,0.02)' }}>
            {Object.entries(selectedObject.metadata).map(([key, value]) => (
              <Box key={key} sx={{ display: 'flex', mb: 1 }}>
                <Typography variant="caption" sx={{ minWidth: 120, fontWeight: 500 }}>
                  {key}:
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Typography>
              </Box>
            ))}
          </Paper>
        </>
      )}
    </Paper>
  );
};

export default PropertiesPanel;