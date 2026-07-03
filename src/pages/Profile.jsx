import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context.js';
import { uploadAvatar, updateProfile, resendVerification } from '../lib/api.js';
import { PROFILE_COLORS } from '../lib/profileColors.js';
import Avatar from '../components/Avatar.jsx';

// Deben coincidir con ALIAS_MAX_LENGTH/BIO_MAX_LENGTH en chat-server/src/config/constants.js
const ALIAS_MAX_LENGTH = 40;
const BIO_MAX_LENGTH = 160;

function memberSince(createdAt) {
  if (!createdAt) return null;
  return new Date(createdAt).toLocaleDateString('es', { year: 'numeric', month: 'long' });
}

export default function Profile() {
  const { user, token, updateUser } = useAuth();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const [alias, setAlias] = useState(user?.alias ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [profileColor, setProfileColor] = useState(user?.profileColor ?? null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

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

  async function handleSaveProfile(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSavingProfile(true);
    try {
      const { user: updated } = await updateProfile({ token, alias, bio, profileColor });
      updateUser(updated);
      setMessage('Perfil actualizado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    setResendMsg('');
    try {
      await resendVerification({ token });
      setResendMsg('Correo reenviado.');
      setResendCooldown(60);
    } catch (err) {
      setResendMsg(err.message);
      if (err.retryAfter) setResendCooldown(err.retryAfter);
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <Link to="/chat" className="profile-back">
          &larr; Volver al chat
        </Link>
        <h1>Mi perfil</h1>

        <div
          className="profile-banner"
          style={profileColor ? { '--profile-color': profileColor } : undefined}
        >
          <Avatar user={user} size={96} />
        </div>

        <div className="profile-avatar">
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

        <form className="profile-form" onSubmit={handleSaveProfile}>
          <label>
            Alias
            <input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={ALIAS_MAX_LENGTH}
              placeholder={user?.username}
            />
          </label>
          <label>
            Bio
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={BIO_MAX_LENGTH}
              rows={3}
            />
            <span className="profile-char-count">
              {bio.length}/{BIO_MAX_LENGTH}
            </span>
          </label>
          <div className="profile-swatches">
            <span className="profile-swatches-label">Color de perfil</span>
            <div className="swatch-row">
              {PROFILE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`swatch ${profileColor === color ? 'is-selected' : ''}`}
                  style={{ background: color }}
                  aria-label={`Color ${color}`}
                  onClick={() => setProfileColor(profileColor === color ? null : color)}
                />
              ))}
            </div>
          </div>
          <button type="submit" disabled={savingProfile}>
            {savingProfile ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>

        <dl className="profile-fields">
          <div>
            <dt>Usuario</dt>
            <dd>@{user?.username}</dd>
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
          {!user?.emailVerified && (
            <div>
              <dt />
              <dd>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading || resendCooldown > 0}
                >
                  {resendCooldown > 0
                    ? `Reenviar (${resendCooldown}s)`
                    : resendLoading
                      ? 'Enviando…'
                      : 'Reenviar correo de verificacion'}
                </button>
                {resendMsg && <span className="profile-hint"> {resendMsg}</span>}
              </dd>
            </div>
          )}
          {user?.createdAt && (
            <div>
              <dt>Miembro desde</dt>
              <dd>{memberSince(user.createdAt)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
