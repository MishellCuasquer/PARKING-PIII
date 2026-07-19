import { useEffect, useMemo, useState } from 'react';
import { auditApi, tenantsApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { ErrorMsg } from '../components/Feedback';

const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

const ACCION_BADGE = {
  CREATE: 'badge badge-green',
  UPDATE: 'badge badge-yellow',
  DELETE: 'badge badge-red',
};

export default function AuditoriaPage() {
  const { user, hasRole } = useAuth();
  const esSuperAdmin = hasRole('SUPER_ADMIN');
  const [eventos, setEventos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState('TODAS');
  const [filtroServicio, setFiltroServicio] = useState('TODOS');
  const [filtroAccion, setFiltroAccion] = useState('TODAS');
  const [expandido, setExpandido] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    auditApi
      .list()
      .then((ev) =>
        setEventos(
          (ev || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
        ),
      )
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
    // El SUPER_ADMIN puede filtrar la auditoría por empresa
    if (esSuperAdmin) {
      tenantsApi
        .list()
        .then((ts) => setEmpresas(ts || []))
        .catch(() => setEmpresas([]));
    }
  }, [esSuperAdmin]);

  const servicios = useMemo(() => [...new Set(eventos.map((e) => e.servicio))], [eventos]);
  const acciones = useMemo(() => [...new Set(eventos.map((e) => e.accion))], [eventos]);
  const nombreEmpresa = useMemo(() => {
    const map = {};
    empresas.forEach((t) => {
      map[t.id] = t.nombre;
    });
    return map;
  }, [empresas]);

  // El ADMIN de una empresa solo ve la auditoría de su tenant;
  // SUPER_ADMIN ve todo y puede acotar por empresa (o solo eventos globales)
  const filtraTenant = (e) => {
    if (user?.tenantId) return e.tenantId === user.tenantId;
    if (filtroEmpresa === 'TODAS') return true;
    if (filtroEmpresa === 'GLOBAL') return !e.tenantId;
    return e.tenantId === filtroEmpresa;
  };

  const filtrados = eventos.filter(
    (e) =>
      filtraTenant(e) &&
      (filtroServicio === 'TODOS' || e.servicio === filtroServicio) &&
      (filtroAccion === 'TODAS' || e.accion === filtroAccion),
  );

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Auditoría</h1>
          <p className="muted">
            Eventos registrados por los microservicios (vía RabbitMQ → ms-audit)
          </p>
        </div>
        <button className="btn" onClick={load}>
          🔄 Actualizar
        </button>
      </header>

      <ErrorMsg error={error} />

      <div className="filter-bar">
        {esSuperAdmin && (
          <label>
            Empresa
            <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
              <option value="TODAS">TODAS</option>
              <option value="GLOBAL">Globales (sin empresa)</option>
              {empresas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Servicio
          <select value={filtroServicio} onChange={(e) => setFiltroServicio(e.target.value)}>
            <option>TODOS</option>
            {servicios.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Acción
          <select value={filtroAccion} onChange={(e) => setFiltroAccion(e.target.value)}>
            <option>TODAS</option>
            {acciones.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <span className="muted">{filtrados.length} eventos</span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Servicio</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Usuario</th>
                <th>Empresa</th>
                <th>IP</th>
                <th>Datos</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id}>
                  <td>{fmt(e.timestamp)}</td>
                  <td>{e.servicio}</td>
                  <td>
                    <span className={ACCION_BADGE[e.accion] || 'badge'}>{e.accion}</span>
                  </td>
                  <td>{e.entidad}</td>
                  <td>{e.usuario}</td>
                  <td className="mono">
                    {e.tenantId
                      ? nombreEmpresa[e.tenantId] || `${e.tenantId.slice(0, 8)}…`
                      : '—'}
                  </td>
                  <td className="mono">{e.ip}</td>
                  <td>
                    <button
                      className="btn btn-small"
                      onClick={() => setExpandido(expandido === e.id ? null : e.id)}
                    >
                      {expandido === e.id ? 'Ocultar' : 'Ver'}
                    </button>
                    {expandido === e.id && (
                      <pre className="result-box mono" style={{ maxWidth: 380, overflowX: 'auto' }}>
                        {JSON.stringify(e.datos, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted center">
                    No hay eventos de auditoría
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
