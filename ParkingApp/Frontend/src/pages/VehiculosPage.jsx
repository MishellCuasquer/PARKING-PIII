import { useEffect, useState } from 'react';
import { vehiculosApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { ErrorMsg, SuccessMsg } from '../components/Feedback';

const CLASIFICACIONES = ['Diesel', 'Gasolina', 'Eléctrico', 'Híbrido'];

const BASE = { placa: '', marca: '', modelo: '', color: '', anio: new Date().getFullYear(), clasificacion: 'Gasolina' };
const EXTRA = {
  auto: { numeroPuertas: 4, CapacidadMaletero: 300 },
  moto: { tipo: 'Deportiva' },
  camioneta: { cabina: 'Simple', capacidadCarga: 500 },
};

export default function VehiculosPage() {
  const { hasRole } = useAuth();
  const canList = hasRole('ADMIN', 'OPERATOR');

  const [tipo, setTipo] = useState('auto');
  const [form, setForm] = useState({ ...BASE, ...EXTRA.auto });
  const [vehiculos, setVehiculos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultado, setResultado] = useState(null);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => {
    if (!canList) return;
    vehiculosApi.list().then((v) => setVehiculos(v || [])).catch((err) => setError(err.message));
  };

  useEffect(() => {
    load();
  }, []);

  const cambiarTipo = (t) => {
    setTipo(t);
    setForm({ ...BASE, placa: form.placa, marca: form.marca, modelo: form.modelo, color: form.color, anio: form.anio, clasificacion: form.clasificacion, ...EXTRA[t] });
  };

  const set = (field, numeric = false) => (e) =>
    setForm({ ...form, [field]: numeric ? Number(e.target.value) : e.target.value });

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const datos = { ...form, anio: Number(form.anio) };
      await vehiculosApi.create({ tipo, datos });
      setMsg(`Vehículo ${form.placa} registrado`);
      setForm({ ...BASE, ...EXTRA[tipo] });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBuscar = async (e) => {
    e.preventDefault();
    setError(null);
    setResultado(null);
    try {
      const res = await vehiculosApi.byPlaca(busqueda.trim().toUpperCase());
      setResultado(res);
    } catch (err) {
      setError(err.status === 404 ? `No existe un vehículo con placa ${busqueda}` : err.message);
    }
  };

  const startEdit = (v) => {
    setMsg(null);
    setError(null);
    setEditando({
      id: v.id,
      placa: v.placa,
      marca: v.marca || '',
      modelo: v.modelo || '',
      color: v.color || '',
      anio: v.anio || new Date().getFullYear(),
      clasificacion: v.clasificacion || 'Gasolina',
    });
  };

  const setEdit = (field, numeric = false) => (e) =>
    setEditando({ ...editando, [field]: numeric ? Number(e.target.value) : e.target.value });

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const { id, ...cambios } = editando;
      const res = await vehiculosApi.update(id, cambios);
      setMsg(`Vehículo ${res.placa} actualizado`);
      setEditando(null);
      load();
      if (resultado && resultado.id === id) setResultado(res);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (v) => {
    if (!window.confirm(`¿Eliminar el vehículo ${v.placa}?`)) return;
    setError(null);
    try {
      await vehiculosApi.remove(v.id);
      setMsg(`Vehículo ${v.placa} eliminado`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Vehículos</h1>
          <p className="muted">Registro y consulta de vehículos</p>
        </div>
      </header>

      <ErrorMsg error={error} />
      <SuccessMsg msg={msg} />

      <div className="card">
        <h3>Registrar vehículo</h3>
        <div className="tabs">
          {['auto', 'moto', 'camioneta'].map((t) => (
            <button
              key={t}
              type="button"
              className={`tab${tipo === t ? ' active' : ''}`}
              onClick={() => cambiarTipo(t)}
            >
              {t === 'auto' ? '🚗 Auto' : t === 'moto' ? '🏍 Moto' : '🛻 Camioneta'}
            </button>
          ))}
        </div>

        <form className="form-grid" onSubmit={handleCreate}>
          <label>
            Placa * <small className="muted">({tipo === 'moto' ? 'AB-1234' : 'ABC-1234'})</small>
            <input
              value={form.placa}
              onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
              pattern={tipo === 'moto' ? '[A-Z]{2}-[0-9]{4}' : '[A-Z]{3}-[0-9]{4}'}
              required
            />
          </label>
          <label>
            Marca *
            <input value={form.marca} onChange={set('marca')} minLength={2} maxLength={15} required />
          </label>
          <label>
            Modelo *
            <input value={form.modelo} onChange={set('modelo')} minLength={2} maxLength={20} required />
          </label>
          <label>
            Color *
            <input value={form.color} onChange={set('color')} minLength={2} maxLength={20} required />
          </label>
          <label>
            Año *
            <input type="number" min={1900} value={form.anio} onChange={set('anio', true)} required />
          </label>
          <label>
            Clasificación *
            <select value={form.clasificacion} onChange={set('clasificacion')}>
              {CLASIFICACIONES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          {tipo === 'auto' && (
            <>
              <label>
                N° puertas *
                <input type="number" min={2} max={5} value={form.numeroPuertas} onChange={set('numeroPuertas', true)} required />
              </label>
              <label>
                Maletero (litros) *
                <input type="number" min={100} max={1000} value={form.CapacidadMaletero} onChange={set('CapacidadMaletero', true)} required />
              </label>
            </>
          )}

          {tipo === 'moto' && (
            <label>
              Tipo de moto *
              <select value={form.tipo} onChange={set('tipo')}>
                <option>Deportiva</option>
              </select>
            </label>
          )}

          {tipo === 'camioneta' && (
            <>
              <label>
                Cabina *
                <input value={form.cabina} onChange={set('cabina')} minLength={3} maxLength={20} required />
              </label>
              <label>
                Capacidad de carga *
                <input type="number" min={0.1} max={10000} step="0.1" value={form.capacidadCarga} onChange={set('capacidadCarga', true)} required />
              </label>
            </>
          )}

          <button className="btn btn-primary">Registrar</button>
        </form>
      </div>

      <div className="card">
        <h3>Buscar por placa</h3>
        <form className="form-row" onSubmit={handleBuscar}>
          <label>
            Placa
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value.toUpperCase())} placeholder="ABC-1234" required />
          </label>
          <button className="btn">Buscar</button>
        </form>
        {resultado && (
          <div className="result-box">
            <strong>{resultado.placa}</strong> — {resultado.marca} {resultado.modelo} ({resultado.anio}),
            color {resultado.color}, {resultado.clasificacion}{' '}
            <button className="btn btn-small" onClick={() => startEdit(resultado)}>
              ✏️ Editar
            </button>
          </div>
        )}
      </div>

      {editando && (
        <div className="card">
          <h3>Editar vehículo {editando.placa}</h3>
          <form className="form-grid" onSubmit={handleUpdate}>
            <label>
              Placa
              <input
                value={editando.placa}
                onChange={(e) => setEditando({ ...editando, placa: e.target.value.toUpperCase() })}
                required
              />
            </label>
            <label>
              Marca
              <input value={editando.marca} onChange={setEdit('marca')} minLength={2} maxLength={15} required />
            </label>
            <label>
              Modelo
              <input value={editando.modelo} onChange={setEdit('modelo')} minLength={2} maxLength={20} required />
            </label>
            <label>
              Color
              <input value={editando.color} onChange={setEdit('color')} minLength={2} maxLength={20} required />
            </label>
            <label>
              Año
              <input type="number" min={1900} value={editando.anio} onChange={setEdit('anio', true)} required />
            </label>
            <label>
              Clasificación
              <select value={editando.clasificacion} onChange={setEdit('clasificacion')}>
                {CLASIFICACIONES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <button className="btn btn-primary">Guardar cambios</button>
              <button type="button" className="btn" onClick={() => setEditando(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {canList && (
        <div className="card">
          <h3>Vehículos registrados ({vehiculos.length})</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Color</th>
                  <th>Año</th>
                  <th>Clasificación</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {vehiculos.map((v) => (
                  <tr key={v.id}>
                    <td>{v.placa}</td>
                    <td>{v.marca}</td>
                    <td>{v.modelo}</td>
                    <td>{v.color}</td>
                    <td>{v.anio}</td>
                    <td>{v.clasificacion}</td>
                    <td className="actions">
                      <button className="btn btn-small" onClick={() => startEdit(v)}>
                        Editar
                      </button>
                      {hasRole('ADMIN') && (
                        <button className="btn btn-small btn-danger" onClick={() => handleDelete(v)}>
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {vehiculos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted center">
                      No hay vehículos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
