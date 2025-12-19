import api from './index';

export const padronesAPI = {
  // Obtener todos los padrones
  getPadrones: async (params = {}) => {
    const response = await api.get('/padrones', { params });
    return response.data;
  },
  
  // Obtener un padrón específico por UUID
  getPadron: async (uuidPadron) => {
    const response = await api.get(`/padrones/${uuidPadron}`);
    return response.data;
  },
  
  // Obtener columnas de un padrón
  getColumnasPadron: async (uuidPadron) => {
    const response = await api.get(`/padrones/${uuidPadron}/columnas`);
    return response.data;
  }
};