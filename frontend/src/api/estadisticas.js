import api from './index';

export const estadisticasAPI = {
  // Obtener estadísticas del dashboard
  getDashboardStats: async () => {
    const response = await api.get('/estadisticas/dashboard');
    return response.data;
  },
  
  // Obtener estadísticas de un usuario específico
  getUserStats: async (userId) => {
    const response = await api.get(`/estadisticas/usuario/${userId}`);
    return response.data;
  }
};