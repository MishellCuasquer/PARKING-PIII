import { useEffect, useMemo, useState } from 'react';
import { auditApi } from '../api/services';
import { ErrorMsg } from '../components/Feedback';

const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

const ACCION_BADGE = {
  CREATE: 'badge badge-green',
  UPDATE: 'badge badge-yellow',
  DELETE: 'badge badge-red',
};

export default function AuditoriaPage() {
  const [eventos, setEventos] = useState([]);
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
  }, []);

  const servicios = useMemo(() => [...new Set(eventos.map((e) => e.servicio))], [eventos]);
  const acciones = useMemo(() => [...new Set(eventos.map((e) => e.accion))], [eventos]);

  const filtrados = eventos.filter(
    (e) =>
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
                  <td colSpan={7} className="muted center">
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
