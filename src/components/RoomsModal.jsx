import { useState } from 'react';
import Modal from './Modal.jsx';

// Explorar, crear y unirse a salas. Las acciones responden por ack del
// socket: si el server devuelve { error } se muestra tal cual.
export default function RoomsModal({ rooms, onCreate, onJoin, onOpen, onLeave, onClose }) {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const sorted = [...rooms].sort((a, b) => a.name.localeCompare(b.name));

  function handleAck(res) {
    if (res?.error) setError(res.error);
  }

  function submitCreate(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return;
    onCreate({ name, isPrivate }, handleAck);
  }

  function submitCode(e) {
    e.preventDefault();
    setError('');
    if (!code.trim()) return;
    onJoin({ code: code.trim() }, handleAck);
  }

  return (
    <Modal onClose={onClose} labelledBy="rooms-title">
      <h2 id="rooms-title" className="modal-title">
        Salas
      </h2>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <form className="rooms-form" onSubmit={submitCreate}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la sala nueva"
          aria-label="Nombre de la sala nueva"
          maxLength={24}
        />
        <button type="submit" className="btn-primary" disabled={!name.trim()}>
          Crear
        </button>
        <label className="rooms-private">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          Privada (solo se entra con codigo de invitacion)
        </label>
      </form>

      <form className="rooms-form" onSubmit={submitCode}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="¿Tienes un codigo? Pegalo aqui"
          aria-label="Codigo de invitacion"
        />
        <button type="submit" className="btn-ghost" disabled={!code.trim()}>
          Unirse
        </button>
      </form>

      <ul className="rooms-list">
        {sorted.length === 0 && (
          <li className="rooms-empty">Aun no hay salas. Crea la primera.</li>
        )}
        {sorted.map((r) => (
          <li key={r.id}>
            <span className="rooms-name">
              # {r.name}
              {r.isPrivate ? ' (privada)' : ''}
            </span>
            {r.joined ? (
              <>
                <button type="button" className="btn-ghost" onClick={() => onOpen(r)}>
                  Abrir
                </button>
                <button type="button" className="btn-ghost" onClick={() => onLeave(r)}>
                  Salir
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={() => onJoin({ roomId: r.id }, handleAck)}
              >
                Unirse
              </button>
            )}
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
