import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../lib/api.js';
import Brand from '../components/Brand.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // El backend responde siempre el mismo mensaje generico (no revela si el
      // correo existe). Lo mostramos tal cual.
      const { message } = await requestPasswordReset({ email });
      setMessage(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <Brand />
      <h1>Recuperar contraseña</h1>
      <p className="auth-subtitle">
        Te enviaremos un enlace para restablecerla.
      </p>
      {message ? (
        <p className="auth-success" role="status">
          {message}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}
      <p className="auth-switch">
        <Link to="/login">Volver a iniciar sesion</Link>
      </p>
    </div>
  );
}
