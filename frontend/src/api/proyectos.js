import api from './index';

export const proyectosAPI = {
  // Obtener todos los proyectos
  getProyectos: async (params = {}) => {
    const response = await api.get('/proyectos', { params });
    return response.data;
  },
  
  // Obtener un proyecto específico
  getProyecto: async (id) => {
    const response = await api.get(`/proyectos/${id}`);
    return response.data;
  },
  
  // Crear nuevo proyecto
  createProyecto: async (formData) => {
    const response = await api.post('/proyectos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  // Actualizar proyecto
  updateProyecto: async (id, formData) => {
    const response = await api.put(`/proyectos/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  // Eliminar proyecto (CORREGIDO)
  deleteProyecto: async (id, eliminacionPermanente = false) => {
    const response = await api.delete(`/proyectos/${id}`, {
      params: { eliminacion_permanente: eliminacionPermanente }
    });
    return response.data;
  },
  
  // Restaurar proyecto
  restaurarProyecto: async (id) => {
    const response = await api.post(`/proyectos/${id}/restaurar`);
    return response.data;
  },
  
  // Obtener estadísticas del proyecto
  getEstadisticas: async (id) => {
    const response = await api.get(`/proyectos/${id}/estadisticas`);
    return response.data;
  }
};