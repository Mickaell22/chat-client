import { useState } from 'react';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import { displayName } from '../lib/displayName.js';

// Enviar la invitacion de una sala por DM, estilo Discord: lista la gente
// conocida (conversaciones DM + conectados) con un boton "Enviar" por
// usuario. Tambien muestra el codigo por si se quiere compartir a mano.
export default function InviteModal({ room, me, convos, online, onSend, onClose }) {
  const [sentTo, setSentTo] = useState(() => new Set());

  // Union de partners de DM y conectados, sin uno mismo ni duplicados.
  const byId = new Map();
  for (const c of convos) byId.set(c.user.id, c.user);
  for (const u of online) if (!byId.has(u.id)) byId.set(u.id, u);
  byId.delete(me.id);
  const targets = [...byId.values()];

  function send(u) {
    onSend(room, u);
    setSentTo((prev) => new Set(prev).add(u.id));
  }

  return (
    <Modal onClose={onClose} labelledBy="invite-title">
      <h2 id="invite-title" className="modal-title">
        Invitar a # {room.name}
      </h2>
      <p className="modal-text">
        Codigo de invitacion: <code className="invite-code">{room.inviteCode}</code>
      </p>
      {targets.length === 0 && (
        <p className="modal-text">No hay nadie a quien invitar todavia.</p>
      )}
      <ul className="invite-list">
        {targets.map((u) => (
          <li key={u.id}>
            <Avatar user={u} size={28} />
            <span className="chat-online-name">{displayName(u)}</span>
            <button
              type="button"
              className="btn-primary"
              disabled={sentTo.has(u.id)}
              onClick={() => send(u)}
            >
              {sentTo.has(u.id) ? 'Enviada' : 'Enviar'}
            </button>
          </li>
        ))}
      </ul>
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
