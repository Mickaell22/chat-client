import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../lib/api.js';
import Brand from '../components/Brand.jsx';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  // 'pending' | 'ok' | 'error'
  const [status, setStatus] = useState(token ? 'pending' : 'error');
  const [message, setMessage] = useState(
    token ? 'Verificando tu correo…' : 'Falta el token de verificacion.',
  );
  // Evita la doble verificacion del StrictMode en desarrollo (monta 2 veces).
  const done = useRef(false);

  useEffect(() => {
    if (!token || done.current) return;
    done.current = true;
    verifyEmail({ token })
      .then((data) => {
        setStatus('ok');
        setMessage(data.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message);
      });
  }, [token]);

  return (
    <div className="auth-card">
      <Brand />
      <h1>Verificacion de correo</h1>
      <p
        className={status === 'ok' ? 'auth-success' : status === 'error' ? 'auth-error' : 'auth-subtitle'}
        role="status"
      >
        {message}
      </p>
      <p className="auth-switch">
        <Link to="/login">Ir a iniciar sesion</Link>
      </p>
    </div>
  );
}
