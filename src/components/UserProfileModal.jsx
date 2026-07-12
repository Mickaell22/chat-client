import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import { getUserProfile } from '../lib/api.js';
import { displayName } from '../lib/displayName.js';
import { asDotStatus } from '../lib/presence.js';

const STATUS_LABEL = { online: 'conectado', dnd: 'no molestar', offline: 'desconectado' };

function memberSince(createdAt) {
  if (!createdAt) return null;
  return new Date(createdAt).toLocaleDateString('es', { year: 'numeric', month: 'long' });
}

// Perfil de otro usuario (o el propio), de solo lectura. Se abre al hacer
// click en un usuario del sidebar de "en linea". El padre lo monta con
// key={userId}, asi que cada usuario nuevo arranca con estado limpio (sin
// necesidad de resetear profile/error a mano en el effect).
// onMessage es opcional: si viene, se muestra "Enviar mensaje" (abre el DM
// con este usuario; el padre decide que hacer).
export default function UserProfileModal({ userId, token, onClose, onMessage }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getUserProfile({ token, userId })
      .then(({ user }) => {
        if (!cancelled) setProfile(user);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  return (
    <Modal onClose={onClose} labelledBy="profile-modal-title">
      {error && <p className="auth-error" role="alert">{error}</p>}
      {!error && !profile && <p className="modal-text">Cargando perfil…</p>}
      {profile && (
        <>
          <div
            className="profile-banner"
            style={profile.profileColor ? { '--profile-color': profile.profileColor } : undefined}
          >
            <Avatar user={profile} size={72} status={asDotStatus(profile.status)} />
          </div>
          <h2 id="profile-modal-title" className="modal-title">
            {displayName(profile)}
          </h2>
          <p className="profile-handle">
            @{profile.username} &middot; {STATUS_LABEL[asDotStatus(profile.status)] ?? 'desconectado'}
          </p>
          {profile.bio && <p className="modal-text">{profile.bio}</p>}
          {profile.createdAt && (
            <p className="profile-hint">Miembro desde {memberSince(profile.createdAt)}</p>
          )}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cerrar
            </button>
            {onMessage && (
              <button type="button" className="btn-primary" onClick={() => onMessage(profile)}>
                Enviar mensaje
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
