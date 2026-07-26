import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/services';
import { ErrorMsg, SuccessMsg } from '../components/Feedback';

/**
 * Recuperación de contraseña en dos pasos, ambos en la misma pantalla:
 *  1. Pedir el enlace con el correo.
 *  2. Pegar el token recibido y fijar la nueva contraseña.
 *
 * El backend no tiene servidor de correo configurado. Cuando la propiedad
 * app.password-reset.exponer-token está activa (desarrollo/demo) el token viene
 * en la respuesta y esta pantalla lo rellena sola; si no, hay que sacarlo del
 * log de ms-usuarios.
 */
export default function RecuperarPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [repetirPassword, setRepetirPassword] = useState('');
  const [cuentas, setCuentas] = useState([]);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const solicitar = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setLoading(true);
    try {
      const res = await authApi.recuperarPassword(email.trim());
      setEnviado(true);
      setMsg(res.mensaje);
      // Una misma persona puede tener cuenta en varias empresas: el backend
      // emite un token por cuenta y hay que elegir cuál se restablece.
      const emitidos = res.tokens ?? [];
      setCuentas(emitidos);
      if (emitidos.length === 1) {
        setToken(emitidos[0].token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const restablecer = async (e) => {
    e.preventDefault();
    setError(null);
    setMsg(null);

    if (nuevaPassword !== repetirPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      await authApi.restablecerPassword(token.trim(), nuevaPassword);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>Recuperar contraseña</h1>

        {!enviado && (
          <form onSubmit={solicitar}>
            <p className="muted">
              Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña
              nueva.
            </p>

            <label>
              Correo
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@espe.edu.ec"
                autoFocus
                required
              />
            </label>

            <ErrorMsg error={error} />

            <button className="btn btn-primary" disabled={loading}>
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>

            <p className="muted center">
              <Link to="/login">Volver al inicio de sesión</Link>
            </p>
          </form>
        )}

        {enviado && (
          <form onSubmit={restablecer}>
            <SuccessMsg msg={msg} />

            {cuentas.length > 1 && (
              <label>
                Cuenta a restablecer
                <select value={token} onChange={(e) => setToken(e.target.value)} required>
                  <option value="">Selecciona una cuenta…</option>
                  {cuentas.map((c) => (
                    <option key={c.token} value={c.token}>
                      {c.username} — {c.empresa ?? 'Sin empresa'}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {cuentas.length === 0 && (
              <label>
                Token recibido
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Pega aquí el token del correo"
                  required
                />
              </label>
            )}

            <label>
              Nueva contraseña
              <input
                type="password"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </label>

            <label>
              Repetir contraseña
              <input
                type="password"
                value={repetirPassword}
                onChange={(e) => setRepetirPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </label>

            <ErrorMsg error={error} />

            <button className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando…' : 'Cambiar contraseña'}
            </button>

            <p className="muted center">
              <Link to="/login">Volver al inicio de sesión</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
