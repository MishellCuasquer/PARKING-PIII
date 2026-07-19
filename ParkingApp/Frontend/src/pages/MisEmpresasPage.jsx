import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { ErrorMsg, SuccessMsg } from '../components/Feedback';

/**
 * Empresas donde la persona autenticada (mismo email + cédula) tiene cuenta.
 * Al seleccionar una, la sesión cambia a esa empresa y todas las pantallas
 * (zonas, espacios, vehículos, tickets) muestran los datos de esa empresa.
 */
export default function MisEmpresasPage() {
  const { user, switchEmpresa } = useAuth();
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState([]);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(null);

  useEffect(() => {
    authApi
      .misEmpresas()
      .then((res) => setEmpresas(res || []))
      .catch((err) => setError(err.message));
  }, []);

  const handleSelect = async (empresa) => {
    setError(null);
    setMsg(null);
    setLoading(empresa.tenantId);
    try {
      await switchEmpresa(empresa.tenantId);
      setMsg(`Ahora estás trabajando en "${empresa.tenantNombre}"`);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Mis empresas</h1>
          <p className="muted">
            Parqueaderos donde tienes cuenta con este mismo correo y cédula. Selecciona uno para
            ver sus zonas, espacios, vehículos y tickets.
          </p>
        </div>
      </header>

      <ErrorMsg error={error} />
      <SuccessMsg msg={msg} />

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Código</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.tenantId}>
                  <td>🏢 {e.tenantNombre}</td>
                  <td className="mono">{e.tenantCodigo}</td>
                  <td>{e.username}</td>
                  <td>{(e.roles || []).join(', ')}</td>
                  <td>
                    {e.actual ? (
                      <span className="badge badge-green">Actual</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {e.actual ? (
                      <button className="btn btn-small" onClick={() => navigate('/')}>
                        Continuar
                      </button>
                    ) : (
                      <button
                        className="btn btn-small btn-primary"
                        disabled={loading === e.tenantId}
                        onClick={() => handleSelect(e)}
                      >
                        {loading === e.tenantId ? 'Cambiando…' : 'Entrar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {empresas.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted center">
                    {user?.tenantName
                      ? 'Solo tienes cuenta en tu empresa actual'
                      : 'Tu cuenta no pertenece a ninguna empresa'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
