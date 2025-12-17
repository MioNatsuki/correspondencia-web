import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proyectosAPI } from '../api/proyectos';
import Swal from 'sweetalert2';

export const useProjects = () => {
  const queryClient = useQueryClient();

  // Obtener todos los proyectos
  const useProjectsData = (params = {}) => {
    return useQuery({
      queryKey: ['projects', params],
      queryFn: () => proyectosAPI.getProyectos(params),
    });
  };

  // Obtener un proyecto específico
  const useProjectData = (id, options = {}) => {
    return useQuery({
      queryKey: ['project', id],
      queryFn: () => proyectosAPI.getProyecto(id),
      enabled: !!id,
      ...options,
    });
  };

  // Crear proyecto
  const useCreateProject = () => {
    return useMutation({
      mutationFn: (data) => proyectosAPI.createProyecto(data),
      onSuccess: () => {
        queryClient.invalidateQueries(['projects']);
        Swal.fire({
          icon: 'success',
          title: '¡Proyecto creado!',
          text: 'El proyecto ha sido creado exitosamente',
          timer: 2000,
          showConfirmButton: false,
        });
      },
      onError: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.detail || 'Error creando proyecto',
        });
      },
    });
  };

  // Actualizar proyecto
  const useUpdateProject = (id) => {
    return useMutation({
      mutationFn: (data) => proyectosAPI.updateProyecto(id, data),
      onSuccess: () => {
        queryClient.invalidateQueries(['project', id]);
        queryClient.invalidateQueries(['projects']);
        Swal.fire({
          icon: 'success',
          title: '¡Proyecto actualizado!',
          text: 'Los cambios han sido guardados',
          timer: 2000,
          showConfirmButton: false,
        });
      },
      onError: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.detail || 'Error actualizando proyecto',
        });
      },
    });
  };

  // Eliminar proyecto
  const useDeleteProject = () => {
    return useMutation({
      mutationFn: ({ id, permanente }) => 
        proyectosAPI.deleteProyecto(id, permanente),
      onSuccess: () => {
        queryClient.invalidateQueries(['projects']);
        Swal.fire({
          icon: 'success',
          title: '¡Eliminado!',
          text: 'El proyecto ha sido eliminado',
          timer: 1500,
          showConfirmButton: false,
        });
      },
      onError: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.detail || 'Error eliminando proyecto',
        });
      },
    });
  };

  return {
    useProjectsData,
    useProjectData,
    useCreateProject,
    useUpdateProject,
    useDeleteProject,
  };
};