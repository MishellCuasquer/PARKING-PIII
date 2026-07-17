import { useEffect, useState } from 'react';
import { espaciosApi, ticketsApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { ErrorMsg, SuccessMsg } from '../components/Feedback';

const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

export default function TicketsPage() {
  const { hasRole } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [soloActivos, setSoloActivos] = useState(false);
  const [espaciosDisp, setEspaciosDisp] = useState([]);
  const [form, setForm] = useState({ placa: '', dni: '', idEspacio: '' });
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = (activos = soloActivos) => {
    const fetcher = activos ? ticketsApi.activos : ticketsApi.list;
    fetcher().then((t) => setTickets(t || [])).catch((err) => setError(err.message));
    espaciosApi
      .list()
      .then((esp) => setEspaciosDisp((esp || []).filter((e) => e.estado === 'DISPONIBLE')))
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, [soloActivos]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setLoading(true);
    try {
      const res = await ticketsApi.create(form);
      setMsg(`Ticket emitido para ${res.placa} en ${res.nombreZona || 'zona'} ✔`);
      setForm({ placa: '', dni: '', idEspacio: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCerrar = async (t) => {
    if (!window.confirm(`¿Cerrar (cobrar) el ticket de ${t.placa}?`)) return;
    setError(null);
    setMsg(null);
    try {
      const res = await ticketsApi.cerrar(t.id);
      setMsg(`Ticket cerrado. Valor recaudado: $${res?.valorRecaudo ?? '—'}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`¿Eliminar el ticket de ${t.placa}?`)) return;
    setError(null);
    try {
      await ticketsApi.remove(t.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Tickets</h1>
          <p className="muted">Emisión y cobro de tickets de ingreso</p>
        </div>
      </header>

      <ErrorMsg error={error} />
      <SuccessMsg msg={msg} />

      <div className="card">
        <h3>Emitir ticket</h3>
        <form className="form-row" onSubmit={handleCreate}>
          <label>
            Placa *
            <input
              value={form.placa}
              onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
              placeholder="ABC-1234"
              required
            />
          </label>
          <label>
            Cédula del propietario *
            <input
              value={form.dni}
              onChange={(e) => setForm({ ...form, dni: e.target.value })}
              pattern="[0-9]+"
              maxLength={10}
              required
            />
          </label>
          <label>
            Espacio disponible *
            <select
              value={form.idEspacio}
              onChange={(e) => setForm({ ...form, idEspacio: e.target.value })}
              required
            >
              <option value="">— Selecciona —</option>
              {espaciosDisp.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre} ({e.nombreZona})
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Emitiendo…' : 'Emitir ticket'}
          </button>
        </form>
        {espaciosDisp.length === 0 && (
          <p className="muted">No hay espacios disponibles en este momento.</p>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{soloActivos ? 'Tickets activos' : 'Todos los tickets'} ({tickets.length})</h3>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
            />
            Solo activos
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Placa</th>
                <th>Cédula</th>
                <th>Zona</th>
                <th>Ingreso</th>
                <th>Salida</th>
                <th>Valor</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.placa}</td>
                  <td>{t.dni}</td>
                  <td>{t.nombreZona}</td>
                  <td>{fmt(t.fechhaHoraIngreso)}</td>
                  <td>{fmt(t.fechhaHoraSalida)}</td>
                  <td>${Number(t.valorRecaudo || 0).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${t.activo ? 'badge-green' : 'badge-gray'}`}>
                      {t.activo ? 'ACTIVO' : 'CERRADO'}
                    </span>
                  </td>
                  <td className="actions">
                    {t.activo && hasRole('ADMIN', 'OPERATOR') && (
                      <button className="btn btn-small" onClick={() => handleCerrar(t)}>
                        Cobrar / cerrar
                      </button>
                    )}
                    {hasRole('ADMIN') && (
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(t)}>
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted center">
                    No hay tickets registrados
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
