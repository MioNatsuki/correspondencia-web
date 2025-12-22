// frontend/src/components/editor/FieldsPanel.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Divider,
  Tooltip,
  Alert,
  CircularProgress,
  InputAdornment,
  Badge
} from '@mui/material';
import {
  AiOutlineSearch,
  AiOutlineField,
  AiOutlineInfoCircle,
  AiOutlineDrag,
  AiOutlineEye,
  AiOutlineFilter,
  AiOutlineSortAscending,
  AiOutlineSortDescending,
  AiOutlineReload
} from 'react-icons/ai';
import { BiText, BiCalendar, BiHash, BiCheckbox } from 'react-icons/bi';
import { useQuery } from '@tanstack/react-query';
import { plantillasAPI } from '../../api/plantillas';

const FieldsPanel = ({
  plantillaId,
  onFieldSelect,
  onFieldDragStart,
  selectedFields = [],
  readOnly = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterType, setFilterType] = useState('all');
  
  // Obtener columnas disponibles del padrón
  const { 
    data: columnasData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['columnas-disponibles', plantillaId],
    queryFn: () => plantillasAPI.getCamposDisponibles(plantillaId),
    enabled: !!plantillaId,
  });
  
  const columnas = columnasData?.columnas || [];
  const nombreTabla = columnasData?.nombre_tabla || '';
  
  // Iconos por tipo de campo
  const getFieldIcon = (tipo) => {
    const tipoLower = tipo?.toLowerCase() || '';
    
    if (tipoLower.includes('char') || tipoLower.includes('text') || tipoLower.includes('varchar')) {
      return <BiText color="#4caf50" />;
    } else if (tipoLower.includes('int') || tipoLower.includes('numeric') || tipoLower.includes('decimal')) {
      return <BiHash color="#2196f3" />;
    } else if (tipoLower.includes('date') || tipoLower.includes('time')) {
      return <BiCalendar color="#ff9800" />;
    } else if (tipoLower.includes('bool')) {
      return <BiCheckbox color="#9c27b0" />;
    } else {
      return <AiOutlineField color="#757575" />;
    }
  };
  
  // Filtrar y ordenar columnas
  const filteredColumns = React.useMemo(() => {
    let filtered = [...columnas];
    
    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(col => 
        col.nombre.toLowerCase().includes(term) ||
        (col.etiqueta && col.etiqueta.toLowerCase().includes(term))
      );
    }
    
    // Filtrar por tipo
    if (filterType !== 'all') {
      filtered = filtered.filter(col => {
        const tipo = col.tipo?.toLowerCase() || '';
        switch (filterType) {
          case 'text':
            return tipo.includes('char') || tipo.includes('text') || tipo.includes('varchar');
          case 'number':
            return tipo.includes('int') || tipo.includes('numeric') || tipo.includes('decimal') || tipo.includes('float');
          case 'date':
            return tipo.includes('date') || tipo.includes('time');
          case 'boolean':
            return tipo.includes('bool');
          default:
            return true;
        }
      });
    }
    
    // Ordenar
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.nombre.toLowerCase();
          bValue = b.nombre.toLowerCase();
          break;
        case 'type':
          aValue = a.tipo.toLowerCase();
          bValue = b.tipo.toLowerCase();
          break;
        case 'nullable':
          aValue = a.nullable ? 1 : 0;
          bValue = b.nullable ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return filtered;
  }, [columnas, searchTerm, filterType, sortBy, sortOrder]);
  
  const handleDragStart = (e, field) => {
    if (readOnly) return;
    
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'dynamic_field',
      fieldName: field.nombre,
      fieldLabel: field.etiqueta || field.nombre,
      fieldType: field.tipo
    }));
    
    if (onFieldDragStart) {
      onFieldDragStart(field);
    }
  };
  
  const handleFieldClick = (field) => {
    if (onFieldSelect) {
      onFieldSelect(field);
    }
  };
  
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };
  
  if (isLoading) {
    return (
      <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }
  
  if (error) {
    return (
      <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
        <Alert 
          severity="error"
          action={
            <IconButton size="small" onClick={() => refetch()}>
              <AiOutlineReload />
            </IconButton>
          }
        >
          Error cargando campos: {error.message}
        </Alert>
      </Paper>
    );
  }
  
  if (columnas.length === 0) {
    return (
      <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <AiOutlineField size={48} color="#e6b0aa" style={{ opacity: 0.5, marginBottom: 16 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No hay campos disponibles
          </Typography>
          <Typography variant="body2" color="text.secondary">
            El proyecto no tiene un padrón asignado o el padrón no tiene columnas.
          </Typography>
        </Box>
      </Paper>
    );
  }
  
  return (
    <Paper sx={{ p: 2.5, height: '100%', borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" fontWeight={600}>
            Campos Disponibles
          </Typography>
          <Badge 
            badgeContent={filteredColumns.length} 
            color="primary"
            sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem', height: 20, minWidth: 20 } }}
          />
        </Box>
        
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Arrastra campos al editor o haz clic para insertar
          {nombreTabla && (
            <>
              <br />
              Padrón: <strong>{nombreTabla}</strong>
            </>
          )}
        </Typography>
        
        {/* Búsqueda */}
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar campo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <AiOutlineSearch />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')}>
                  <AiOutlineClose />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
        />
        
        {/* Filtros y ordenamiento */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip
            label="Todos"
            size="small"
            onClick={() => setFilterType('all')}
            color={filterType === 'all' ? 'primary' : 'default'}
            sx={{ 
              bgcolor: filterType === 'all' ? 'rgba(170, 230, 217, 0.2)' : 'transparent',
              color: filterType === 'all' ? '#7ab3a5' : 'inherit'
            }}
          />
          <Chip
            label="Texto"
            size="small"
            onClick={() => setFilterType('text')}
            color={filterType === 'text' ? 'primary' : 'default'}
            sx={{ 
              bgcolor: filterType === 'text' ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
              color: filterType === 'text' ? '#4caf50' : 'inherit'
            }}
          />
          <Chip
            label="Números"
            size="small"
            onClick={() => setFilterType('number')}
            color={filterType === 'number' ? 'primary' : 'default'}
            sx={{ 
              bgcolor: filterType === 'number' ? 'rgba(33, 150, 243, 0.1)' : 'transparent',
              color: filterType === 'number' ? '#2196f3' : 'inherit'
            }}
          />
          <Chip
            label="Fechas"
            size="small"
            onClick={() => setFilterType('date')}
            color={filterType === 'date' ? 'primary' : 'default'}
            sx={{ 
              bgcolor: filterType === 'date' ? 'rgba(255, 152, 0, 0.1)' : 'transparent',
              color: filterType === 'date' ? '#ff9800' : 'inherit'
            }}
          />
        </Box>
        
        {/* Ordenamiento */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Ordenar por:
          </Typography>
          <Chip
            label="Nombre"
            size="small"
            onClick={() => toggleSort('name')}
            icon={sortBy === 'name' ? 
              (sortOrder === 'asc' ? <AiOutlineSortAscending /> : <AiOutlineSortDescending />) : 
              undefined
            }
            sx={{ 
              bgcolor: sortBy === 'name' ? 'rgba(170, 230, 217, 0.2)' : 'transparent',
              color: sortBy === 'name' ? '#7ab3a5' : 'inherit'
            }}
          />
          <Chip
            label="Tipo"
            size="small"
            onClick={() => toggleSort('type')}
            icon={sortBy === 'type' ? 
              (sortOrder === 'asc' ? <AiOutlineSortAscending /> : <AiOutlineSortDescending />) : 
              undefined
            }
            sx={{ 
              bgcolor: sortBy === 'type' ? 'rgba(170, 230, 217, 0.2)' : 'transparent',
              color: sortBy === 'type' ? '#7ab3a5' : 'inherit'
            }}
          />
        </Box>
      </Box>
      
      <Divider sx={{ mb: 2 }} />
      
      {/* Lista de campos */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List dense sx={{ p: 0 }}>
          {filteredColumns.map((field, index) => {
            const isSelected = selectedFields.some(f => f.nombre === field.nombre);
            
            return (
              <React.Fragment key={field.nombre}>
                <ListItem
                  sx={{
                    p: 1.5,
                    mb: 0.5,
                    borderRadius: 1,
                    cursor: readOnly ? 'default' : 'pointer',
                    bgcolor: isSelected ? 'rgba(170, 230, 217, 0.15)' : 'transparent',
                    border: isSelected ? '1px solid #aae6d9' : '1px solid transparent',
                    '&:hover': {
                      bgcolor: readOnly ? 'transparent' : 'rgba(0,0,0,0.03)',
                      borderColor: readOnly ? 'transparent' : '#aae6d9'
                    },
                    userSelect: 'none'
                  }}
                  draggable={!readOnly}
                  onDragStart={(e) => handleDragStart(e, field)}
                  onClick={() => handleFieldClick(field)}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    {getFieldIcon(field.tipo)}
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={500}>
                        {field.etiqueta || field.nombre}
                      </Typography>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {field.nombre}
                        </Typography>
                        <Chip
                          label={field.tipo}
                          size="small"
                          sx={{ 
                            height: 18,
                            fontSize: '0.6rem',
                            bgcolor: 'rgba(0,0,0,0.05)'
                          }}
                        />
                        {field.nullable && (
                          <Chip
                            label="Nulo"
                            size="small"
                            sx={{ 
                              height: 18,
                              fontSize: '0.6rem',
                              bgcolor: 'rgba(255,152,0,0.1)',
                              color: '#ff9800'
                            }}
                          />
                        )}
                      </Box>
                    }
                  />
                  
                  {!readOnly && (
                    <Tooltip title="Arrastrar para insertar">
                      <IconButton 
                        size="small" 
                        sx={{ 
                          color: 'text.secondary',
                          '&:hover': { color: '#aae6d9' }
                        }}
                      >
                        <AiOutlineDrag />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItem>
                
                {index < filteredColumns.length - 1 && (
                  <Divider sx={{ my: 0.5, opacity: 0.1 }} />
                )}
              </React.Fragment>
            );
          })}
        </List>
        
        {filteredColumns.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AiOutlineSearch size={32} color="#e6b0aa" style={{ opacity: 0.5, marginBottom: 12 }} />
            <Typography variant="body2" color="text.secondary">
              No se encontraron campos con "{searchTerm}"
            </Typography>
          </Box>
        )}
      </Box>
      
      {/* Footer con información */}
      <Divider sx={{ mt: 2, mb: 1.5 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AiOutlineInfoCircle size={14} color="#a1a1a1" />
        <Typography variant="caption" color="text.secondary">
          {filteredColumns.length} de {columnas.length} campos mostrados
        </Typography>
      </Box>
    </Paper>
  );
};

export default FieldsPanel;