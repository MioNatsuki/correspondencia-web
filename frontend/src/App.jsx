import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProyectoProvider } from './contexts/ProyectoContext'
import { ToastProvider } from './contexts/ToastContext'
import RequireAuth from './components/common/RequireAuth'
import Layout from './layouts/MainLayout'

// Páginas
import LoginPage from './pages/Login/LoginPage'
import Dashboard from './pages/Dashboard/DashboardHome'
import ProyectosListPage from './pages/Proyectos/ProyectosListPage'
import ProyectoDetailPage from './pages/Proyectos/ProyectoDetailPage'
import PlantillasListPage from './pages/Plantillas/PlantillasListPage'
import EditorPage from './pages/Plantillas/Editor/EditorPage'
import CSVUploaderPage from './pages/Emision/CSVUploaderPage'
import ProgressPage from './pages/Emision/ProgressPage'
import ResultsPage from './pages/Emision/ResultsPage'
import UsuariosListPage from './pages/Usuarios/UsuariosListPage'
import PerfilPage from './pages/Usuarios/PerfilPage'
import BitacoraPage from './pages/Bitacora/BitacoraPage'

// Roles
import { ROLES } from './constants/roles'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ProyectoProvider>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Rutas protegidas */}
            <Route path="/" element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              
              {/* Proyectos */}
              <Route path="proyectos">
                <Route index element={<ProyectosListPage />} />
                <Route path=":proyectoId" element={<ProyectoDetailPage />} />
              </Route>
              
              {/* Plantillas */}
              <Route path="plantillas">
                <Route index element={<PlantillasListPage />} />
                <Route path="editor/:plantillaId" element={<EditorPage />} />
                <Route path="editor/nuevo" element={<EditorPage />} />
              </Route>
              
              {/* Emisión */}
              <Route path="emision">
                <Route path="cargar" element={<CSVUploaderPage />} />
                <Route path="progreso/:sessionId" element={<ProgressPage />} />
                <Route path="resultados/:sessionId" element={<ResultsPage />} />
              </Route>
              
              {/* Administración (solo admin/superadmin) */}
              <Route path="admin" element={
                <RequireAuth allowedRoles={[ROLES.ADMIN, ROLES.SUPERADMIN]}>
                  <Layout />
                </RequireAuth>
              }>
                <Route path="usuarios">
                  <Route index element={<UsuariosListPage />} />
                </Route>
                <Route path="bitacora" element={<BitacoraPage />} />
              </Route>
              
              {/* Perfil */}
              <Route path="perfil" element={<PerfilPage />} />
            </Route>
            
            {/* 404 */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ProyectoProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App