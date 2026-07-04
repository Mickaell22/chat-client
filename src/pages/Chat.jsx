import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context.js';
import { getSocket } from '../lib/socket.js';
import { resendVerification } from '../lib/api.js';
import { displayName } from '../lib/displayName.js';
import { asDotStatus } from '../lib/presence.js';
import Avatar from '../components/Avatar.jsx';
import Modal from '../components/Modal.jsx';
import UserProfileModal from '../components/UserProfileModal.jsx';

const STATUS_OPTIONS = [
  { value: 'online', label: 'Conectado' },
  { value: 'dnd', label: 'No molestar' },
  { value: 'invisible', label: 'Desconectado' },
];

// Iconos inline (Lucide, stroke). aria-hidden: cada boton lleva su aria-label.
const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

function ReplyIcon() {
  return (
    <svg {...svgProps}>
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg {...svgProps}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...svgProps}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg {...svgProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// Ventana para agrupar mensajes consecutivos del mismo autor (estilo Discord).
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateLabel(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return 'Hoy';
  if (sameDay(date, yesterday)) return 'Ayer';
  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function timeLabel(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Chat() {
  const { user, token, signOut } = useAuth();
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [connected, setConnected] = useState(false);
  const [text, setText] = useState('');
  // Mensaje al que se esta respondiendo (null = mensaje normal).
  const [replyTo, setReplyTo] = useState(null);
  // Mensaje pendiente de confirmar borrado (null = modal cerrado).
  const [confirmDelete, setConfirmDelete] = useState(null);
  // Id del usuario cuyo perfil se esta mirando (null = modal cerrado).
  const [viewProfileId, setViewProfileId] = useState(null);
  const [myStatus, setMyStatus] = useState('online');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(
    () => Boolean(user) && localStorage.getItem(`pub.verifyBannerDismissed.${user.id}`) === '1',
  );
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendError, setResendError] = useState('');
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const statusPickerRef = useRef(null);

  // Cierra el menu de estado al hacer click afuera.
  useEffect(() => {
    if (!statusMenuOpen) return;
    const onClick = (e) => {
      if (!statusPickerRef.current?.contains(e.target)) setStatusMenuOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [statusMenuOpen]);

  useEffect(() => {
    const socket = getSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      // Restaura el ultimo estado elegido (solo si no es el default 'online').
      const saved = localStorage.getItem(`pub.status.${user.id}`);
      if (saved && saved !== 'online') socket.emit('presence:set', { status: saved });
      setMyStatus(saved || 'online');
    };
    const onDisconnect = () => setConnected(false);
    const onHistory = ({ messages }) => setMessages(messages);
    const onMessage = (msg) => setMessages((prev) => [...prev, msg]);
    const onDeleted = ({ id }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      // Si estaba respondiendo al mensaje que se borro, cancelar la respuesta.
      setReplyTo((r) => (r && r.id === id ? null : r));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('users:online', setOnline);
    socket.on('room:history', onHistory);
    socket.on('room:message', onMessage);
    socket.on('room:message:deleted', onDeleted);

    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('users:online', setOnline);
      socket.off('room:history', onHistory);
      socket.off('room:message', onMessage);
      socket.off('room:message:deleted', onDeleted);
      socket.disconnect();
    };
    // user.id es un primitivo estable para la sesion (no cambia aunque el
    // objeto user se reemplace tras editar el perfil), asi que agregarlo no
    // reconecta el socket de mas.
  }, [token, user.id]);

  // Autoscroll: movemos solo el contenedor de mensajes (scrollTop), no la
  // pagina entera. scrollIntoView arrastraba todo el layout.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !connected) return;
    socketRef.current.emit('room:message', {
      content,
      replyToId: replyTo?.id ?? null,
    });
    setText('');
    setReplyTo(null);
  }

  function startReply(m) {
    setReplyTo(m);
    inputRef.current?.focus();
  }

  function emitDelete(id) {
    socketRef.current.emit('room:message:delete', { id });
  }

  // Click normal abre el modal de confirmacion; Shift+click borra directo
  // (omite la confirmacion), como Discord.
  function handleDelete(m, e) {
    if (e?.shiftKey) {
      emitDelete(m.id);
      return;
    }
    setConfirmDelete(m);
  }

  function doDelete() {
    if (confirmDelete) emitDelete(confirmDelete.id);
    setConfirmDelete(null);
  }

  function changeStatus(status) {
    setMyStatus(status);
    setStatusMenuOpen(false);
    localStorage.setItem(`pub.status.${user.id}`, status);
    socketRef.current?.emit('presence:set', { status });
  }

  function dismissBanner() {
    setBannerDismissed(true);
    localStorage.setItem(`pub.verifyBannerDismissed.${user.id}`, '1');
  }

  async function handleResend() {
    setResendLoading(true);
    setResendError('');
    try {
      await resendVerification({ token });
      setResendCooldown(60);
    } catch (err) {
      setResendError(err.message);
      if (err.retryAfter) setResendCooldown(err.retryAfter);
    } finally {
      setResendLoading(false);
    }
  }

  // Cuenta regresiva del cooldown de reenvio (1 tick por segundo).
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  return (
    <div className="chat">
      <header className="chat-bar">
        <span className="chat-app">pub</span>
        <div className="chat-bar-user">
          <div className="status-picker" ref={statusPickerRef}>
            <button
              type="button"
              className="status-picker-trigger"
              onClick={() => setStatusMenuOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={statusMenuOpen}
            >
              <span className={`presence-dot is-${asDotStatus(myStatus)}`} />
              {STATUS_OPTIONS.find((s) => s.value === myStatus)?.label}
            </button>
            {statusMenuOpen && (
              <ul className="status-picker-menu">
                {STATUS_OPTIONS.map((opt) => (
                  <li key={opt.value}>
                    <button type="button" onClick={() => changeStatus(opt.value)}>
                      <span className={`presence-dot is-${asDotStatus(opt.value)}`} />
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link to="/friends" className="chat-friends-link" title="Amigos" aria-label="Amigos">
            <FriendsIcon />
          </Link>
          <Link to="/profile" className="chat-me" title="Mi perfil">
            <Avatar user={user} size={32} />
            <span>{displayName(user)}</span>
          </Link>
          <button type="button" onClick={signOut}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <div className="chat-body">
        <aside className="chat-online">
          <h2>En linea ({online.length})</h2>
          <ul>
            {online.map((u) => {
              const isMe = u.id === user?.id;
              return (
                <li
                  key={u.id}
                  className={isMe ? 'is-me' : 'is-clickable'}
                  onClick={isMe ? undefined : () => setViewProfileId(u.id)}
                >
                  <Avatar user={u} size={28} status={asDotStatus(isMe ? myStatus : u.status)} />
                  <span className="chat-online-name">
                    {displayName(u)}
                    {isMe && ' (tu)'}
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="chat-channel">
          <header className="channel-header">
            <span className="channel-name"># global</span>
            <span
              className={`chat-status ${connected ? 'is-on' : ''}`}
              role="status"
              aria-live="polite"
            >
              {connected ? 'conectado' : 'conectando…'}
            </span>
          </header>

          {user && user.emailVerified === false && !bannerDismissed && (
            <div className="verify-banner" role="status">
              <span className="verify-banner-text">
                Tu correo aun no esta verificado. Revisa tu bandeja y abre el
                enlace que te enviamos.
                {resendError && <span className="verify-banner-error"> {resendError}</span>}
              </span>
              <div className="verify-banner-actions">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading || resendCooldown > 0}
                >
                  {resendCooldown > 0
                    ? `Reenviar (${resendCooldown}s)`
                    : resendLoading
                      ? 'Enviando…'
                      : 'Reenviar correo'}
                </button>
                <button type="button" onClick={dismissBanner} aria-label="Cerrar aviso">
                  <CloseIcon />
                </button>
              </div>
            </div>
          )}

          <div className="chat-messages" ref={listRef}>
            {messages.length === 0 && (
              <p className="chat-empty">Aun no hay mensajes. Escribi el primero.</p>
            )}
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const date = new Date(m.createdAt);
              const prevDate = prev ? new Date(prev.createdAt) : null;
              const showDate = !prevDate || !sameDay(date, prevDate);
              // Agrupa con el anterior si es del mismo autor, mismo dia, dentro
              // de la ventana y no es una respuesta (la cita necesita cabecera).
              const grouped =
                !showDate &&
                prev &&
                prev.sender.id === m.sender.id &&
                date - prevDate < GROUP_WINDOW_MS &&
                !m.replyTo;
              const mine = m.sender.id === user?.id;

              return (
                <Fragment key={m.id}>
                  {showDate && (
                    <div className="chat-divider">
                      <span>{dateLabel(date)}</span>
                    </div>
                  )}
                  <div
                    className={`msg ${mine ? 'is-mine' : ''} ${
                      grouped ? 'is-grouped' : ''
                    }`}
                  >
                    {grouped ? (
                      <span className="msg-gutter">{timeLabel(date)}</span>
                    ) : (
                      <Avatar user={m.sender} size={40} />
                    )}
                    <div className="msg-body">
                      {m.replyTo && (
                        <div className="msg-reply">
                          <Avatar user={m.replyTo.sender} size={16} />
                          <span className="msg-reply-author">
                            {displayName(m.replyTo.sender)}
                          </span>
                          <span className="msg-reply-content">
                            {m.replyTo.content}
                          </span>
                        </div>
                      )}
                      {!grouped && (
                        <div className="msg-meta">
                          <span
                            className={`msg-author ${!mine ? 'is-clickable' : ''}`}
                            onClick={mine ? undefined : () => setViewProfileId(m.sender.id)}
                          >
                            {displayName(m.sender)}
                          </span>
                          <span className="msg-time">{timeLabel(date)}</span>
                        </div>
                      )}
                      <div className="msg-content">{m.content}</div>
                    </div>
                    <div className="msg-actions">
                      <button
                        type="button"
                        onClick={() => startReply(m)}
                        aria-label={`Responder a ${displayName(m.sender)}`}
                      >
                        <ReplyIcon />
                      </button>
                      {mine && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(m, e)}
                          aria-label="Eliminar mensaje"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>

          {replyTo && (
            <div className="reply-banner">
              <span className="reply-banner-text">
                <Avatar user={replyTo.sender} size={16} />
                Respondiendo a <strong>{displayName(replyTo.sender)}</strong>
                <span className="reply-banner-content">{replyTo.content}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label="Cancelar respuesta"
              >
                <CloseIcon />
              </button>
            </div>
          )}

          <form className="chat-input" onSubmit={handleSend}>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                connected
                  ? replyTo
                    ? `Respondiendo a ${displayName(replyTo.sender)}…`
                    : 'Escribe un mensaje en # global…'
                  : 'Conectando…'
              }
              aria-label="Mensaje para el canal global"
              maxLength={2000}
              autoComplete="off"
            />
            <button type="submit" disabled={!connected || !text.trim()}>
              Enviar
            </button>
          </form>
        </section>
      </div>

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} labelledBy="del-title">
          <h2 id="del-title" className="modal-title">
            Eliminar mensaje
          </h2>
          <p className="modal-text">
            ¿Realmente quieres eliminar este mensaje? Se borrara para todos y
            no se puede deshacer.
          </p>
          <div className="modal-preview">
            <Avatar user={confirmDelete.sender} size={36} />
            <div className="msg-body">
              {confirmDelete.replyTo && (
                <div className="msg-reply">
                  <Avatar user={confirmDelete.replyTo.sender} size={16} />
                  <span className="msg-reply-author">
                    {displayName(confirmDelete.replyTo.sender)}
                  </span>
                  <span className="msg-reply-content">
                    {confirmDelete.replyTo.content}
                  </span>
                </div>
              )}
              <div className="msg-meta">
                <span className="msg-author">
                  {displayName(confirmDelete.sender)}
                </span>
                <span className="msg-time">
                  {timeLabel(new Date(confirmDelete.createdAt))}
                </span>
              </div>
              <div className="msg-content">{confirmDelete.content}</div>
            </div>
          </div>
          <p className="modal-hint">
            Tip: manten <strong>Shift</strong> al hacer clic en eliminar para
            omitir esta confirmacion.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setConfirmDelete(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={doDelete}
              autoFocus
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}

      {viewProfileId && (
        <UserProfileModal
          key={viewProfileId}
          userId={viewProfileId}
          token={token}
          onClose={() => setViewProfileId(null)}
        />
      )}
    </div>
  );
}
