import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { espaciosApi, tenantsApi, zonasApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { ErrorMsg } from '../components/Feedback';

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const esSuperAdmin = hasRole('SUPER_ADMIN');
  const [espacios, setEspacios] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    // El SUPER_ADMIN administra el SaaS: ve empresas, no la operación de cada parqueadero.
    if (esSuperAdmin) {
      tenantsApi
        .list()
        .then((data) => setTenants(data || []))
        .catch((err) => setError(err.message));
      return;
    }
    Promise.all([espaciosApi.list(), zonasApi.list()])
      .then(([esp, zon]) => {
        setEspacios(esp || []);
        setZonas(zon || []);
      })
      .catch((err) => setError(err.message));
  }, [esSuperAdmin]);

  const count = (estado) => espacios.filter((e) => e.estado === estado).length;

  if (esSuperAdmin) {
    const activas = tenants.filter((t) => t.activo !== false).length;
    return (
      <div>
        <header className="page-header">
          <div>
            <h1>Hola, {user?.username} 👋</h1>
            <p className="muted">Administración del sistema</p>
          </div>
        </header>

        <ErrorMsg error={error} />

        <div className="stats-grid">
          <div className="stat-card blue">
            <span className="stat-value">{tenants.length}</span>
            <span className="stat-label">Empresas registradas</span>
          </div>
          <div className="stat-card green">
            <span className="stat-value">{activas}</span>
            <span className="stat-label">Empresas activas</span>
          </div>
          <div className="stat-card yellow">
            <span className="stat-value">{tenants.length - activas}</span>
            <span className="stat-label">Empresas inactivas</span>
          </div>
        </div>

        <h2 className="section-title">Accesos rápidos</h2>
        <div className="quick-grid">
          <Link to="/tenants" className="quick-card">
            <span>🏢</span>
            <strong>Empresas</strong>
            <small>Registrar y administrar empresas clientes</small>
          </Link>
          <Link to="/usuarios" className="quick-card">
            <span>👥</span>
            <strong>Usuarios</strong>
            <small>Cuentas de todas las empresas</small>
          </Link>
          <Link to="/auditoria" className="quick-card">
            <span>📜</span>
            <strong>Auditoría</strong>
            <small>Actividad registrada en el sistema</small>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Hola, {user?.username} 👋</h1>
          <p className="muted">Resumen general del parqueadero</p>
        </div>
      </header>

      <ErrorMsg error={error} />

      <div className="stats-grid">
        <div className="stat-card green">
          <span className="stat-value">{count('DISPONIBLE')}</span>
          <span className="stat-label">Espacios disponibles</span>
        </div>
        <div className="stat-card red">
          <span className="stat-value">{count('OCUPADO')}</span>
          <span className="stat-label">Espacios ocupados</span>
        </div>
        <div className="stat-card yellow">
          <span className="stat-value">{count('RESERVADO')}</span>
          <span className="stat-label">Espacios reservados</span>
        </div>
        <div className="stat-card blue">
          <span className="stat-value">{zonas.length}</span>
          <span className="stat-label">Zonas</span>
        </div>
      </div>

      <h2 className="section-title">Accesos rápidos</h2>
      <div className="quick-grid">
        <Link to="/espacios" className="quick-card">
          <span>🅿️</span>
          <strong>Ver espacios</strong>
          <small>Disponibilidad por zona y reservas</small>
        </Link>
        <Link to="/tickets" className="quick-card">
          <span>🎫</span>
          <strong>Tickets</strong>
          <small>Emitir y consultar tickets de ingreso</small>
        </Link>
        <Link to="/vehiculos" className="quick-card">
          <span>🚗</span>
          <strong>Vehículos</strong>
          <small>Registrar y buscar por placa</small>
        </Link>
        {hasRole('ADMIN', 'OPERATOR') && (
          <Link to="/zonas" className="quick-card">
            <span>🗺️</span>
            <strong>Zonas</strong>
            <small>Administrar zonas del parqueadero</small>
          </Link>
        )}
        {hasRole('ADMIN') && (
          <Link to="/usuarios" className="quick-card">
            <span>👥</span>
            <strong>Usuarios</strong>
            <small>Crear cuentas y asignar roles</small>
          </Link>
        )}
      </div>
    </div>
  );
}
