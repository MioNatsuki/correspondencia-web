import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const plantillasAPI = {
  getPlantillas: (params = {}) => api.get('/plantillas', { params }).then(res => res.data),
  getPlantilla: (id) => api.get(`/plantillas/${id}`).then(res => res.data),
  createPlantilla: (formData) => api.post('/plantillas', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(res => res.data),
  updatePlantilla: (id, data) => api.put(`/plantillas/${id}`, data).then(res => res.data),
  deletePlantilla: (id) => api.delete(`/plantillas/${id}`).then(res => res.data),
  updateCampos: (id, campos) => api.put(`/plantillas/${id}/campos`, campos).then(res => res.data),
};