import api from './index';

export const padronesAPI = {
  // Obtener todos los padrones
  getPadrones: async (params = {}) => {
    const response = await api.get('/padrones', { params });
    return response.data;
  },
  
  // Obtener columnas de un padrón
  getColumnasPadron: async (uuidPadron) => {
    const response = await api.get(`/padrones/${uuidPadron}/columnas`);
    return response.data;
  },
  
  // Obtener datos de ejemplo
  getDatosEjemplo: async (uuidPadron, limit = 5) => {
    const response = await api.get(`/padrones/${uuidPadron}/datos-ejemplo`, {
      params: { limit }
    });
    return response.data;
  },
  
  // Buscar en padrón
  buscarEnPadron: async (uuidPadron, columna, valor, exacto = true, limit = 20) => {
    const response = await api.get(`/padrones/${uuidPadron}/buscar`, {
      params: { columna, valor, exacto, limit }
    });
    return response.data;
  }
};