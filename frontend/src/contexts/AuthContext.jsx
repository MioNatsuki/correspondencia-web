import React, { createContext, useState, useContext, useEffect } from 'react'
import api from '../services/api'
import authService from '../services/authService'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token')
    
    if (!token) {
      setLoading(false)
      return
    }
    
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
    } catch (error) {
      console.error('Error verificando autenticación:', error)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    setError(null)
    setLoading(true)
    
    try {
      const response = await authService.login(username, password)
      
      // Guardar tokens
      localStorage.setItem('access_token', response.access_token)
      localStorage.setItem('refresh_token', response.refresh_token)
      localStorage.setItem('user', JSON.stringify(response.usuario))
      
      setUser(response.usuario)
      return response
      
    } catch (error) {
      setError(error.response?.data?.detail || 'Error de autenticación')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Error en logout:', error)
    } finally {
      // Limpiar localStorage
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      
      setUser(null)
      window.location.href = '/login'
    }
  }

  const updateProfile = async (data) => {
    try {
      const response = await api.put(`/usuarios/${user.id}`, data)
      setUser(response.data)
      localStorage.setItem('user', JSON.stringify(response.data))
      return response.data
    } catch (error) {
      throw error
    }
  }

  const hasRole = (roles) => {
    if (!user) return false
    if (user.rol === 'superadmin') return true
    return roles.includes(user.rol)
  }

  const hasProjectAccess = (projectId) => {
    if (!user) return false
    if (user.rol === 'superadmin') return true
    if (!user.proyecto_permitido) return false
    
    const proyectos = user.proyecto_permitido.split(',').map(p => p.trim())
    return proyectos.includes(String(projectId)) || proyectos.includes('*')
  }

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    updateProfile,
    hasRole,
    hasProjectAccess,
    checkAuth
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}