import api from './index';

export const plantillasAPI = {
  // Obtener todas las plantillas
  getPlantillas: async (params = {}) => {
    const response = await api.get('/plantillas', { params });
    return response.data;
  },
  
  // Obtener una plantilla específica
  getPlantilla: async (id, params = {}) => {
    const response = await api.get(`/plantillas/${id}`, { params });
    return response.data;
  },
  
  // Crear nueva plantilla
  createPlantilla: async (plantillaData) => {
    const response = await api.post('/plantillas', plantillaData);
    return response.data;
  },
  
  // Actualizar plantilla
  updatePlantilla: async (id, plantillaData) => {
    const response = await api.put(`/plantillas/${id}`, plantillaData);
    return response.data;
  },
  
  // Eliminar plantilla
  deletePlantilla: async (id) => {
    const response = await api.delete(`/plantillas/${id}`);
    return response.data;
  },
  
  // Obtener campos de plantilla
  getCamposPlantilla: async (id) => {
    const response = await api.get(`/plantillas/${id}/campos`);
    return response.data;
  },
  
  // Actualizar campos de plantilla
  updateCamposPlantilla: async (id, campos) => {
    const response = await api.put(`/plantillas/${id}/campos`, { campos });
    return response.data;
  },
  
  // Preview de plantilla
  previewPlantilla: async (id, datosEjemplo = {}) => {
    const response = await api.post(`/plantillas/${id}/preview`, datosEjemplo);
    return response.data;
  }
};