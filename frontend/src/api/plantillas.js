import api from './index';

export const plantillasAPI = {
  getPlantillas: (params = {}) => api.get('/plantillas', { params }).then(res => res.data),
  getPlantilla: (id) => api.get(`/plantillas/${id}`).then(res => res.data),
  createPlantilla: (formData) => api.post('/plantillas', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data),
  updatePlantilla: (id, data) => api.put(`/plantillas/${id}`, data).then(res => res.data),
  deletePlantilla: (id) => api.delete(`/plantillas/${id}`).then(res => res.data),
  updateCampos: (id, campos) => api.put(`/plantillas/${id}/campos`, campos).then(res => res.data),
  getCamposDisponibles: (id) => 
    api.get(`/plantillas/${id}/campos-disponibles`).then(res => res.data),
  getDatosEjemplo: (id, limit = 5) =>
    api.get(`/plantillas/${id}/datos-ejemplo?limit=${limit}`).then(res => res.data),
  generarPreview: (id, datos) =>
    api.post(`/plantillas/${id}/preview`, datos).then(res => res.data),
  guardarCampos: (id, campos) =>
    api.put(`/plantillas/${id}/campos`, campos).then(res => res.data)
};