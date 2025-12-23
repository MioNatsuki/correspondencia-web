import React, { useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Button,
  Breadcrumbs,
  Link,
  Avatar,
  Tooltip,
  Fab,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import CustomButton from '../../components/ui/CustomButton';
import { plantillasAPI } from '../../api/plantillas'; // Lo crearemos en un momento
import { proyectosAPI } from '../../api/proyectos';
import Swal from 'sweetalert2';

import {
  AiOutlinePlus,
  AiOutlineEdit,
  AiOutlineDelete,
  AiOutlineEye,
  AiOutlineFilePdf,
  AiOutlineCalendar,
  AiOutlineReload,
  AiOutlineSearch,
} from 'react-icons/ai';
import { BsSortAlphaDown, BsSortAlphaUp } from 'react-icons/bs';

const PlantillasProyecto = () => {
  const { id: proyectoId } = useParams(); // id del proyecto
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [orden, setOrden] = useState('nombre_asc');

  // Obtener proyecto (para el breadcrumb y título)
  const { data: proyecto, isLoading: loadingProyecto } = useQuery({
    queryKey: ['proyecto', proyectoId],
    queryFn: () => proyectosAPI.getProyecto(proyectoId),
  });

  // Obtener plantillas del proyecto
  const {
    data: plantillas = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['plantillas-proyecto', proyectoId],
    queryFn: () => plantillasAPI.getPlantillas({ proyecto_id: proyectoId }),
  });

  // Filtrado y ordenamiento
  const plantillasFiltradas = React.useMemo(() => {
    if (!plantillas) return [];

    let filtered = [...plantillas];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.nombre?.toLowerCase().includes(term) ||
        p.descripcion?.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => {
      switch (orden) {
        case 'nombre_asc': return a.nombre?.localeCompare(b.nombre || '');
        case 'nombre_desc': return b.nombre?.localeCompare(a.nombre || '');
        case 'fecha_desc': return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
        case 'fecha_asc': return new Date(a.fecha_creacion) - new Date(b.fecha_creacion);
        default: return 0;
      }
    });

    return filtered;
  }, [plantillas, searchTerm, orden]);

  // Mutación eliminar plantilla
  const deleteMutation = useMutation({
    mutationFn: (plantillaId) => plantillasAPI.deletePlantilla(plantillaId),
    onSuccess: () => {
      queryClient.invalidateQueries(['plantillas-proyecto', proyectoId]);
      Swal.fire('¡Eliminada!', 'La plantilla ha sido eliminada', 'success');
    },
    onError: (err) => {
      Swal.fire('Error', err.response?.data?.detail || 'No se pudo eliminar', 'error');
    },
  });

  const handleDelete = (plantilla) => {
    Swal.fire({
      title: '¿Eliminar plantilla?',
      text: `"${plantilla.nombre}" será eliminada`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(plantilla.id);
      }
    });
  };

  const getPreviewUrl = (plantilla) => {
    if (plantilla.campos_json?.preview_url) {
      return `http://localhost:8000${plantilla.campos_json.preview_url}`;
    }
    return null;
  };

  if (isLoading || loadingProyecto) return <LoadingSpinner />;

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">Error cargando plantillas</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link component={RouterLink} to="/proyectos">Proyectos</Link>
        <Link component={RouterLink} to={`/proyectos/${proyectoId}`}>
          {proyecto?.nombre || 'Proyecto'}
        </Link>
        <Typography color="text.primary">Plantillas</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: '#e6b0aa' }}>
            <AiOutlineFilePdf />
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Plantillas de {proyecto?.nombre}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {plantillasFiltradas.length} plantilla{plantillasFiltradas.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>

        {isAdmin && (
          <CustomButton
            icon="add"
            onClick={() => navigate(`/plantillas/nueva?proyecto=${proyectoId}`)}
          >
            Nueva Plantilla
          </CustomButton>
        )}
      </Box>

      {/* Filtros */}
      <Paper sx={{ p: 3, mb: 4, borderRadius: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Buscar por nombre o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <AiOutlineSearch />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Ordenar por</InputLabel>
              <Select value={orden} onChange={(e) => setOrden(e.target.value)} label="Ordenar por">
                <MenuItem value="nombre_asc"><BsSortAlphaDown style={{ marginRight: 8 }} /> Nombre (A-Z)</MenuItem>
                <MenuItem value="nombre_desc"><BsSortAlphaUp style={{ marginRight: 8 }} /> Nombre (Z-A)</MenuItem>
                <MenuItem value="fecha_desc"><AiOutlineCalendar style={{ marginRight: 8 }} /> Más recientes</MenuItem>
                <MenuItem value="fecha_asc"><AiOutlineCalendar style={{ marginRight: 8 }} /> Más antiguas</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Lista de plantillas */}
      {plantillasFiltradas.length === 0 ? (
        <Paper sx={{ p: 8, textAlign: 'center', borderRadius: 3 }}>
          <AiOutlineFilePdf size={64} color="#e6b0aa" />
          <Typography variant="h6" sx={{ mt: 2 }}>
            No hay plantillas en este proyecto
          </Typography>
          {isAdmin && (
            <CustomButton
              icon="add"
              sx={{ mt: 3 }}
              onClick={() => navigate(`/plantillas/nueva?proyecto=${proyectoId}`)}
            >
              Crear la primera plantilla
            </CustomButton>
          )}
        </Paper>
      ) : (
        <Grid container spacing={4}>
          {plantillasFiltradas.map((plantilla) => (
            <Grid item xs={12} sm={6} md={4} key={plantilla.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Preview o placeholder */}
                <Box sx={{ height: 200, bgcolor: '#f5f5f5', position: 'relative' }}>
                  {getPreviewUrl(plantilla) ? (
                    <img
                      src={getPreviewUrl(plantilla)}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <AiOutlineFilePdf size={64} color="#e6b0aa" />
                    </Box>
                  )}
                  <Chip
                    label={plantilla.activa ? 'Activa' : 'Inactiva'}
                    size="small"
                    color={plantilla.activa ? 'success' : 'default'}
                    sx={{ position: 'absolute', top: 8, right: 8 }}
                  />
                </Box>

                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {plantilla.nombre}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {plantilla.descripcion || 'Sin descripción'}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Tooltip title="Número de páginas">
                      <Chip label={`Páginas: ${plantilla.campos_json?.paginas || 1}`} size="small" />
                    </Tooltip>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(plantilla.fecha_creacion).toLocaleDateString('es-MX')}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions>
                  <CustomButton
                    size="small"
                    variant="outlined"
                    onClick={() => navigate(`/plantillas/editar/${plantilla.id}`)}
                  >
                    Editar
                  </CustomButton>
                  {isAdmin && (
                    <IconButton color="error" onClick={() => handleDelete(plantilla)}>
                      <AiOutlineDelete />
                    </IconButton>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 32, right: 32, bgcolor: '#e6b0aa', '&:hover': { bgcolor: '#b27a75' } }}
        onClick={() => refetch()}
      >
        <AiOutlineReload />
      </Fab>
    </Container>
  );
};

export default PlantillasProyecto;