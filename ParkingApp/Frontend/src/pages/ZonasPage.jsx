import { useEffect, useState } from 'react';
import { espaciosApi, zonasApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { ErrorMsg, SuccessMsg } from '../components/Feedback';

const TIPOS_ZONA = ['VIP', 'VISITANTES', 'GENERAL', 'PREFERENCIAL'];
const TIPOS_ESPACIO = ['AUTO', 'MOTO', 'BUSETA', 'BUS', 'CAMION'];
const EMPTY = { nombre: '', descripcion: '', capacidad: 10, tipo: 'GENERAL', crearEspaciosAutomaticamente: true };

export default function ZonasPage() {
  const { hasRole } = useAuth();
  const [zonas, setZonas] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [espacioForm, setEspacioForm] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => zonasApi.list().then(setZonas).catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setLoading(true);
    try {
      await zonasApi.create({ ...form, capacidad: Number(form.capacidad) });
      setMsg(`Zona "${form.nombre}" creada`);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (zona) => {
    if (!window.confirm(`¿Eliminar la zona "${zona.nombre}"?`)) return;
    setError(null);
    try {
      await zonasApi.remove(zona.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCrearEspacio = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const creado = await espaciosApi.create({
        descripcion: espacioForm.descripcion,
        tipo: espacioForm.tipo,
        idZona: espacioForm.idZona,
      });
      setMsg(`Espacio "${creado.nombre}" creado en la zona "${espacioForm.nombreZona}"`);
      setEspacioForm(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleInitEspacios = async (zona) => {
    setError(null);
    setMsg(null);
    try {
      await zonasApi.initEspacios(zona.id);
      setMsg(`Espacios inicializados para "${zona.nombre}"`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Zonas</h1>
          <p className="muted">Administración de zonas del parqueadero</p>
        </div>
      </header>

      <ErrorMsg error={error} />
      <SuccessMsg msg={msg} />

      <div className="card">
        <h3>Nueva zona</h3>
        <form className="form-row" onSubmit={handleCreate}>
          <label>
            Nombre *
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              maxLength={100}
              required
            />
          </label>
          <label>
            Tipo *
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS_ZONA.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Capacidad *
            <input
              type="number"
              min={1}
              max={1000}
              value={form.capacidad}
              onChange={(e) => setForm({ ...form, capacidad: e.target.value })}
              required
            />
          </label>
          <label>
            Descripción
            <input
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.crearEspaciosAutomaticamente}
              onChange={(e) => setForm({ ...form, crearEspaciosAutomaticamente: e.target.checked })}
            />
            Crear espacios automáticamente
          </label>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Creando…' : 'Crear zona'}
          </button>
        </form>
      </div>

      {espacioForm && (
        <div className="card">
          <h3>Nuevo espacio en "{espacioForm.nombreZona}"</h3>
          <form className="form-row" onSubmit={handleCrearEspacio}>
            <label>
              Tipo *
              <select
                value={espacioForm.tipo}
                onChange={(e) => setEspacioForm({ ...espacioForm, tipo: e.target.value })}
              >
                {TIPOS_ESPACIO.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Descripción
              <input
                value={espacioForm.descripcion}
                onChange={(e) => setEspacioForm({ ...espacioForm, descripcion: e.target.value })}
              />
            </label>
            <button className="btn btn-primary">Crear espacio</button>
            <button type="button" className="btn" onClick={() => setEspacioForm(null)}>
              Cancelar
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Zonas registradas ({zonas.length})</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Capacidad</th>
                <th>Espacios</th>
                <th>Activa</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {zonas.map((z) => (
                <tr key={z.id}>
                  <td>{z.codigo}</td>
                  <td>{z.nombre}</td>
                  <td>{z.tipo}</td>
                  <td>{z.capacidad}</td>
                  <td>{z.espacios}</td>
                  <td>{z.activo ? 'Sí' : 'No'}</td>
                  <td className="actions">
                    {hasRole('ADMIN') && (
                      <button
                        className="btn btn-small"
                        onClick={() =>
                          setEspacioForm({ idZona: z.id, nombreZona: z.nombre, tipo: 'AUTO', descripcion: '' })
                        }
                      >
                        ＋ Espacio
                      </button>
                    )}
                    <button className="btn btn-small" onClick={() => handleInitEspacios(z)}>
                      Init espacios
                    </button>
                    <button className="btn btn-small btn-danger" onClick={() => handleDelete(z)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {zonas.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted center">
                    No hay zonas registradas
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
