import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/espacios', label: 'Espacios', icon: '🅿️' },
  { to: '/vehiculos', label: 'Vehículos', icon: '🚗' },
  { to: '/tickets', label: 'Tickets', icon: '🎫' },
  { to: '/zonas', label: 'Zonas', icon: '🗺️', roles: ['ADMIN', 'OPERATOR'] },
  { to: '/usuarios', label: 'Usuarios', icon: '👥', roles: ['ADMIN'] },
  { to: '/roles', label: 'Roles', icon: '🔐.', roles: ['ADMIN'] },
  { to: '/auditoria', label: 'Auditoría', icon: '📜', roles: ['ADMIN'] },
];

export default function Layout() {
  const { user, hasRole, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">🅿️</span>
          <div>
            <strong>ParkingApp</strong>
            <small>Gestión de parqueadero</small>
          </div>
        </div>

        <nav>
          {NAV_ITEMS.filter((item) => !item.roles || hasRole(...item.roles)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{user?.username?.[0]?.toUpperCase() || '?'}</div>
            <div>
              <strong>{user?.username}</strong>
              <small>{(user?.roles || []).join(', ')}</small>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
