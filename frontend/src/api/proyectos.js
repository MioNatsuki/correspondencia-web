import api from './index';

export const proyectosAPI = {
  // Obtener todos los proyectos
  getProyectos: async (params = {}) => {
    const response = await api.get('/proyectos', { params });
    return response.data;
  },
  
  // Obtener un proyecto específicodeleteProyecto:
  getProyecto: async (id) => {
    const response = await api.get(`/proyectos/${id}`);
    return response.data;
  },
  
  // Crear nuevo proyecto
  createProyecto: async (proyectoData) => {
    const response = await api.post('/proyectos', proyectoData);
    return response.data;
  },
  
  // Actualizar proyecto
  updateProyecto: async (id, proyectoData) => {
    const response = await api.put(`/proyectos/${id}`, proyectoData);
    return response.data;
  },
  
  // En proyectosAPI, actualizar:
deleteProyecto: async (id, eliminacionPermanente = false) => {
  const response = await api.delete(`/proyectos/${id}`, {
    params: { eliminacion_permanente: eliminacionPermanente }
  });
  return response.data;
},

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