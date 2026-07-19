import { useEffect, useState } from 'react';
import { tenantsApi } from '../api/services';
import { ErrorMsg, SuccessMsg } from '../components/Feedback';

const EMPTY = { nombre: '', codigo: '' };

// Solo visible para SUPER_ADMIN: administra las empresas/parqueaderos (tenants)
export default function TenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => tenantsApi.list().then(setTenants).catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setLoading(true);
    try {
      const payload = { nombre: form.nombre.trim(), codigo: form.codigo.trim().toUpperCase() };
      if (editing) {
        await tenantsApi.update(editing, payload);
        setMsg(`Empresa "${payload.nombre}" actualizada`);
      } else {
        await tenantsApi.create(payload);
        setMsg(`Empresa "${payload.nombre}" creada`);
      }
      setForm(EMPTY);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (t) => {
    setEditing(t.id);
    setForm({ nombre: t.nombre, codigo: t.codigo });
  };

  const handleDeactivate = async (t) => {
    if (!window.confirm(`¿Desactivar la empresa "${t.nombre}"? Sus usuarios no podrán registrarse.`)) return;
    setError(null);
    try {
      await tenantsApi.remove(t.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Empresas</h1>
          <p className="muted">Administración de empresas/parqueaderos (tenants) del sistema</p>
        </div>
      </header>

      <ErrorMsg error={error} />
      <SuccessMsg msg={msg} />

      <div className="card">
        <h3>{editing ? 'Editar empresa' : 'Nueva empresa'}</h3>
        <form className="form-row" onSubmit={handleSubmit}>
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
            Código *
            <input
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
              maxLength={20}
              pattern="[A-Z0-9-]+"
              placeholder="NORTE"
              required
            />
          </label>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear empresa'}
          </button>
          {editing && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
            >
              Cancelar
            </button>
          )}
        </form>
      </div>

      <div className="card">
        <h3>Empresas registradas ({tenants.length})</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Activa</th>
                <th>Creada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.codigo}</td>
                  <td>{t.nombre}</td>
                  <td>{t.activo ? 'Sí' : 'No'}</td>
                  <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="actions">
                    <button className="btn btn-small" onClick={() => handleEdit(t)}>
                      Editar
                    </button>
                    {t.activo && (
                      <button className="btn btn-small btn-danger" onClick={() => handleDeactivate(t)}>
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted center">
                    No hay empresas registradas
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
