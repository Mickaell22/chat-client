import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context.js';
import { uploadAvatar } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';

export default function Profile() {
  const { user, token, updateUser } = useAuth();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { user: updated } = await uploadAvatar({ token, file });
      updateUser(updated);
      setMessage('Foto actualizada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <Link to="/chat" className="profile-back">
          &larr; Volver al chat
        </Link>
        <h1>Mi perfil</h1>

        <div className="profile-avatar">
          <Avatar user={user} size={96} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            {loading ? 'Subiendo…' : 'Cambiar foto'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            hidden
          />
          <p className="profile-hint">JPG o PNG, hasta 5 MB.</p>
        </div>

        {message && (
          <p className="auth-success" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <dl className="profile-fields">
          <div>
            <dt>Usuario</dt>
            <dd>{user?.username}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>
              {user?.email}{' '}
              {user?.emailVerified ? (
                <span className="badge badge-ok">verificado</span>
              ) : (
                <span className="badge badge-warn">sin verificar</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
