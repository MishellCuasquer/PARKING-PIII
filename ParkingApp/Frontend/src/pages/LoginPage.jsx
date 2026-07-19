import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { ErrorMsg } from '../components/Feedback';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      // Dueño con cuenta en varias empresas: elegir a cuál entrar antes del dashboard
      let empresas = [];
      try {
        empresas = (await authApi.misEmpresas()) || [];
      } catch {
        // si el listado falla, se entra directo a la empresa del token
      }
      navigate(empresas.length > 1 ? '/mis-empresas' : '/');
    } catch (err) {
      setError(err.status === 401 || err.status === 403 ? 'Usuario/correo o contraseña incorrectos' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-hero">
          <span className="brand-icon xl">🅿️</span>
          <h1>ParkingApp</h1>
          <p>Sistema de gestión de parqueadero: zonas, espacios, vehículos y tickets.</p>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>Iniciar sesión</h2>
          <p className="muted">Ingresa como administrador, operador o cliente.</p>

          <label>
            Usuario o correo
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin o correo@dominio.com"
              autoFocus
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          <ErrorMsg error={error} />

          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="muted center">
            ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
