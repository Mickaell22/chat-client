import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/context.js';
import { getSocket } from '../lib/socket.js';

export default function Chat() {
  const { user, token, signOut } = useAuth();
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [connected, setConnected] = useState(false);
  const [text, setText] = useState('');
  const socketRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const socket = getSocket(token);
    socketRef.current = socket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onHistory = ({ messages }) => setMessages(messages);
    const onMessage = (msg) => setMessages((prev) => [...prev, msg]);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('users:online', setOnline);
    socket.on('room:history', onHistory);
    socket.on('room:message', onMessage);

    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('users:online', setOnline);
      socket.off('room:history', onHistory);
      socket.off('room:message', onMessage);
      socket.disconnect();
    };
  }, [token]);

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
    socketRef.current.emit('room:message', { content });
    setText('');
  }

  return (
    <div className="chat">
      <header className="chat-bar">
        <div className="chat-bar-title">
          <strong># global</strong>
          <span className={`chat-status ${connected ? 'is-on' : ''}`}>
            {connected ? 'conectado' : 'conectando…'}
          </span>
        </div>
        <div className="chat-bar-user">
          <span>
            Conectado como <strong>{user?.username}</strong>
          </span>
          <button type="button" onClick={signOut}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <div className="chat-body">
        <aside className="chat-online">
          <h2>En linea ({online.length})</h2>
          <ul>
            {online.map((u) => (
              <li key={u.id} className={u.id === user?.id ? 'is-me' : ''}>
                <span className="dot" />
                {u.username}
                {u.id === user?.id && ' (tu)'}
              </li>
            ))}
          </ul>
        </aside>

        <section className="chat-main">
          {user && user.emailVerified === false && (
            <p className="verify-banner" role="status">
              Tu correo aun no esta verificado. Revisa tu bandeja y abre el
              enlace que te enviamos.
            </p>
          )}
          <div className="chat-messages" ref={listRef}>
            {messages.length === 0 && (
              <p className="chat-empty">Aun no hay mensajes. Escribi el primero.</p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`msg ${m.sender.id === user?.id ? 'is-mine' : ''}`}
              >
                <div className="msg-meta">
                  <span className="msg-author">{m.sender.username}</span>
                  <span className="msg-time">
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="msg-content">{m.content}</div>
              </div>
            ))}
          </div>

          <form className="chat-input" onSubmit={handleSend}>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={connected ? 'Escribe un mensaje…' : 'Conectando…'}
              maxLength={2000}
              autoComplete="off"
            />
            <button type="submit" disabled={!connected || !text.trim()}>
              Enviar
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
