import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../lib/api.js';
import PasswordInput from '../components/PasswordInput.jsx';
import Brand from '../components/Brand.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ token, password });
      // Listo: mandamos al login con un aviso para que entre con la nueva clave.
      navigate('/login', {
        replace: true,
        state: { notice: 'Contraseña actualizada. Inicia sesion con tu nueva contraseña.' },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Sin token el enlace es invalido: no tiene sentido mostrar el formulario.
  if (!token) {
    return (
      <div className="auth-card">
        <Brand />
        <h1>Enlace invalido</h1>
        <p className="auth-subtitle">
          Falta el token de recuperacion. Solicita un nuevo enlace.
        </p>
        <p className="auth-switch">
          <Link to="/forgot-password">Pedir otro enlace</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <Brand />
      <h1>Nueva contraseña</h1>
      <p className="auth-subtitle">Elige una contraseña para tu cuenta.</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="password">Nueva contraseña</label>
          <PasswordInput
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="confirm">Confirmar contraseña</label>
          <PasswordInput
            id="confirm"
            name="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading}>
          {loading ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
      <p className="auth-switch">
        <Link to="/login">Volver a iniciar sesion</Link>
      </p>
    </div>
  );
}
