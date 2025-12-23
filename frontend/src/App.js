import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import theme from './styles/theme';
import './styles/global.css';

// Layouts
import MainLayout from './components/layout/MainLayout';

// Pages
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';

//Proyectos
import ListaProyectos from './pages/proyectos/ListaProyectos';
import DetalleProyecto from './pages/proyectos/DetalleProyecto';
import EditarProyecto from './pages/proyectos/EditarProyecto';

//Plantillas
import ListaPlantillas from './pages/plantillas/ListaPlantillas';
import PlantillasProyecto from './pages/plantillas/PlantillasProyecto';
import EditorPlantilla from './pages/plantillas/EditorPlantilla';
import CrearPlantilla from './pages/plantillas/CrearPlantilla';

// Loading component
import LoadingSpinner from './components/ui/LoadingSpinner';

// Importar Box de MUI
import { Box } from '@mui/material'; // ← AGREGAR ESTE IMPORT

// Crear cliente de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutos
    },
  },
});

// Componente para rutas protegidas
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAuthenticated, loading, isAdmin } = useAuth();
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LoadingSpinner size={60} />
      </Box>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout>
            <Dashboard />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <MainLayout>
            <Dashboard />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/proyectos" element={
        <ProtectedRoute>
          <MainLayout>
            <ListaProyectos />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/proyectos/:id" element={
        <ProtectedRoute>
          <MainLayout>
            <DetalleProyecto />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/proyectos/editar/:id" element={
        <ProtectedRoute requireAdmin>
          <MainLayout>
            <EditarProyecto />
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/proyectos/:id/plantillas" element={
        <ProtectedRoute>
          <MainLayout>
            <ListaPlantillas />
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/plantillas/nueva" element={
        <ProtectedRoute requireAdmin>
          <MainLayout>
            <CrearPlantilla />
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/plantillas/:plantillaId/editor" element={
        <ProtectedRoute requireAdmin>
          <MainLayout>
            <EditorPlantilla /> 
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/plantillas/:plantillaId" element={
        <ProtectedRoute>
          <MainLayout>
            <EditorPlantilla />
          </MainLayout>
        </ProtectedRoute>
      } />

      <Route path="/proyectos/:id/plantillas" element={
        <ProtectedRoute>
          <MainLayout>
            <PlantillasProyecto />
          </MainLayout>
        </ProtectedRoute>
      } />
      
      {/* Ruta por defecto */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <AppContent />
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;