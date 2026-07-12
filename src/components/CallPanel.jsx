import { useEffect, useState } from 'react';

// Panel flotante de la llamada de voz. No renderiza nada si no hay llamada.
// Recibe el estado y las acciones del hook useCall.

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

function PhoneIcon() {
  return (
    <svg {...svgProps}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function HangupIcon() {
  // Telefono rotado (colgar).
  return (
    <svg {...svgProps} style={{ transform: 'rotate(135deg)' }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MicIcon({ muted }) {
  return (
    <svg {...svgProps}>
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" x2="12" y1="18" y2="22" />
      {muted && <line x1="3" x2="21" y1="3" y2="21" />}
    </svg>
  );
}

function CameraIcon({ off }) {
  return (
    <svg {...svgProps}>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
      {off && <line x1="2" x2="22" y1="2" y2="22" />}
    </svg>
  );
}

function MonitorIcon({ off }) {
  return (
    <svg {...svgProps}>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
      {off && <line x1="2" x2="22" y1="2" y2="22" />}
    </svg>
  );
}

function useCallTimer(active) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) return;
    // Se mide desde un timestamp de inicio y se actualiza dentro del intervalo
    // (no se hace setState sincrono en el cuerpo del efecto).
    const start = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(id);
  }, [active]);
  const shown = active ? secs : 0;
  const mm = String(Math.floor(shown / 60)).padStart(2, '0');
  const ss = String(shown % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function CallPanel({ call }) {
  const {
    status,
    peer,
    muted,
    error,
    kind,
    camOff,
    sharing,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    hangup,
    toggleMute,
    toggleCamera,
    toggleScreen,
  } = call;
  const timer = useCallTimer(status === 'in-call');

  if (status === 'idle' && !error) return null;

  const name = peer?.username ?? 'Usuario';

  const video = kind === 'video';
  const statusText = {
    calling: `Llamando a ${name}…`,
    incoming: video ? `${name} te esta llamando (video)` : `${name} te esta llamando`,
    connecting: 'Conectando…',
    'in-call': `En llamada con ${name} · ${timer}`,
  };

  return (
    <div
      className={`call-panel ${video ? 'is-video' : ''}`}
      role="dialog"
      aria-label={video ? 'Videollamada' : 'Llamada de voz'}
    >
      {error && status === 'idle' ? (
        <p className="call-error">{error}</p>
      ) : (
        <>
          {video && (status === 'connecting' || status === 'in-call') && (
            <div className="call-videos">
              <video
                className="call-video-remote"
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && remoteStream && el.srcObject !== remoteStream) {
                    el.srcObject = remoteStream;
                  }
                }}
              />
              <video
                className="call-video-local"
                autoPlay
                playsInline
                muted
                ref={(el) => {
                  if (el && localStream && el.srcObject !== localStream) {
                    el.srcObject = localStream;
                  }
                }}
              />
            </div>
          )}
          <div className="call-info">
            <span className={`call-pulse ${status === 'in-call' ? 'is-live' : ''}`} />
            <span className="call-status">{statusText[status]}</span>
          </div>
          <div className="call-actions">
            {status === 'incoming' && (
              <>
                <button
                  type="button"
                  className="call-btn call-accept"
                  onClick={acceptCall}
                  aria-label="Aceptar llamada"
                >
                  <PhoneIcon />
                </button>
                <button
                  type="button"
                  className="call-btn call-hangup"
                  onClick={rejectCall}
                  aria-label="Rechazar llamada"
                >
                  <HangupIcon />
                </button>
              </>
            )}
            {status === 'in-call' && (
              <button
                type="button"
                className={`call-btn call-mute ${muted ? 'is-muted' : ''}`}
                onClick={toggleMute}
                aria-label={muted ? 'Activar microfono' : 'Silenciar microfono'}
              >
                <MicIcon muted={muted} />
              </button>
            )}
            {video && status === 'in-call' && (
              <button
                type="button"
                className={`call-btn call-camera ${camOff ? 'is-muted' : ''}`}
                onClick={toggleCamera}
                disabled={sharing}
                aria-label={camOff ? 'Encender camara' : 'Apagar camara'}
                title={sharing ? 'No disponible mientras compartes pantalla' : undefined}
              >
                <CameraIcon off={camOff} />
              </button>
            )}
            {video && status === 'in-call' && (
              <button
                type="button"
                className={`call-btn call-share ${sharing ? 'is-sharing' : ''}`}
                onClick={toggleScreen}
                aria-label={
                  sharing ? 'Dejar de compartir pantalla' : 'Compartir pantalla'
                }
              >
                <MonitorIcon off={sharing} />
              </button>
            )}
            {(status === 'calling' || status === 'connecting' || status === 'in-call') && (
              <button
                type="button"
                className="call-btn call-hangup"
                onClick={hangup}
                aria-label="Colgar"
              >
                <HangupIcon />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
