import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ZonasPage from './pages/ZonasPage';
import EspaciosPage from './pages/EspaciosPage';
import VehiculosPage from './pages/VehiculosPage';
import TicketsPage from './pages/TicketsPage';
import UsuariosPage from './pages/UsuariosPage';
import RolesPage from './pages/RolesPage';
import AuditoriaPage from './pages/AuditoriaPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="espacios" element={<EspaciosPage />} />
        <Route path="vehiculos" element={<VehiculosPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route
          path="zonas"
          element={
            <ProtectedRoute roles={['ADMIN', 'OPERATOR']}>
              <ZonasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="usuarios"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <UsuariosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="roles"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <RolesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="auditoria"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AuditoriaPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
