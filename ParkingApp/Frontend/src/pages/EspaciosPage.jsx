import { useEffect, useMemo, useState } from 'react';
import { espaciosApi, zonasApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { ErrorMsg, EstadoBadge, SuccessMsg } from '../components/Feedback';

const ESTADOS = ['TODOS', 'DISPONIBLE', 'OCUPADO', 'RESERVADO'];
const TIPOS_ESPACIO = ['AUTO', 'MOTO', 'BUSETA', 'BUS', 'CAMION'];

export default function EspaciosPage() {
  const { user, hasRole } = useAuth();
  const [espacios, setEspacios] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [filtroZona, setFiltroZona] = useState('TODAS');
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [sseActivo, setSseActivo] = useState(false);
  const [nuevo, setNuevo] = useState({ descripcion: '', tipo: 'AUTO', idZona: '' });

  const load = () =>
    Promise.all([espaciosApi.list(), zonasApi.list()])
      .then(([esp, zon]) => {
        setEspacios(esp || []);
        setZonas(zon || []);
      })
      .catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  // Panel en tiempo real vía SSE: cada cambio de espacio llega por el stream y
  // refresca el panel. Los eventos traen idTenant: solo se atienden los de mi empresa.
  useEffect(() => {
    const source = new EventSource('/api/espacios/stream');
    source.addEventListener('espacio', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (!user?.tenantId || data.idTenant === user.tenantId) {
          load();
        }
      } catch {
        // evento con formato inesperado: se ignora
      }
    });
    source.onopen = () => setSseActivo(true);
    source.onerror = () => setSseActivo(false);
    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenantId]);

  const filtrados = useMemo(
    () =>
      espacios.filter(
        (e) =>
          (filtroEstado === 'TODOS' || e.estado === filtroEstado) &&
          (filtroZona === 'TODAS' || e.nombreZona === filtroZona),
      ),
    [espacios, filtroEstado, filtroZona],
  );

  const run = async (fn, okMsg) => {
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(okMsg);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!nuevo.idZona) {
      setError('Selecciona la zona del nuevo espacio');
      return;
    }
    setError(null);
    setMsg(null);
    try {
      const creado = await espaciosApi.create(nuevo);
      setMsg(`Espacio "${creado.nombre}" creado`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Espacios</h1>
          <p className="muted">
            Disponibilidad del parqueadero en tiempo real{' '}
            {sseActivo ? '· 🟢 conectado (SSE)' : '· ⚪ reconectando…'}
          </p>
        </div>
      </header>

      <ErrorMsg error={error} />
      <SuccessMsg msg={msg} />

      {hasRole('ADMIN') && (
        <div className="card">
          <h3>Nuevo espacio</h3>
          <form className="form-row" onSubmit={handleCrear}>
            <label>
              Zona *
              <select value={nuevo.idZona} onChange={(e) => setNuevo({ ...nuevo, idZona: e.target.value })}>
                <option value="">— Selecciona —</option>
                {zonas.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo *
              <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>
                {TIPOS_ESPACIO.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Descripción
              <input
                value={nuevo.descripcion}
                onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
              />
            </label>
            <button className="btn btn-primary">Crear espacio</button>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <label>
          Estado
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            {ESTADOS.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
        <label>
          Zona
          <select value={filtroZona} onChange={(e) => setFiltroZona(e.target.value)}>
            <option>TODAS</option>
            {[...new Set(espacios.map((e) => e.nombreZona))].map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
        <span className="muted">{filtrados.length} espacios</span>
      </div>

      <div className="espacios-grid">
        {filtrados.map((e) => (
          <div key={e.id} className={`espacio-card ${String(e.estado || '').toLowerCase()}`}>
            <div className="espacio-head">
              <strong>{e.nombre}</strong>
              <EstadoBadge estado={e.estado} />
            </div>
            <small className="muted">
              {e.nombreZona} · {e.tipo}
            </small>
            {e.descripcion && <small>{e.descripcion}</small>}
            <div className="espacio-actions">
              {e.estado === 'DISPONIBLE' && (
                <button
                  className="btn btn-small"
                  onClick={() => run(() => espaciosApi.reservar(e.id), `Espacio ${e.nombre} reservado`)}
                >
                  Reservar
                </button>
              )}
              {hasRole('ADMIN', 'OPERATOR') && (
                <>
                  <select
                    defaultValue=""
                    onChange={(ev) => {
                      if (ev.target.value) {
                        run(
                          () => espaciosApi.cambiarEstado(e.id, ev.target.value),
                          `Estado de ${e.nombre} actualizado`,
                        );
                        ev.target.value = '';
                      }
                    }}
                  >
                    <option value="">Cambiar estado…</option>
                    {['DISPONIBLE', 'OCUPADO', 'RESERVADO']
                      .filter((s) => s !== e.estado)
                      .map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar el espacio ${e.nombre}?`)) {
                        run(() => espaciosApi.remove(e.id), `Espacio ${e.nombre} eliminado`);
                      }
                    }}
                  >
                    🗑
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {filtrados.length === 0 && <p className="muted">No hay espacios con este filtro.</p>}
      </div>
    </div>
  );
}
