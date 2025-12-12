import axios from 'axios'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 segundos
})

// Interceptor para agregar token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // Si el error es 401 y no es un intento de refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        const refreshToken = localStorage.getItem('refresh_token')
        
        if (!refreshToken) {
          // No hay refresh token, forzar logout
          window.location.href = '/login?session=expired'
          return Promise.reject(error)
        }
        
        // Intentar refresh
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken
        })
        
        // Actualizar tokens
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        
        // Reintentar request original
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`
        return api(originalRequest)
        
      } catch (refreshError) {
        // Error en refresh, forzar logout
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
        window.location.href = '/login?session=expired'
        return Promise.reject(refreshError)
      }
    }
    
    // Mostrar error al usuario
    if (error.response?.status >= 500) {
      toast.error('Error del servidor. Por favor intente más tarde.')
    } else if (error.response?.status === 403) {
      toast.error('No tiene permisos para realizar esta acción.')
    } else if (error.response?.status === 404) {
      toast.error('Recurso no encontrado.')
    } else if (error.response?.data?.detail) {
      toast.error(error.response.data.detail)
    } else if (error.message === 'Network Error') {
      toast.error('Error de conexión. Verifique su red.')
    } else if (error.code === 'ECONNABORTED') {
      toast.error('La solicitud tardó demasiado. Intente de nuevo.')
    }
    
    return Promise.reject(error)
  }
)

// Helper para upload de archivos
api.upload = async (url, file, data = {}, onProgress = null) => {
  const formData = new FormData()
  
  // Agregar archivo
  if (file) {
    formData.append('file', file)
  }
  
  // Agregar otros datos
  Object.keys(data).forEach(key => {
    formData.append(key, data[key])
  })
  
  const config = {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onProgress
  }
  
  return api.post(url, formData, config)
}

export default api