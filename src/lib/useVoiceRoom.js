import { useCallback, useEffect, useRef, useState } from 'react';

// Canal de voz grupal de una sala, en mesh P2P: una RTCPeerConnection por
// cada otro participante. El que ENTRA crea la oferta hacia cada miembro
// existente (el server manda la lista en el ack de voice:join); los que ya
// estaban solo responden. El server unicamente presenta y relaya señales.
//
// ponytail: mesh sin SFU, tope de participantes en el server
// (MAX_VOICE_PEERS); cada punta sube su audio N-1 veces. Upgrade para salas
// grandes: un SFU (mediasoup/LiveKit).
const ICE_CONFIG = {
  iceServers: import.meta.env.VITE_STUN_URL
    ? [{ urls: import.meta.env.VITE_STUN_URL }]
    : [],
};

export function useVoiceRoom(socket) {
  // Sala cuyo canal de voz tengo abierto (null = ninguno).
  const [joinedRoomId, setJoinedRoomId] = useState(null);
  // Miembros en voz por sala (llega a TODOS los miembros de la sala, esten o
  // no en voz: sirve para el contador del boton).
  const [membersByRoom, setMembersByRoom] = useState({});
  // Estado de conexion WebRTC por par (para pintar quien ya se escucha).
  const [peerStates, setPeerStates] = useState({});
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');

  const pcsRef = useRef(new Map()); // userId -> RTCPeerConnection
  const audiosRef = useRef(new Map()); // userId -> HTMLAudioElement
  const pendingRef = useRef(new Map()); // userId -> ICE candidates en cola
  const streamRef = useRef(null);
  const joinedRef = useRef(null);

  const closePeer = useCallback((userId) => {
    const pc = pcsRef.current.get(userId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    pcsRef.current.delete(userId);
    const audio = audiosRef.current.get(userId);
    if (audio) audio.srcObject = null;
    audiosRef.current.delete(userId);
    pendingRef.current.delete(userId);
    setPeerStates((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  const leave = useCallback(() => {
    if (!joinedRef.current) return;
    socket?.emit('voice:leave');
    for (const id of [...pcsRef.current.keys()]) closePeer(id);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    joinedRef.current = null;
    setJoinedRoomId(null);
    setMuted(false);
  }, [socket, closePeer]);

  const createPeer = useCallback(
    (peerId, roomId) => {
      const pc = new RTCPeerConnection(ICE_CONFIG);
      pcsRef.current.set(peerId, pc);
      streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current));
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('voice:signal', { roomId, to: peerId, data: { candidate: e.candidate } });
        }
      };
      pc.ontrack = (e) => {
        let audio = audiosRef.current.get(peerId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audiosRef.current.set(peerId, audio);
        }
        audio.srcObject = e.streams[0];
        audio.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        setPeerStates((prev) => ({ ...prev, [peerId]: pc.connectionState }));
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeer(peerId);
        }
      };
      return pc;
    },
    [socket, closePeer],
  );

  const join = useCallback(
    async (roomId) => {
      if (joinedRef.current || !roomId) return;
      setError('');
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setError('No se pudo acceder al microfono.');
        return;
      }
      socket?.emit('voice:join', { roomId }, async (res) => {
        if (res?.error) {
          setError(res.error);
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          return;
        }
        joinedRef.current = roomId;
        setJoinedRoomId(roomId);
        // El nuevo inicia: una oferta hacia cada miembro que ya estaba.
        for (const m of res?.members ?? []) {
          const pc = createPeer(m.id, roomId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('voice:signal', { roomId, to: m.id, data: { sdp: pc.localDescription } });
        }
      });
    },
    [socket, createPeer],
  );

  const toggleMute = useCallback(() => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onMembers = ({ roomId, members }) =>
      setMembersByRoom((prev) => ({ ...prev, [roomId]: members }));

    const onPeerLeft = ({ userId }) => closePeer(userId);

    const onSignal = async ({ roomId, from, data }) => {
      if (joinedRef.current !== roomId) return;
      let pc = pcsRef.current.get(from);
      try {
        if (data.sdp) {
          // Una oferta de alguien nuevo crea su conexion en este lado.
          if (!pc && data.sdp.type === 'offer') pc = createPeer(from, roomId);
          if (!pc) return;
          await pc.setRemoteDescription(data.sdp);
          const queued = pendingRef.current.get(from) ?? [];
          pendingRef.current.delete(from);
          for (const c of queued) {
            try {
              await pc.addIceCandidate(c);
            } catch {
              /* candidato invalido: se ignora */
            }
          }
          if (data.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice:signal', { roomId, to: from, data: { sdp: pc.localDescription } });
          }
        } else if (data.candidate) {
          if (pc && pc.remoteDescription?.type) await pc.addIceCandidate(data.candidate);
          else {
            if (!pendingRef.current.has(from)) pendingRef.current.set(from, []);
            pendingRef.current.get(from).push(data.candidate);
          }
        }
      } catch {
        /* señal fuera de orden o invalida: se ignora */
      }
    };

    socket.on('voice:members', onMembers);
    socket.on('voice:peer-left', onPeerLeft);
    socket.on('voice:signal', onSignal);
    return () => {
      socket.off('voice:members', onMembers);
      socket.off('voice:peer-left', onPeerLeft);
      socket.off('voice:signal', onSignal);
    };
  }, [socket, createPeer, closePeer]);

  // Salir del canal al desmontar (cerrar sesion, salir del chat).
  useEffect(() => leave, [leave]);

  // Los errores (canal lleno, mic denegado) se autolimpian.
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(id);
  }, [error]);

  return { joinedRoomId, membersByRoom, peerStates, muted, error, join, leave, toggleMute };
}
