import { useEffect, useState } from 'react';
import { rolesApi, usersApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { ErrorMsg, SuccessMsg } from '../components/Feedback';

const EMPTY = {
  dni: '',
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  nationality: '',
};

export default function UsuariosPage() {
  const { user: currentUser, hasRole } = useAuth();
  // El SUPER_ADMIN (dueño de la plataforma) ve los usuarios de TODAS las
  // empresas; el ADMIN solo recibe del backend los de su propia empresa
  const esSuperAdmin = hasRole('SUPER_ADMIN');
  const [usuarios, setUsuarios] = useState([]);
  const [filtroEmpresa, setFiltroEmpresa] = useState('TODAS');
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    usersApi.list().then((u) => setUsuarios(u || [])).catch((err) => setError(err.message));
    rolesApi.list().then((r) => setRoles(r || [])).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setLoading(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => {
        payload[k] = payload[k].trim();
        if (payload[k] === '') delete payload[k];
      });
      const res = await usersApi.create(payload);
      setMsg(`Usuario creado: "${res.username}" (contraseña inicial = cédula, rol CLIENT)`);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario "${u.username}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    setMsg(null);
    try {
      await usersApi.remove(u.id);
      setMsg(`Usuario "${u.username}" eliminado`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const empresas = [...new Set(usuarios.map((u) => u.tenantNombre).filter(Boolean))];
  const usuariosFiltrados = usuarios.filter((u) => {
    if (!esSuperAdmin || filtroEmpresa === 'TODAS') return true;
    if (filtroEmpresa === 'GLOBAL') return !u.tenantNombre;
    return u.tenantNombre === filtroEmpresa;
  });

  const handleAssignRole = async (userId, roleId) => {
    if (!roleId) return;
    setError(null);
    setMsg(null);
    try {
      const res = await usersApi.assignRole(userId, roleId);
      setMsg(`Roles de "${res.username}" actualizados: ${(res.roles || []).join(', ')}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p className="muted">Creación de cuentas y asignación de roles</p>
        </div>
      </header>

      <ErrorMsg error={error} />
      <SuccessMsg msg={msg} />

      <div className="card">
        <h3>Nuevo usuario</h3>
        <p className="muted">
          El username se genera automáticamente a partir de los nombres y la contraseña inicial es la
          cédula. El rol por defecto es CLIENT (puedes cambiarlo en la tabla).
        </p>
        <form className="form-grid" onSubmit={handleCreate}>
          <label>
            Cédula (DNI) *
            <input value={form.dni} onChange={set('dni')} maxLength={10} pattern="[0-9]+" required />
          </label>
          <label>
            Primer nombre *
            <input value={form.firstName} onChange={set('firstName')} maxLength={25} required />
          </label>
          <label>
            Segundo nombre
            <input value={form.middleName} onChange={set('middleName')} maxLength={25} />
          </label>
          <label>
            Apellidos *
            <input value={form.lastName} onChange={set('lastName')} maxLength={25} required />
          </label>
          <label>
            Email *
            <input type="email" value={form.email} onChange={set('email')} required />
          </label>
          <label>
            Teléfono *
            <input value={form.phone} onChange={set('phone')} pattern="[0-9]+" maxLength={15} required />
          </label>
          <label>
            Dirección
            <input value={form.address} onChange={set('address')} />
          </label>
          <label>
            Nacionalidad
            <input value={form.nationality} onChange={set('nationality')} placeholder="EC" />
          </label>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Usuarios registrados ({usuariosFiltrados.length})</h3>
        {esSuperAdmin && (
          <div className="filter-bar">
            <label>
              Empresa
              <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}>
                <option value="TODAS">TODAS</option>
                <option value="GLOBAL">Globales (sin empresa)</option>
                {empresas.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre</th>
                <th>Cédula</th>
                <th>Email</th>
                {esSuperAdmin && <th>Empresa</th>}
                <th>Roles</th>
                <th>Activo</th>
                <th>Asignar rol</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>
                    {u.person ? `${u.person.firstName} ${u.person.lastName}` : '—'}
                  </td>
                  <td>{u.person?.dni || '—'}</td>
                  <td>{u.person?.email || '—'}</td>
                  {esSuperAdmin && <td>{u.tenantNombre || '—'}</td>}
                  <td>{(u.roles || []).join(', ')}</td>
                  <td>{u.active ? 'Sí' : 'No'}</td>
                  <td>
                    <select defaultValue="" onChange={(e) => handleAssignRole(u.id, e.target.value)}>
                      <option value="">— Rol —</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.username !== 'admin' && u.username !== currentUser?.username && (
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(u)}>
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={esSuperAdmin ? 9 : 8} className="muted center">
                    No hay usuarios registrados
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
