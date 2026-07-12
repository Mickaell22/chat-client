import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import { getUserProfile, sendFriendRequest, respondFriendRequest } from '../lib/api.js';
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
  // Estado de amistad local: { state, id }. Arranca del perfil y se actualiza
  // al enviar/aceptar la solicitud sin re-pedir el perfil.
  const [friendship, setFriendship] = useState(null);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getUserProfile({ token, userId })
      .then(({ user }) => {
        if (cancelled) return;
        setProfile(user);
        setFriendship(user.friendship ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  async function addFriend() {
    setBusy(true);
    setActionError('');
    try {
      const res = await sendFriendRequest({ token, friendId: profile.id });
      setFriendship({ state: 'pending_sent', id: res?.id ?? res?.friendship?.id ?? null });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function acceptRequest() {
    setBusy(true);
    setActionError('');
    try {
      await respondFriendRequest({ token, id: friendship.id, state: 'ACCEPTED' });
      setFriendship((f) => ({ ...f, state: 'friends' }));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Boton/etiqueta de amistad segun el estado (nada para uno mismo ni si hay
  // un bloqueo de por medio).
  function friendAction() {
    switch (friendship?.state) {
      case 'none':
        return (
          <button type="button" className="btn-primary" disabled={busy} onClick={addFriend}>
            Agregar amigo
          </button>
        );
      case 'pending_sent':
        return (
          <button type="button" className="btn-ghost" disabled>
            Solicitud enviada
          </button>
        );
      case 'pending_received':
        return (
          <button type="button" className="btn-primary" disabled={busy} onClick={acceptRequest}>
            Aceptar solicitud
          </button>
        );
      case 'friends':
        return <span className="profile-friends-label">Ya son amigos</span>;
      default:
        return null;
    }
  }

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
            {profile.avatarUrl ? (
              <button
                type="button"
                className="profile-photo-btn"
                onClick={() => setShowPhoto(true)}
                aria-label="Ver la foto de perfil en grande"
                title="Ver foto"
              >
                <Avatar user={profile} size={72} status={asDotStatus(profile.status)} />
              </button>
            ) : (
              <Avatar user={profile} size={72} status={asDotStatus(profile.status)} />
            )}
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
          {profile.common?.rooms.length > 0 && (
            <p className="profile-hint">
              Salas en comun: {profile.common.rooms.map((n) => `# ${n}`).join(', ')}
            </p>
          )}
          {profile.common?.friends.count > 0 && (
            <p className="profile-hint">
              {profile.common.friends.count === 1 ? 'Amigo' : 'Amigos'} en comun:{' '}
              {profile.common.friends.names.join(', ')}
              {profile.common.friends.count > profile.common.friends.names.length &&
                ` y ${profile.common.friends.count - profile.common.friends.names.length} mas`}
            </p>
          )}
          {actionError && <p className="auth-error" role="alert">{actionError}</p>}
          <div className="modal-actions">
            {friendAction()}
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cerrar
            </button>
            {onMessage && (
              <button type="button" className="btn-primary" onClick={() => onMessage(profile)}>
                Enviar mensaje
              </button>
            )}
          </div>
          {showPhoto && (
            <div
              className="photo-lightbox"
              onClick={() => setShowPhoto(false)}
              role="button"
              aria-label="Cerrar foto"
            >
              <img src={profile.avatarUrl} alt={`Foto de ${displayName(profile)}`} />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
