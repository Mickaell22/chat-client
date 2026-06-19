import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context.js';
import PasswordInput from '../components/PasswordInput.jsx';
import Brand from '../components/Brand.jsx';

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
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
      await signUp({ username, email, password });
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
      <h1>Crear cuenta</h1>
      <p className="auth-subtitle">Registrate para empezar a chatear.</p>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            name="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]+"
            title="3-30 caracteres: letras, numeros o guion bajo."
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
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
          {loading ? 'Creando…' : 'Registrarme'}
        </button>
      </form>
      <p className="auth-switch">
        ¿Ya tenes cuenta? <Link to="/login">Inicia sesion</Link>
      </p>
    </div>
  );
}
