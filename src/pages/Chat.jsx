import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context.js';
import { getSocket } from '../lib/socket.js';
import { resendVerification, uploadChatImage } from '../lib/api.js';
import { compressImage } from '../lib/compressImage.js';
import { ensureNotifyPermission, showNotification, beep } from '../lib/notify.js';
import { displayName } from '../lib/displayName.js';
import { asDotStatus } from '../lib/presence.js';
import Avatar from '../components/Avatar.jsx';
import Modal from '../components/Modal.jsx';
import UserProfileModal from '../components/UserProfileModal.jsx';
import RoomsModal from '../components/RoomsModal.jsx';
import InviteModal from '../components/InviteModal.jsx';
import CallPanel from '../components/CallPanel.jsx';
import { useCall } from '../lib/useCall.js';

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

function PhoneIcon() {
  return (
    <svg {...svgProps}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg {...svgProps}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function BellIcon({ off }) {
  return (
    <svg {...svgProps}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      {off && <line x1="3" x2="21" y1="3" y2="21" />}
    </svg>
  );
}

function LockIcon() {
  return (
    <svg {...svgProps}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// Un DM cuyo contenido es 'pub:invite/<codigo>/<sala>' se renderiza como
// tarjeta de invitacion con boton "Unirse". ponytail: convencion sobre el
// contenido en vez de un tipo de mensaje en la DB; techo: se puede escribir
// a mano, pero no da mas poder que compartir el codigo en texto.
function parseInvite(content) {
  if (!content?.startsWith('pub:invite/')) return null;
  const [, code, name] = content.split('/');
  return code && name ? { code, name } : null;
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

// Referencia estable para "sin mensajes": evita que un bucket inexistente
// cree un array nuevo por render (dispararia el autoscroll de mas).
const NO_MESSAGES = [];

// El "escribiendo" se apaga solo si no llega el stop (se perdio o el otro
// cerro la pestaña): toda entrada mas vieja que esto se descarta.
const TYPING_TTL_MS = 4000;
// Sin teclas nuevas durante este tiempo, se avisa typing:stop.
const TYPING_IDLE_MS = 2500;

function typingLabel(users) {
  const names = users.map(displayName);
  if (names.length === 1) return `${names[0]} esta escribiendo…`;
  if (names.length === 2) return `${names[0]} y ${names[1]} estan escribiendo…`;
  return 'Varias personas estan escribiendo…';
}

export default function Chat() {
  const { user, token, signOut } = useAuth();
  // Mensajes por conversacion: clave 'global' o 'dm:<userId>'. Cada bucket de
  // DM se llena con su historial al abrirse y crece con los eventos en vivo.
  const [buckets, setBuckets] = useState({ global: [] });
  const [activeKey, setActiveKey] = useState('global');
  // Conversaciones DM (partner + fecha del ultimo mensaje) para el sidebar.
  const [convos, setConvos] = useState([]);
  // No leidos por conversacion. ponytail: solo en memoria, se resetea al
  // recargar. Upgrade: persistir lastReadAt por conversacion en la DB.
  const [unread, setUnread] = useState({});
  const [online, setOnline] = useState([]);
  // Salas visibles: todas las publicas + las privadas donde soy miembro.
  const [rooms, setRooms] = useState([]);
  const [roomsModalOpen, setRoomsModalOpen] = useState(false);
  // Sala cuya invitacion se esta enviando por DM (null = modal cerrado).
  const [inviteRoom, setInviteRoom] = useState(null);
  // Quien esta escribiendo, por conversacion: key -> { userId: { user, at } }.
  const [typers, setTypers] = useState({});
  // '' | 'uploading' | mensaje de error del envio de imagen.
  const [uploadState, setUploadState] = useState('');
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
  // Avisos de DM (notificacion del navegador + sonido). Pref por usuario.
  const [notifyOn, setNotifyOn] = useState(
    () => Boolean(user) && localStorage.getItem(`pub.notify.${user.id}`) === '1',
  );
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendError, setResendError] = useState('');
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const statusPickerRef = useRef(null);
  // Espejo de activeKey para los handlers del socket (viven fuera del render).
  const activeKeyRef = useRef('global');
  // Id (de la DB) de la sala global; llega con room:history al conectar y
  // sirve para mapear cada room:message a su bucket.
  const globalRoomIdRef = useRef(null);

  const notifyOnRef = useRef(false);
  // openDm se define mas abajo; el handler de dm:message lo usa via ref.
  const openDmRef = useRef(null);

  useEffect(() => {
    notifyOnRef.current = notifyOn;
  }, [notifyOn]);

  // true mientras ya avisamos typing:start y no mandamos el stop.
  const typingSentRef = useRef(false);
  const typingTimerRef = useRef(null);
  const fileRef = useRef(null);

  // Los errores del envio de imagen se descartan solos a los pocos segundos.
  useEffect(() => {
    if (!uploadState || uploadState === 'uploading') return;
    const id = setTimeout(() => setUploadState(''), 5000);
    return () => clearTimeout(id);
  }, [uploadState]);

  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  // Poda de "escribiendo" vencidos (stop perdido o pestaña cerrada).
  useEffect(() => {
    const id = setInterval(() => {
      setTypers((prev) => {
        const now = Date.now();
        let changed = false;
        const next = {};
        for (const [key, users] of Object.entries(prev)) {
          const kept = Object.fromEntries(
            Object.entries(users).filter(([, v]) => now - v.at < TYPING_TTL_MS),
          );
          if (Object.keys(kept).length !== Object.keys(users).length) changed = true;
          if (Object.keys(kept).length > 0) next[key] = kept;
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => {
      clearInterval(id);
      clearTimeout(typingTimerRef.current);
    };
  }, []);

  const activeMessages = buckets[activeKey] ?? NO_MESSAGES;
  // Partner del DM abierto (null si no hay un DM abierto).
  const activeDmUser = activeKey.startsWith('dm:')
    ? (convos.find((c) => `dm:${c.user.id}` === activeKey)?.user ?? null)
    : null;
  // Sala abierta que no es la global (null si es la global o un DM).
  const activeRoom = activeKey.startsWith('room:')
    ? (rooms.find((r) => `room:${r.id}` === activeKey) ?? null)
    : null;
  const joinedRooms = rooms.filter((r) => r.joined);
  const activeTypers = Object.values(typers[activeKey] ?? {}).map((v) => v.user);

  // Llamadas de voz 1-a-1 (WebRTC). Reusa el mismo socket singleton que el chat.
  const callSocket = useMemo(() => getSocket(token), [token]);
  const call = useCall(callSocket);

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
    // Suma un no-leido si el mensaje es de otro y su conversacion no es la
    // que esta abierta.
    const bumpUnread = (key, msg) => {
      if (msg.sender.id === user.id || activeKeyRef.current === key) return;
      setUnread((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
    };
    const onHistory = ({ roomId, messages }) => {
      globalRoomIdRef.current = roomId;
      setBuckets((prev) => ({ ...prev, global: messages }));
    };
    // Un room:message puede ser de la global o de cualquier sala unida (el
    // socket esta en todas). Se enruta a su bucket por roomId.
    const onMessage = (msg) => {
      const key =
        msg.roomId === globalRoomIdRef.current ? 'global' : `room:${msg.roomId}`;
      setBuckets((prev) =>
        key in prev ? { ...prev, [key]: [...prev[key], msg] } : prev,
      );
      bumpUnread(key, msg);
    };
    const onRoomCreated = (room) => {
      setRooms((prev) => (prev.some((r) => r.id === room.id) ? prev : [...prev, room]));
    };
    // La conversacion a la que pertenece un evento de typing: la sala (por
    // roomId) o, si es un DM, la conversacion con quien escribe.
    const typingKey = ({ user: typer, roomId }) =>
      roomId
        ? roomId === globalRoomIdRef.current
          ? 'global'
          : `room:${roomId}`
        : `dm:${typer.id}`;
    const onTypingStart = (payload) => {
      const typer = payload.user;
      if (typer.id === user.id) return;
      const key = typingKey(payload);
      setTypers((prev) => ({
        ...prev,
        [key]: { ...prev[key], [typer.id]: { user: typer, at: Date.now() } },
      }));
    };
    const onTypingStop = (payload) => {
      const key = typingKey(payload);
      setTypers((prev) => {
        if (!prev[key]?.[payload.user.id]) return prev;
        const users = { ...prev[key] };
        delete users[payload.user.id];
        const next = { ...prev };
        if (Object.keys(users).length > 0) next[key] = users;
        else delete next[key];
        return next;
      });
    };
    const onDm = (msg) => {
      const partner = msg.sender.id === user.id ? msg.recipient : msg.sender;
      const key = `dm:${partner.id}`;
      // Solo se agrega si la conversacion ya esta cargada; si no, el historial
      // la traera completa al abrirla (evita conversaciones a medias).
      setBuckets((prev) =>
        key in prev ? { ...prev, [key]: [...prev[key], msg] } : prev,
      );
      setConvos((prev) => [
        { user: partner, lastMessageAt: msg.createdAt },
        ...prev.filter((c) => c.user.id !== partner.id),
      ]);
      bumpUnread(key, msg);
      // Aviso nativo + beep si el DM es de otro y no lo estoy mirando.
      if (
        msg.sender.id !== user.id &&
        notifyOnRef.current &&
        (document.hidden || activeKeyRef.current !== key)
      ) {
        beep();
        showNotification({
          title: displayName(msg.sender),
          body: parseInvite(msg.content)
            ? 'Te invito a una sala'
            : msg.content || '(imagen)',
          icon: msg.sender.avatarUrl,
          onClick: () => openDmRef.current?.(msg.sender),
        });
      }
    };
    // Borrado (de sala o DM): se quita de todos los buckets, es mas simple
    // que averiguar en cual vive.
    const onDeleted = ({ id }) => {
      setBuckets((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([k, list]) => [k, list.filter((m) => m.id !== id)]),
        ),
      );
      // Si estaba respondiendo al mensaje que se borro, cancelar la respuesta.
      setReplyTo((r) => (r && r.id === id ? null : r));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('users:online', setOnline);
    socket.on('room:history', onHistory);
    socket.on('room:message', onMessage);
    socket.on('room:message:deleted', onDeleted);
    socket.on('dm:conversations', setConvos);
    socket.on('dm:message', onDm);
    socket.on('dm:message:deleted', onDeleted);
    socket.on('rooms:list', setRooms);
    socket.on('room:created', onRoomCreated);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);

    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('users:online', setOnline);
      socket.off('room:history', onHistory);
      socket.off('room:message', onMessage);
      socket.off('room:message:deleted', onDeleted);
      socket.off('dm:conversations', setConvos);
      socket.off('dm:message', onDm);
      socket.off('dm:message:deleted', onDeleted);
      socket.off('rooms:list', setRooms);
      socket.off('room:created', onRoomCreated);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
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
  }, [activeMessages]);

  // A quien va dirigido el typing de ESTA conversacion (se lee antes de
  // cambiar de chat, por eso stopTyping va primero en openChat).
  function typingTarget() {
    return activeDmUser
      ? { toUserId: activeDmUser.id }
      : { roomId: activeRoom ? activeRoom.id : null };
  }

  function stopTyping() {
    clearTimeout(typingTimerRef.current);
    if (typingSentRef.current) {
      socketRef.current?.emit('typing:stop', typingTarget());
      typingSentRef.current = false;
    }
  }

  // Avisa typing:start una sola vez por rafaga de teclas; el stop sale solo
  // tras TYPING_IDLE_MS sin escribir (o al enviar / cambiar de chat).
  function handleTyping() {
    if (!connected) return;
    if (!typingSentRef.current) {
      socketRef.current?.emit('typing:start', typingTarget());
      typingSentRef.current = true;
    }
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }

  function handleSend(e) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !connected) return;
    stopTyping();
    const payload = { content, replyToId: replyTo?.id ?? null };
    if (activeDmUser) {
      socketRef.current.emit('dm:message', { ...payload, toUserId: activeDmUser.id });
    } else {
      socketRef.current.emit('room:message', {
        ...payload,
        roomId: activeRoom ? activeRoom.id : null,
      });
    }
    setText('');
    setReplyTo(null);
  }

  // Enviar imagen: se valida, se comprime con canvas (lado max 1600, JPEG),
  // se sube por HTTP y el mensaje viaja por socket solo con la URL. El texto
  // del input (si hay) va como caption del mismo mensaje.
  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite elegir el mismo archivo dos veces seguidas
    if (!file || !connected) return;
    if (!file.type.startsWith('image/')) {
      setUploadState('Solo se pueden enviar imagenes.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadState('La imagen no puede superar los 10 MB.');
      return;
    }
    setUploadState('uploading');
    try {
      const compressed = await compressImage(file);
      const { url } = await uploadChatImage({ token, file: compressed });
      const payload = {
        content: text.trim(),
        imageUrl: url,
        replyToId: replyTo?.id ?? null,
      };
      if (activeDmUser) {
        socketRef.current.emit('dm:message', { ...payload, toUserId: activeDmUser.id });
      } else {
        socketRef.current.emit('room:message', {
          ...payload,
          roomId: activeRoom ? activeRoom.id : null,
        });
      }
      stopTyping();
      setText('');
      setReplyTo(null);
      setUploadState('');
    } catch (err) {
      setUploadState(err.message || 'No se pudo enviar la imagen.');
    }
  }

  // Cambia de conversacion: descarta la respuesta pendiente (era de la otra
  // conversacion), limpia sus no-leidos y deja el input listo para escribir.
  function openChat(key) {
    stopTyping();
    setActiveKey(key);
    setReplyTo(null);
    setUnread((prev) => ({ ...prev, [key]: 0 }));
    inputRef.current?.focus();
  }

  function openDm(partner) {
    const key = `dm:${partner.id}`;
    // Conversacion nueva (sin mensajes todavia): entra al sidebar igual.
    setConvos((prev) =>
      prev.some((c) => c.user.id === partner.id)
        ? prev
        : [{ user: partner, lastMessageAt: null }, ...prev],
    );
    if (!(key in buckets)) {
      socketRef.current?.emit('dm:history', { withUserId: partner.id }, (res) => {
        if (res?.messages) setBuckets((prev) => ({ ...prev, [key]: res.messages }));
      });
    }
    setViewProfileId(null);
    openChat(key);
  }

  function openRoom(room) {
    const key = `room:${room.id}`;
    if (!(key in buckets)) {
      socketRef.current?.emit('room:history', { roomId: room.id }, (res) => {
        if (res?.messages) setBuckets((prev) => ({ ...prev, [key]: res.messages }));
      });
    }
    setRoomsModalOpen(false);
    openChat(key);
  }

  // Alta o refresco de una sala en la lista local (tras crear o unirse).
  function upsertRoom(room) {
    setRooms((prev) => [...prev.filter((r) => r.id !== room.id), room]);
  }

  function createRoom(payload, cb) {
    socketRef.current?.emit('room:create', payload, (res) => {
      if (res?.room) {
        upsertRoom(res.room);
        openRoom(res.room);
      }
      cb?.(res);
    });
  }

  // payload: { roomId } (sala publica) o { code } (invitacion).
  function joinRoom(payload, cb) {
    socketRef.current?.emit('room:join', payload, (res) => {
      if (res?.room) {
        upsertRoom(res.room);
        openRoom(res.room);
      }
      cb?.(res);
    });
  }

  function leaveRoom(room) {
    socketRef.current?.emit('room:leave', { roomId: room.id }, () => {});
    // Una privada desaparece de la lista; una publica queda como "no unida".
    setRooms((prev) =>
      room.isPrivate
        ? prev.filter((r) => r.id !== room.id)
        : prev.map((r) =>
            r.id === room.id ? { ...r, joined: false, inviteCode: null } : r,
          ),
    );
    setBuckets((prev) => {
      const rest = { ...prev };
      delete rest[`room:${room.id}`];
      return rest;
    });
    if (activeKey === `room:${room.id}`) openChat('global');
  }

  // La invitacion viaja como DM con el formato que entiende parseInvite.
  function sendInvite(room, toUser) {
    socketRef.current?.emit('dm:message', {
      content: `pub:invite/${room.inviteCode}/${room.name}`,
      toUserId: toUser.id,
      replyToId: null,
    });
  }

  function acceptInvite(invite) {
    const joined = rooms.find((r) => r.inviteCode === invite.code && r.joined);
    if (joined) openRoom(joined);
    else joinRoom({ code: invite.code });
  }

  // El handler del socket necesita openDm ya definido: se refresca por efecto.
  useEffect(() => {
    openDmRef.current = openDm;
  });

  // Activa/desactiva los avisos de DM. Activar pide el permiso del navegador
  // (estamos dentro de un gesto del usuario); si lo deniegan queda solo el
  // beep, que no necesita permiso.
  async function toggleNotify() {
    const next = !notifyOn;
    setNotifyOn(next);
    localStorage.setItem(`pub.notify.${user.id}`, next ? '1' : '0');
    if (next) await ensureNotifyPermission();
  }

  function startReply(m) {
    setReplyTo(m);
    inputRef.current?.focus();
  }

  // Un mensaje con recipientId es un DM: se borra por el evento de DM.
  function emitDelete(m) {
    socketRef.current.emit(
      m.recipientId ? 'dm:message:delete' : 'room:message:delete',
      { id: m.id },
    );
  }

  // Click normal abre el modal de confirmacion; Shift+click borra directo
  // (omite la confirmacion), como Discord.
  function handleDelete(m, e) {
    if (e?.shiftKey) {
      emitDelete(m);
      return;
    }
    setConfirmDelete(m);
  }

  function doDelete() {
    if (confirmDelete) emitDelete(confirmDelete);
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
        <span className="chat-app">
          <img className="chat-app-mark" src="/pub-mark.png" alt="" aria-hidden="true" />
          pub
        </span>
        <div className="chat-bar-user">
          <button
            type="button"
            className="chat-bell"
            onClick={toggleNotify}
            aria-pressed={notifyOn}
            aria-label={notifyOn ? 'Desactivar avisos de mensajes' : 'Activar avisos de mensajes'}
            title={notifyOn ? 'Avisos de DM activados' : 'Avisos de DM desactivados'}
          >
            <BellIcon off={!notifyOn} />
          </button>
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
          <section>
            <h2>Canales</h2>
            <ul>
              <li
                className={`is-clickable ${activeKey === 'global' ? 'is-active' : ''}`}
                onClick={() => openChat('global')}
              >
                <span className="side-hash" aria-hidden="true">#</span>
                <span className="chat-online-name">global</span>
                {unread.global > 0 && <span className="side-badge">{unread.global}</span>}
              </li>
              {joinedRooms.map((r) => {
                const key = `room:${r.id}`;
                return (
                  <li
                    key={r.id}
                    className={`is-clickable ${activeKey === key ? 'is-active' : ''}`}
                    onClick={() => openRoom(r)}
                  >
                    <span className="side-hash" aria-hidden="true">
                      {r.isPrivate ? <LockIcon /> : '#'}
                    </span>
                    <span className="chat-online-name">{r.name}</span>
                    {unread[key] > 0 && <span className="side-badge">{unread[key]}</span>}
                  </li>
                );
              })}
              <li className="is-clickable side-more" onClick={() => setRoomsModalOpen(true)}>
                <span className="side-hash" aria-hidden="true">+</span>
                <span className="chat-online-name">salas</span>
              </li>
            </ul>
          </section>

          {convos.length > 0 && (
            <section>
              <h2>Mensajes directos</h2>
              <ul>
                {convos.map((c) => {
                  const key = `dm:${c.user.id}`;
                  const presence = online.find((u) => u.id === c.user.id);
                  return (
                    <li
                      key={c.user.id}
                      className={`is-clickable ${activeKey === key ? 'is-active' : ''}`}
                      onClick={() => openDm(c.user)}
                    >
                      <Avatar
                        user={c.user}
                        size={28}
                        status={asDotStatus(presence?.status ?? 'offline')}
                      />
                      <span className="chat-online-name">{displayName(c.user)}</span>
                      {unread[key] > 0 && <span className="side-badge">{unread[key]}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section>
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
          </section>
        </aside>

        <section className="chat-channel">
          <header className="channel-header">
            <span className="channel-name">
              {activeDmUser
                ? `@${displayName(activeDmUser)}`
                : activeRoom
                  ? `# ${activeRoom.name}`
                  : '# global'}
            </span>
            <span
              className={`chat-status ${connected ? 'is-on' : ''}`}
              role="status"
              aria-live="polite"
            >
              {connected ? 'conectado' : 'conectando…'}
            </span>
            {activeRoom?.inviteCode && (
              <button
                type="button"
                className="channel-invite"
                onClick={() => setInviteRoom(activeRoom)}
              >
                Invitar
              </button>
            )}
            {activeDmUser && (
              <button
                type="button"
                className="channel-invite channel-call"
                onClick={() =>
                  call.startCall({
                    id: activeDmUser.id,
                    username: displayName(activeDmUser),
                  })
                }
                disabled={call.status !== 'idle'}
                aria-label={`Llamar a ${displayName(activeDmUser)}`}
              >
                <PhoneIcon />
                Llamar
              </button>
            )}
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
            {activeMessages.length === 0 && (
              <p className="chat-empty">
                {activeDmUser
                  ? `Este es el comienzo de tu conversacion con ${displayName(activeDmUser)}.`
                  : activeRoom
                    ? `Este es el comienzo de # ${activeRoom.name}.`
                    : 'Aun no hay mensajes. Escribi el primero.'}
              </p>
            )}
            {activeMessages.map((m, i) => {
              const prev = activeMessages[i - 1];
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
              const invite = parseInvite(m.content);
              const inviteJoined =
                invite && rooms.some((r) => r.inviteCode === invite.code && r.joined);

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
                            {m.replyTo.content || '(imagen)'}
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
                      {m.imageUrl && (
                        <a
                          href={m.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="msg-image-link"
                        >
                          <img
                            className="msg-image"
                            src={m.imageUrl}
                            alt={`Imagen enviada por ${displayName(m.sender)}`}
                            loading="lazy"
                            // La imagen carga despues del autoscroll y agranda
                            // la lista: al cargar se vuelve a bajar al final.
                            onLoad={() => {
                              const el = listRef.current;
                              if (el) el.scrollTop = el.scrollHeight;
                            }}
                          />
                        </a>
                      )}
                      {invite ? (
                        <div className="msg-invite">
                          <span className="msg-invite-text">
                            Invitacion a la sala <strong># {invite.name}</strong>
                          </span>
                          <button type="button" onClick={() => acceptInvite(invite)}>
                            {inviteJoined ? 'Abrir' : 'Unirse'}
                          </button>
                        </div>
                      ) : (
                        m.content && <div className="msg-content">{m.content}</div>
                      )}
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
                <span className="reply-banner-content">
                  {replyTo.content || '(imagen)'}
                </span>
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

          <div className="chat-input-area">
            {(activeTypers.length > 0 || uploadState) && (
              <div className="input-overlays">
                {activeTypers.length > 0 && (
                  <div className="typing-indicator" aria-live="polite">
                    {typingLabel(activeTypers)}
                  </div>
                )}
                {uploadState && (
                  <div
                    className={`upload-status ${uploadState !== 'uploading' ? 'is-error' : ''}`}
                    role="status"
                  >
                    {uploadState === 'uploading' ? 'Enviando imagen…' : uploadState}
                  </div>
                )}
              </div>
            )}
            <form className="chat-input" onSubmit={handleSend}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleImagePick}
            />
            <button
              type="button"
              className="chat-attach"
              onClick={() => fileRef.current?.click()}
              disabled={!connected || uploadState === 'uploading'}
              aria-label="Enviar imagen"
              title="Enviar imagen"
            >
              <ImageIcon />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                handleTyping();
              }}
              placeholder={
                connected
                  ? replyTo
                    ? `Respondiendo a ${displayName(replyTo.sender)}…`
                    : activeDmUser
                      ? `Escribe un mensaje para ${displayName(activeDmUser)}…`
                      : `Escribe un mensaje en # ${activeRoom ? activeRoom.name : 'global'}…`
                  : 'Conectando…'
              }
              aria-label={
                activeDmUser
                  ? `Mensaje para ${displayName(activeDmUser)}`
                  : `Mensaje para el canal ${activeRoom ? activeRoom.name : 'global'}`
              }
              maxLength={2000}
              autoComplete="off"
            />
            <button type="submit" disabled={!connected || !text.trim()}>
              Enviar
            </button>
            </form>
          </div>
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
                    {confirmDelete.replyTo.content || '(imagen)'}
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
              <div className="msg-content">{confirmDelete.content || '(imagen)'}</div>
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

      {roomsModalOpen && (
        <RoomsModal
          rooms={rooms}
          onCreate={createRoom}
          onJoin={joinRoom}
          onOpen={openRoom}
          onLeave={leaveRoom}
          onClose={() => setRoomsModalOpen(false)}
        />
      )}

      {inviteRoom && (
        <InviteModal
          room={inviteRoom}
          me={user}
          convos={convos}
          online={online}
          onSend={sendInvite}
          onClose={() => setInviteRoom(null)}
        />
      )}

      {viewProfileId && (
        <UserProfileModal
          key={viewProfileId}
          userId={viewProfileId}
          token={token}
          onClose={() => setViewProfileId(null)}
          onMessage={openDm}
        />
      )}

      <CallPanel call={call} />
    </div>
  );
}
