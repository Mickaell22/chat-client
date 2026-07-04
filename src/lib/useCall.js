import { useCallback, useEffect, useRef, useState } from 'react';

// Llamada de voz 1-a-1 con WebRTC (experimento, feat/voice-call).
//
// El socket solo hace de señalizacion (invite/accept/reject/signal/hangup): el
// audio viaja P2P por WebRTC, no por el socket. Este hook maneja UNA sola
// conexion (RTCPeerConnection) contra un unico par.
//
// ponytail: solo STUN publico de Google, sin TURN. Techo: dos redes con NAT
// restrictivo (WiFi corporativo, datos moviles) pueden no conectar. Upgrade:
// agregar un TURN (coturn self-host o servicio pago) a iceServers.
const ICE_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

// Estados: idle | calling (yo llame, espero) | incoming (me llaman) |
// connecting (negociando SDP/ICE) | in-call (audio fluyendo).
// El server ya evita las auto-llamadas, asi que el hook no necesita el propio id.
export function useCall(socket) {
  const [status, setStatus] = useState('idle');
  const [peer, setPeer] = useState(null); // { id, username } del otro
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  // ICE candidates que llegan antes de setRemoteDescription: se encolan y se
  // aplican despues (evita el race clasico de WebRTC).
  const pendingRef = useRef([]);
  // El par actual en un ref, para leerlo dentro de los listeners sin recrearlos.
  const peerRef = useRef(null);
  const statusRef = useRef('idle');

  const setPeerBoth = (p) => {
    peerRef.current = p;
    setPeer(p);
  };
  const setStatusBoth = (s) => {
    statusRef.current = s;
    setStatus(s);
  };

  // Cierra la conexion y libera el microfono. No emite nada (el emit lo hace
  // quien llama a hangup/cleanup segun corresponda).
  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    pendingRef.current = [];
    setPeerBoth(null);
    setMuted(false);
    setStatusBoth('idle');
  }, []);

  // Crea el RTCPeerConnection, pide el microfono y cablea los callbacks.
  // `peerId` es a quien se le mandan los ICE candidates.
  const createPeer = useCallback(
    async (peerId) => {
      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcRef.current = pc;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('call:signal', { to: peerId, data: { candidate: e.candidate } });
        }
      };
      pc.ontrack = (e) => {
        if (!remoteAudioRef.current) {
          remoteAudioRef.current = new Audio();
          remoteAudioRef.current.autoplay = true;
        }
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'connected') setStatusBoth('in-call');
        else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
          if (statusRef.current !== 'idle') {
            setError('La llamada se corto.');
            cleanup();
          }
        }
      };
      return pc;
    },
    [socket, cleanup],
  );

  // Aplica los ICE candidates que se habian encolado antes de tener remoteDesc.
  const flushCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const queued = pendingRef.current;
    pendingRef.current = [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* candidato invalido: se ignora */
      }
    }
  }, []);

  // --- Acciones del usuario ---

  const startCall = useCallback(
    (target) => {
      if (statusRef.current !== 'idle') return;
      setError('');
      setPeerBoth({ id: target.id, username: target.username });
      setStatusBoth('calling');
      socket.emit('call:invite', { to: target.id });
    },
    [socket],
  );

  const acceptCall = useCallback(async () => {
    const p = peerRef.current;
    if (!p || statusRef.current !== 'incoming') return;
    try {
      await createPeer(p.id);
      setStatusBoth('connecting');
      socket.emit('call:accept', { to: p.id });
    } catch {
      setError('No se pudo acceder al microfono.');
      socket.emit('call:reject', { to: p.id });
      cleanup();
    }
  }, [socket, createPeer, cleanup]);

  const rejectCall = useCallback(() => {
    const p = peerRef.current;
    if (p) socket.emit('call:reject', { to: p.id });
    cleanup();
  }, [socket, cleanup]);

  const hangup = useCallback(() => {
    const p = peerRef.current;
    if (p) socket.emit('call:hangup', { to: p.id });
    cleanup();
  }, [socket, cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  // --- Señalizacion entrante ---

  useEffect(() => {
    if (!socket) return;

    const onIncoming = ({ from, username }) => {
      // Ya estoy en algo: respondo "ocupado" (reject) sin molestar al usuario.
      if (statusRef.current !== 'idle') {
        socket.emit('call:reject', { to: from });
        return;
      }
      setError('');
      setPeerBoth({ id: from, username });
      setStatusBoth('incoming');
    };

    // El otro acepto: yo (quien llamo) creo la oferta.
    const onAccepted = async ({ from }) => {
      if (statusRef.current !== 'calling') return;
      try {
        const pc = await createPeer(from);
        setStatusBoth('connecting');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:signal', { to: from, data: { sdp: pc.localDescription } });
      } catch {
        setError('No se pudo acceder al microfono.');
        socket.emit('call:hangup', { to: from });
        cleanup();
      }
    };

    const onRejected = () => {
      if (statusRef.current === 'idle') return;
      setError('Llamada rechazada o el usuario esta ocupado.');
      cleanup();
    };

    const onSignal = async ({ data }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(data.sdp);
          await flushCandidates();
          // Si recibi una oferta (soy el que acepto), respondo con una answer.
          if (data.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('call:signal', {
              to: peerRef.current?.id,
              data: { sdp: pc.localDescription },
            });
          }
        } else if (data.candidate) {
          // Si todavia no hay remoteDescription, se encola.
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(data.candidate);
          } else {
            pendingRef.current.push(data.candidate);
          }
        }
      } catch {
        /* señal fuera de orden o invalida: se ignora */
      }
    };

    const onEnded = () => {
      if (statusRef.current === 'idle') return;
      cleanup();
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:signal', onSignal);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:signal', onSignal);
      socket.off('call:ended', onEnded);
    };
  }, [socket, createPeer, cleanup, flushCandidates]);

  // Al desmontar (salir del chat), cortar cualquier llamada viva.
  useEffect(() => cleanup, [cleanup]);

  // El mensaje de error (rechazo, corte, micro denegado) se autolimpia.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(id);
  }, [error]);

  return { status, peer, muted, error, startCall, acceptCall, rejectCall, hangup, toggleMute };
}
