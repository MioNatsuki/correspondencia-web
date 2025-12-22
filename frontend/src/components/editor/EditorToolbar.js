// frontend/src/components/editor/EditorToolbar.js
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Popover,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Slider,
  Grid,
  Chip,
  Badge
} from '@mui/material';
import {
  AiOutlineBold,
  AiOutlineItalic,
  AiOutlineUnderline,
  AiOutlineAlignLeft,
  AiOutlineAlignCenter,
  AiOutlineAlignRight,
  AiOutlineSave,
  AiOutlineEye,
  AiOutlineUndo,
  AiOutlineRedo,
  AiOutlineDelete,
  AiOutlineCopy,
  AiOutlineScissor,
  AiOutlineOrderedList,
  AiOutlineUnorderedList,
  AiOutlineLineHeight,
  AiOutlineBgColors,
  AiOutlineBorder,
  AiOutlineZoomIn,
  AiOutlineZoomOut,
  AiOutlineFullscreen,
  AiOutlineLayout,
  AiOutlineFontSize,
  AiOutlineFontColors
} from 'react-icons/ai';
import ContentPasteOutlined from '@mui/icons-material/ContentPasteOutlined';
import FormatColorTextOutlined from '@mui/icons-material/FormatColorTextOutlined';
import FontDownloadOutlined from '@mui/icons-material/FontDownloadOutlined';
import TableViewOutlined from '@mui/icons-material/TableViewOutlined';
import FormatSizeOutlined from '@mui/icons-material/FormatSizeOutlined';
import { BiText } from 'react-icons/bi';
import { MdOutlineFormatColorText, MdOutlineBorderColor } from 'react-icons/md';
import { COLORS, FONT_SIZES, AVAILABLE_FONTS, TEXT_ALIGN } from '../../utils/constants';

const EditorToolbar = ({
  onAddTextField,
  onAddDynamicField,
  onStyleChange,
  onAlignChange,
  onFontChange,
  onSizeChange,
  onColorChange,
  onBold,
  onItalic,
  onUnderline,
  onUndo,
  onRedo,
  onDelete,
  onCopy,
  onPaste,
  onCut,
  onSave,
  onPreview,
  availableFields = [],
  selectedObjects = [],
  readOnly = false
}) => {
  const [fontMenuAnchor, setFontMenuAnchor] = useState(null);
  const [sizeMenuAnchor, setSizeMenuAnchor] = useState(null);
  const [colorMenuAnchor, setColorMenuAnchor] = useState(null);
  const [fieldsMenuAnchor, setFieldsMenuAnchor] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  
  const handleFontClick = (event) => {
    setFontMenuAnchor(event.currentTarget);
  };
  
  const handleSizeClick = (event) => {
    setSizeMenuAnchor(event.currentTarget);
  };
  
  const handleColorClick = (event) => {
    setColorMenuAnchor(event.currentTarget);
  };
  
  const handleFieldsClick = (event) => {
    setFieldsMenuAnchor(event.currentTarget);
  };
  
  const handleCloseAllMenus = () => {
    setFontMenuAnchor(null);
    setSizeMenuAnchor(null);
    setColorMenuAnchor(null);
    setFieldsMenuAnchor(null);
  };
  
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 10, 200);
    setZoomLevel(newZoom);
    if (onStyleChange) onStyleChange({ zoom: newZoom });
  };
  
  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 10, 50);
    setZoomLevel(newZoom);
    if (onStyleChange) onStyleChange({ zoom: newZoom });
  };
  
  const handleResetZoom = () => {
    setZoomLevel(100);
    if (onStyleChange) onStyleChange({ zoom: 100 });
  };
  
  const isTextSelected = selectedObjects.some(obj => 
    obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text'
  );
  
  const hasSelection = selectedObjects.length > 0;
  
  return (
    <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        
        {/* Grupo: Archivo */}
        <Box sx={{ display: 'flex', gap: 0.5, mr: 1, borderRight: '1px solid rgba(0,0,0,0.1)', pr: 1 }}>
          <Tooltip title="Guardar (Ctrl+S)">
            <span>
              <IconButton 
                size="small" 
                onClick={onSave}
                disabled={readOnly}
                sx={{ 
                  bgcolor: '#aae6d9',
                  color: '#2c3e50',
                  '&:hover': { bgcolor: '#7ab3a5' }
                }}
              >
                <AiOutlineSave />
              </IconButton>
            </span>
          </Tooltip>
          
          <Tooltip title="Vista previa">
            <IconButton size="small" onClick={onPreview}>
              <AiOutlineEye />
            </IconButton>
          </Tooltip>
        </Box>
        
        {/* Grupo: Deshacer/Rehacer */}
        <Box sx={{ display: 'flex', gap: 0.5, mr: 1, borderRight: '1px solid rgba(0,0,0,0.1)', pr: 1 }}>
          <Tooltip title="Deshacer (Ctrl+Z)">
            <IconButton size="small" onClick={onUndo} disabled={readOnly}>
              <AiOutlineUndo />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Rehacer (Ctrl+Y)">
            <IconButton size="small" onClick={onRedo} disabled={readOnly}>
              <AiOutlineRedo />
            </IconButton>
          </Tooltip>
        </Box>
        
        {/* Grupo: Portapapeles */}
        <Box sx={{ display: 'flex', gap: 0.5, mr: 1, borderRight: '1px solid rgba(0,0,0,0.1)', pr: 1 }}>
          <Tooltip title="Copiar (Ctrl+C)">
            <IconButton 
              size="small" 
              onClick={onCopy} 
              disabled={!hasSelection || readOnly}
            >
              <AiOutlineCopy />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Cortar (Ctrl+X)">
            <IconButton 
              size="small" 
              onClick={onCut} 
              disabled={!hasSelection || readOnly}
            >
              <AiOutlineScissor />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Pegar (Ctrl+V)">
            <IconButton size="small" onClick={onPaste} disabled={readOnly}>
              <ContentPasteOutlined /> 
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Eliminar (Del)">
            <IconButton 
              size="small" 
              onClick={onDelete} 
              disabled={!hasSelection || readOnly}
              sx={{ color: 'error.main' }}
            >
              <AiOutlineDelete />
            </IconButton>
          </Tooltip>
        </Box>
        
        {/* Grupo: Insertar */}
        <Box sx={{ display: 'flex', gap: 0.5, mr: 1, borderRight: '1px solid rgba(0,0,0,0.1)', pr: 1 }}>
          <Tooltip title="Insertar cuadro de texto">
            <IconButton 
              size="small" 
              onClick={onAddTextField}
              disabled={readOnly}
              sx={{ 
                bgcolor: 'rgba(170, 230, 217, 0.2)',
                '&:hover': { bgcolor: 'rgba(170, 230, 217, 0.3)' }
              }}
            >
              <BiText />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Insertar campo dinámico">
            <IconButton 
              size="small" 
              onClick={handleFieldsClick}
              disabled={readOnly || availableFields.length === 0}
              sx={{ 
                bgcolor: 'rgba(230, 176, 170, 0.2)',
                '&:hover': { bgcolor: 'rgba(230, 176, 170, 0.3)' }
              }}
            >
              <Badge 
                badgeContent={availableFields.length} 
                color="primary"
                max={99}
                sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', height: 16 } }}
              >
                <TableViewOutlined fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>
        </Box>
        
        {/* Grupo: Fuente (solo para texto) */}
        {isTextSelected && (
          <>
            <Box sx={{ display: 'flex', gap: 0.5, mr: 1, borderRight: '1px solid rgba(0,0,0,0.1)', pr: 1 }}>
              <Tooltip title="Fuente">
                <IconButton size="small" onClick={handleFontClick} disabled={readOnly}>
                  <FontDownloadOutlined />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Tamaño de fuente">
                <IconButton size="small" onClick={handleSizeClick} disabled={readOnly}>
                  <FormatSizeOutlined />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Color del texto">
                <IconButton size="small" onClick={handleColorClick} disabled={readOnly}>
                  <FormatColorTextOutlined />
                </IconButton>
              </Tooltip>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 0.5, mr: 1, borderRight: '1px solid rgba(0,0,0,0.1)', pr: 1 }}>
              <Tooltip title="Negrita (Ctrl+B)">
                <IconButton size="small" onClick={onBold} disabled={readOnly}>
                  <AiOutlineBold />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Cursiva (Ctrl+I)">
                <IconButton size="small" onClick={onItalic} disabled={readOnly}>
                  <AiOutlineItalic />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Subrayado (Ctrl+U)">
                <IconButton size="small" onClick={onUnderline} disabled={readOnly}>
                  <AiOutlineUnderline />
                </IconButton>
              </Tooltip>
            </Box>
            
            <Box sx={{ display: 'flex', gap: 0.5, mr: 1, borderRight: '1px solid rgba(0,0,0,0.1)', pr: 1 }}>
              <Tooltip title="Alinear a la izquierda">
                <IconButton size="small" onClick={() => onAlignChange && onAlignChange('left')} disabled={readOnly}>
                  <AiOutlineAlignLeft />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Centrar">
                <IconButton size="small" onClick={() => onAlignChange && onAlignChange('center')} disabled={readOnly}>
                  <AiOutlineAlignCenter />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Alinear a la derecha">
                <IconButton size="small" onClick={() => onAlignChange && onAlignChange('right')} disabled={readOnly}>
                  <AiOutlineAlignRight />
                </IconButton>
              </Tooltip>
            </Box>
          </>
        )}
        
        {/* Grupo: Zoom */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 'auto' }}>
          <Tooltip title="Zoom out">
            <IconButton size="small" onClick={handleZoomOut}>
              <AiOutlineZoomOut />
            </IconButton>
          </Tooltip>
          
          <Typography variant="body2" sx={{ minWidth: 45, textAlign: 'center' }}>
            {zoomLevel}%
          </Typography>
          
          <Tooltip title="Zoom in">
            <IconButton size="small" onClick={handleZoomIn}>
              <AiOutlineZoomIn />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Restablecer zoom">
            <Button 
              size="small" 
              variant="outlined" 
              onClick={handleResetZoom}
              sx={{ 
                height: 30, 
                fontSize: '0.75rem',
                minWidth: 60 
              }}
            >
              100%
            </Button>
          </Tooltip>
        </Box>
        
        {/* Indicador de selección */}
        {hasSelection && (
          <Chip
            label={`${selectedObjects.length} seleccionado${selectedObjects.length > 1 ? 's' : ''}`}
            size="small"
            sx={{ 
              bgcolor: 'rgba(170, 230, 217, 0.2)',
              color: '#7ab3a5',
              fontWeight: 500
            }}
          />
        )}
      </Box>
      
      {/* Menú de fuentes */}
      <Menu
        anchorEl={fontMenuAnchor}
        open={Boolean(fontMenuAnchor)}
        onClose={handleCloseAllMenus}
        PaperProps={{
          sx: { 
            maxHeight: 300,
            width: 200,
          }
        }}
      >
        {AVAILABLE_FONTS.map((font) => (
          <MenuItem 
            key={font}
            onClick={() => {
              if (onFontChange) onFontChange(font);
              handleCloseAllMenus();
            }}
            sx={{ fontFamily: font }}
          >
            {font}
          </MenuItem>
        ))}
      </Menu>
      
      {/* Menú de tamaños */}
      <Menu
        anchorEl={sizeMenuAnchor}
        open={Boolean(sizeMenuAnchor)}
        onClose={handleCloseAllMenus}
        PaperProps={{
          sx: { 
            maxHeight: 300,
            width: 100,
          }
        }}
      >
        {FONT_SIZES.map((size) => (
          <MenuItem 
            key={size}
            onClick={() => {
              if (onSizeChange) onSizeChange(size);
              handleCloseAllMenus();
            }}
          >
            <ListItemText primary={size} />
            <Typography variant="caption" color="text.secondary">
              pt
            </Typography>
          </MenuItem>
        ))}
      </Menu>
      
      {/* Menú de colores */}
      <Popover
        anchorEl={colorMenuAnchor}
        open={Boolean(colorMenuAnchor)}
        onClose={handleCloseAllMenus}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, width: 200 }}>
          <Typography variant="subtitle2" gutterBottom>
            Color del texto
          </Typography>
          <Grid container spacing={1}>
            {COLORS.map((color) => (
              <Grid item key={color}>
                <Tooltip title={color}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: color,
                      border: '1px solid rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'scale(1.1)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                      }
                    }}
                    onClick={() => {
                      if (onColorChange) onColorChange(color);
                      handleCloseAllMenus();
                    }}
                  />
                </Tooltip>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Popover>
      
      {/* Menú de campos disponibles */}
      <Menu
        anchorEl={fieldsMenuAnchor}
        open={Boolean(fieldsMenuAnchor)}
        onClose={handleCloseAllMenus}
        PaperProps={{
          sx: { 
            maxHeight: 400,
            width: 250,
          }
        }}
      >
        <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Campos disponibles
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Selecciona un campo para insertar
          </Typography>
        </Box>
        
        {availableFields.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No hay campos disponibles
            </Typography>
          </Box>
        ) : (
          availableFields.map((field) => (
            <MenuItem 
              key={field.nombre}
              onClick={() => {
                if (onAddDynamicField) onAddDynamicField(field.nombre);
                handleCloseAllMenus();
              }}
              sx={{ 
                borderLeft: '3px solid #aae6d9',
                mb: 0.5,
                '&:hover': {
                  bgcolor: 'rgba(170, 230, 217, 0.1)'
                }
              }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  {field.etiqueta || field.nombre}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {field.nombre} • {field.tipo}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>
    </Paper>
  );
};

export default EditorToolbar;