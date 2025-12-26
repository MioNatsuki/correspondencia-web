// frontend/src/api/plantillas.js - VERSIÓN COMPLETA
import api from './index';

export const plantillasAPI = {
  // Obtener plantillas
  getPlantillas: (params = {}) => 
    api.get('/plantillas', { params }).then(res => res.data),
  
  // Obtener una plantilla específica
  getPlantilla: (id, incluirCampos = false) => 
    api.get(`/plantillas/${id}?incluir_campos=${incluirCampos}`).then(res => res.data),
  
  // Crear plantilla
  createPlantilla: (formData) => 
    api.post('/plantillas', formData, {
      headers: { 
        'Content-Type': 'multipart/form-data',
      },
    }).then(res => res.data),
  
  // Actualizar plantilla
  updatePlantilla: (id, data) => 
    api.put(`/plantillas/${id}`, data).then(res => res.data),
  
  // Eliminar plantilla
  deletePlantilla: (id) => 
    api.delete(`/plantillas/${id}`).then(res => res.data),
  
  // ========== ENDPOINTS PARA EDITOR ==========
  
  // Obtener campos de una plantilla
  getCampos: (plantillaId) => 
    api.get(`/plantillas/${plantillaId}/campos`).then(res => res.data),
  
  // Guardar campos
  guardarCampos: (plantillaId, campos) => 
    api.post(`/plantillas/${plantillaId}/guardar-campos`, campos).then(res => res.data),
  
  // Campos disponibles del padrón
  getCamposDisponibles: (plantillaId) => 
    api.get(`/plantillas/${plantillaId}/campos-disponibles`).then(res => res.data),
  
  // Datos de ejemplo para preview
  getDatosEjemplo: (plantillaId, limit = 10) => 
    api.get(`/plantillas/${plantillaId}/datos-ejemplo?limit=${limit}`).then(res => res.data),
  
  // Generar preview
  generarPreview: (plantillaId, datos) => 
    api.post(`/plantillas/${plantillaId}/preview`, datos).then(res => res.data),
  
  // Subir/actualizar PDF
  uploadPdf: (plantillaId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/plantillas/${plantillaId}/upload-pdf`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  }
};