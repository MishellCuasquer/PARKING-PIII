import { useEffect, useState } from 'react';
import { rolesApi } from '../api/services';
import { ErrorMsg, SuccessMsg } from '../components/Feedback';

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = () => rolesApi.list().then((r) => setRoles(r || [])).catch((err) => setError(err.message));

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      await rolesApi.create(form);
      setMsg(`Rol "${form.name}" creado`);
      setForm({ name: '', description: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Roles</h1>
          <p className="muted">Roles disponibles en el sistema</p>
        </div>
      </header>

      <ErrorMsg error={error} />
      <SuccessMsg msg={msg} />

      <div className="card">
        <h3>Nuevo rol</h3>
        <form className="form-row" onSubmit={handleCreate}>
          <label>
            Nombre *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={25}
              pattern="[a-zA-Z ]+"
              required
            />
          </label>
          <label>
            Descripción
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <button className="btn btn-primary">Crear rol</button>
        </form>
      </div>

      <div className="card">
        <h3>Roles registrados ({roles.length})</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="badge badge-blue">{r.name}</span>
                  </td>
                  <td>{r.description || '—'}</td>
                  <td className="muted mono">{r.id}</td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted center">
                    No hay roles registrados
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
