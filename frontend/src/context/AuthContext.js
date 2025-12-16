import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../api/auth';
import Swal from 'sweetalert2';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      if (storedToken && storedUser) {
        try {
          // Verificar token válido
          await authAPI.verifyToken();
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        } catch (error) {
          console.error('Token inválido:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };
    
    initAuth();
  }, []);

  const login = async (username, password) => {
    try {
      setLoading(true);
      const response = await authAPI.login({
        usuario: username,
        contraseña: password
      });
      
      const { access_token, usuario } = response;
      
      // Guardar en localStorage
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(usuario));
      
      // Actualizar estado
      setToken(access_token);
      setUser(usuario);
      
      // Mostrar mensaje de bienvenida kawaii
      await Swal.fire({
        icon: 'success',
        title: `¡Hola, ${usuario.nombre}!`,
        text: 'Sesión iniciada correctamente',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#aae6d9',
        confirmButtonText: 'Continuar',
        timer: 2000,
        showConfirmButton: false,
      });
      
      return { success: true };
    } catch (error) {
      let errorMessage = 'Error al iniciar sesión';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      await Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: errorMessage,
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#e6b0aa',
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      
      await Swal.fire({
        icon: 'info',
        title: 'Sesión cerrada',
        text: 'Has cerrado sesión correctamente',
        background: '#ffffff',
        color: '#2c3e50',
        confirmButtonColor: '#aae6d9',
        timer: 1500,
        showConfirmButton: false,
      });
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!user && !!token,
    isAdmin: user?.rol === 'admin' || user?.rol === 'superadmin',
    isSuperAdmin: user?.rol === 'superadmin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};