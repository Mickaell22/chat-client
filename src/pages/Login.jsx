import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context.js';
import PasswordInput from '../components/PasswordInput.jsx';
import Brand from '../components/Brand.jsx';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  // Aviso opcional que dejan otras pantallas (ej. tras restablecer la clave).
  const notice = useLocation().state?.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn({ email, password });
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <Brand />
      <h1>Iniciar sesion</h1>
      <p className="auth-subtitle">Bienvenido de nuevo. Entra para chatear en tiempo real.</p>
      {notice && (
        <p className="auth-success" role="status">
          {notice}
        </p>
      )}
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
        <div className="auth-field">
          <label htmlFor="password">Contraseña</label>
          <PasswordInput
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="auth-switch">
        <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
      </p>
      <p className="auth-switch auth-switch-tight">
        ¿No tenes cuenta? <Link to="/register">Registrate</Link>
      </p>
    </div>
  );
}
