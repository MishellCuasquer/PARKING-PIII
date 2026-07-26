import { useEffect, useState } from 'react';
import { personasApi, rolesApi, usersApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { ErrorMsg, SuccessMsg } from '../components/Feedback';
import { PATRON_NOMBRE, TITULO_NACIONALIDAD, TITULO_NOMBRE } from '../validaciones';

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
  // La persona ya existe en el sistema: sus datos se traen y no se editan aquí
  const [bloqueado, setBloqueado] = useState(false);
  // id del usuario que se está editando; null = el formulario está en modo alta
  const [editando, setEditando] = useState(null);

  const load = () => {
    usersApi.list().then((u) => setUsuarios(u || [])).catch((err) => setError(err.message));
    rolesApi.list().then((r) => setRoles(r || [])).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const setDni = (e) => {
    // Al cambiar la cédula se invalida la comprobación anterior
    setBloqueado(false);
    setForm({ ...form, dni: e.target.value });
  };

  /**
   * Comprueba la cédula en todas las empresas: si la persona ya está registrada
   * trae sus datos para que no queden distintos en cada empresa.
   */
  const handleComprobar = async () => {
    const dni = form.dni.trim();
    if (!dni) {
      setError('Ingrese la cédula antes de comprobar');
      return;
    }
    setError(null);
    setMsg(null);
    try {
      const res = await personasApi.comprobarDni(dni);
      if (!res.encontrado) {
        setBloqueado(false);
        setMsg(`La cédula ${dni} no está registrada. Complete los datos.`);
        return;
      }
      const datos = {};
      for (const campo of Object.keys(EMPTY)) {
        datos[campo] = res.datos?.[campo] ?? '';
      }
      setForm({ ...datos, dni });
      setBloqueado(true);
      setMsg(`La cédula ${dni} ya está registrada: se completaron los datos de la persona.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
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

      if (editando) {
        // La cédula identifica a la persona: el backend no la acepta al editar.
        delete payload.dni;
        const res = await usersApi.update(editando, payload);
        setMsg(`Datos de "${res.username}" actualizados`);
        cancelarEdicion();
      } else {
        const res = await usersApi.create(payload);
        setMsg(`Usuario creado: "${res.username}" (contraseña inicial = cédula, rol CLIENT)`);
        setForm(EMPTY);
        setBloqueado(false);
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (u) => {
    setError(null);
    setMsg(null);
    setEditando(u.id);
    // Al editar nunca se bloquean los campos: el objetivo es justamente poder
    // corregir un apellido mal escrito.
    setBloqueado(false);
    // Los datos personales llegan anidados: UserResponse.person
    const p = u.person ?? {};
    setForm({
      dni: p.dni ?? '',
      firstName: p.firstName ?? '',
      middleName: p.middleName ?? '',
      lastName: p.lastName ?? '',
      email: p.email ?? '',
      phone: p.phone ?? '',
      address: p.address ?? '',
      nationality: p.nationality ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setForm(EMPTY);
    setBloqueado(false);
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
        <h3>{editando ? 'Editar usuario' : 'Nuevo usuario'}</h3>
        <p className="muted">
          {editando
            ? 'Corrige los datos personales. La cédula no se puede cambiar porque identifica a la persona.'
            : 'El username se genera automáticamente a partir de los nombres y la contraseña inicial es la cédula. El rol por defecto es CLIENT (puedes cambiarlo en la tabla).'}
        </p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Cédula (DNI) *
            <input
              value={form.dni}
              onChange={setDni}
              maxLength={10}
              pattern="[0-9]+"
              readOnly={!!editando}
              required
            />
          </label>
          {!editando && (
            <div className="form-row">
              <button type="button" className="btn" onClick={handleComprobar}>
                🔍 Comprobar
              </button>
            </div>
          )}
          {bloqueado && (
            <p className="muted">
              Esta persona ya está registrada en el sistema. Sus datos no se pueden cambiar desde
              aquí para que sean iguales en todas las empresas.
            </p>
          )}
          <label>
            Primer nombre *
            <input
              value={form.firstName}
              onChange={set('firstName')}
              maxLength={40}
              pattern={PATRON_NOMBRE}
              title={TITULO_NOMBRE}
              readOnly={bloqueado}
              required
            />
          </label>
          <label>
            Segundo nombre
            <input
              value={form.middleName}
              onChange={set('middleName')}
              maxLength={40}
              pattern={PATRON_NOMBRE}
              title={TITULO_NOMBRE}
              readOnly={bloqueado}
            />
          </label>
          <label>
            Apellidos *
            <input
              value={form.lastName}
              onChange={set('lastName')}
              maxLength={60}
              pattern={PATRON_NOMBRE}
              title={TITULO_NOMBRE}
              placeholder="Cuasquer Chisaguano"
              readOnly={bloqueado}
              required
            />
          </label>
          <label>
            Email *
            <input type="email" value={form.email} onChange={set('email')} readOnly={bloqueado} required />
          </label>
          <label>
            Teléfono *
            <input value={form.phone} onChange={set('phone')} pattern="[0-9]+" maxLength={15} readOnly={bloqueado} required />
          </label>
          <label>
            Dirección
            <input value={form.address} onChange={set('address')} readOnly={bloqueado} />
          </label>
          <label>
            Nacionalidad
            <input
              value={form.nationality}
              onChange={set('nationality')}
              maxLength={40}
              pattern={PATRON_NOMBRE}
              title={TITULO_NACIONALIDAD}
              placeholder="Ecuatoriana"
              readOnly={bloqueado}
            />
          </label>
          <div className="form-row">
            <button className="btn btn-primary" disabled={loading}>
              {loading
                ? 'Guardando…'
                : editando
                  ? 'Guardar cambios'
                  : 'Crear usuario'}
            </button>
            {editando && (
              <button type="button" className="btn" onClick={cancelarEdicion}>
                Cancelar
              </button>
            )}
          </div>
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
                  <td className="actions">
                    {/*
                      Editar es solo para ADMIN y SUPER_ADMIN. La restricción real
                      no está aquí: la ruta /usuarios ya exige esos roles y el
                      backend protege PUT /api/users/** con hasAnyRole(ADMIN,
                      SUPER_ADMIN) + comprobación de que el usuario sea del mismo
                      tenant. Esto solo evita mostrar un botón que daría 403.
                    */}
                    <button className="btn btn-small" onClick={() => handleEditar(u)}>
                      Editar
                    </button>
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
