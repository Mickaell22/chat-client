import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context.js';
import {
  friendsList,
  friendRequests,
  sendFriendRequest,
  respondFriendRequest,
  removeFriendship,
  searchUsers,
} from '../lib/api.js';
import { displayName } from '../lib/displayName.js';
import Avatar from '../components/Avatar.jsx';
import '../Friends.css';

const TABS = [
  { id: 'all', label: 'Todos' },
  { id: 'requests', label: 'Solicitudes' },
  { id: 'add', label: 'Anadir' },
];

function sinceLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function Friends() {
  const { token } = useAuth();
  const [tab, setTab] = useState('all');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Trae amigos + solicitudes en una sola llamada (sin setState: es reusable
  // por el efecto de montaje y por reload sin romper la regla de hooks).
  const fetchAll = useCallback(
    () => Promise.all([friendsList({ token }), friendRequests({ token })]),
    [token],
  );

  // Carga inicial. Los setState van en callbacks (no en el cuerpo del efecto).
  useEffect(() => {
    let cancel = false;
    fetchAll()
      .then(([f, r]) => {
        if (cancel) return;
        setFriends(f);
        setRequests(r);
      })
      .catch((err) => !cancel && setError(err.message))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [fetchAll]);

  // Refresco tras una accion (aceptar/rechazar/eliminar). Se llama desde
  // handlers de evento, donde setState sincrono si esta permitido.
  const reload = useCallback(async () => {
    try {
      const [f, r] = await fetchAll();
      setFriends(f);
      setRequests(r);
    } catch (err) {
      setError(err.message);
    }
  }, [fetchAll]);

  async function onRespond(id, state) {
    setError('');
    try {
      await respondFriendRequest({ token, id, state });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onRemove(id) {
    setError('');
    try {
      await removeFriendship({ token, id });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-card friends-card">
        <Link to="/chat" className="profile-back">
          &larr; Volver al chat
        </Link>
        <h1>Amigos</h1>

        {error && <p className="auth-error">{error}</p>}

        <div className="friends-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`friends-tab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'requests' && requests.length > 0 && (
                <span className="friends-badge">{requests.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="friends-panel">
          {loading ? (
            <p className="friends-empty">Cargando...</p>
          ) : tab === 'all' ? (
            <FriendList friends={friends} onRemove={onRemove} />
          ) : tab === 'requests' ? (
            <RequestList requests={requests} onRespond={onRespond} />
          ) : (
            <AddFriend token={token} onSent={reload} />
          )}
        </div>
      </div>
    </div>
  );
}

function FriendList({ friends, onRemove }) {
  if (friends.length === 0) {
    return <p className="friends-empty">Todavia no tenes amigos. Proba la pestana "Anadir".</p>;
  }
  return (
    <ul className="friends-list">
      {friends.map((f) => (
        <li key={f.id} className="friend-row">
          <Avatar user={f.friend} size={38} />
          <div className="friend-info">
            <strong>{displayName(f.friend)}</strong>
            <small>Amigos desde {sinceLabel(f.since)}</small>
          </div>
          <button type="button" className="friends-btn is-ghost" onClick={() => onRemove(f.id)}>
            Eliminar
          </button>
        </li>
      ))}
    </ul>
  );
}

function RequestList({ requests, onRespond }) {
  if (requests.length === 0) {
    return <p className="friends-empty">No hay solicitudes pendientes.</p>;
  }
  return (
    <ul className="friends-list">
      {requests.map((r) => (
        <li key={r.id} className="friend-row">
          <Avatar user={r.from} size={38} />
          <div className="friend-info">
            <strong>{displayName(r.from)}</strong>
            <small>Te envio una solicitud</small>
          </div>
          <div className="friend-actions">
            <button
              type="button"
              className="friends-btn is-primary"
              onClick={() => onRespond(r.id, 'ACCEPTED')}
            >
              Aceptar
            </button>
            <button
              type="button"
              className="friends-btn is-ghost"
              onClick={() => onRespond(r.id, 'REJECTED')}
            >
              Rechazar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AddFriend({ token, onSent }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  // Ids ya solicitados en esta sesion, para deshabilitar el boton.
  const [sentIds, setSentIds] = useState([]);

  // Busqueda con debounce (300ms). Query < 2 chars no busca (el render de
  // resultados se saltea aparte, ver term.length abajo). Todos los setState van
  // dentro del timeout (asincronos), no en el cuerpo del efecto.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let cancel = false;
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchUsers({ token, q: term });
        if (!cancel) setResults(data);
      } catch (err) {
        if (!cancel) setError(err.message);
      } finally {
        if (!cancel) setSearching(false);
      }
    }, 300);
    return () => {
      cancel = true;
      clearTimeout(id);
    };
  }, [q, token]);

  async function onSend(u) {
    setError('');
    setNotice('');
    try {
      await sendFriendRequest({ token, friendId: u.id });
      setSentIds((s) => [...s, u.id]);
      setNotice(`Solicitud enviada a ${displayName(u)}.`);
      onSent?.();
    } catch (err) {
      setError(err.message);
    }
  }

  const term = q.trim();
  return (
    <div className="friends-add">
      <input
        className="friends-search"
        placeholder="Buscar usuario por nombre..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar usuario para agregar"
        autoComplete="off"
      />
      {notice && <p className="auth-success">{notice}</p>}
      {error && <p className="auth-error">{error}</p>}
      {term.length >= 2 && (
        <>
          {searching && <p className="friends-empty">Buscando...</p>}
          {!searching && results.length === 0 && (
            <p className="friends-empty">Sin resultados.</p>
          )}
          <ul className="friends-list">
            {results.map((u) => (
              <li key={u.id} className="friend-row">
                <Avatar user={u} size={38} />
                <div className="friend-info">
                  <strong>{displayName(u)}</strong>
                  <small>@{u.username}</small>
                </div>
                <button
                  type="button"
                  className="friends-btn is-primary"
                  disabled={sentIds.includes(u.id)}
                  onClick={() => onSend(u)}
                >
                  {sentIds.includes(u.id) ? 'Enviada' : 'Enviar solicitud'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
