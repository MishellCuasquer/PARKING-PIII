import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usersApi } from '../api/services';
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

export default function RegisterPage() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => {
        payload[k] = payload[k].trim();
        if (payload[k] === '') delete payload[k];
      });
      const res = await usersApi.register(payload);
      setCreated(res);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setError(
          'El registro público está deshabilitado: la creación de usuarios requiere un administrador. ' +
            'Pide a un ADMIN que cree tu cuenta desde el módulo de Usuarios.',
        );
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <div className="auth-page">
        <div className="auth-card standalone">
          <h2>✅ Cuenta creada</h2>
          <SuccessMsg msg={`Tu nombre de usuario es "${created.username}". Tu contraseña inicial es tu número de cédula (DNI). Rol asignado: ${(created.roles || []).join(', ') || 'CLIENT'}.`} />
          <Link className="btn btn-primary" to="/login">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card standalone wide" onSubmit={handleSubmit}>
        <h2>Crear cuenta</h2>
        <p className="muted">
          Se creará una cuenta de <strong>cliente</strong>. El usuario se genera con tus nombres y la
          contraseña inicial es tu cédula.
        </p>

        <div className="form-grid">
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
            <input type="email" value={form.email} onChange={set('email')} maxLength={100} required />
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
        </div>

        <ErrorMsg error={error} />

        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Creando…' : 'Registrarme'}
        </button>

        <p className="muted center">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </form>
    </div>
  );
}
