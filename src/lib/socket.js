import { io } from 'socket.io-client';

// URL del servidor de WebSocket. Normalmente la misma que la API. Build-time.
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000';

// Socket estable (singleton) en vez de crear uno nuevo por render. React
// StrictMode monta los effects dos veces en dev; con un socket nuevo cada vez
// el connect() async deja el primero huerfano (presencia inflada). Reusar el
// mismo objeto hace que la secuencia connect->disconnect->connect del
// StrictMode opere sobre una sola conexion. El JWT viaja en el handshake.
let socket = null;
let socketToken = null;

export function getSocket(token) {
  if (!socket || socketToken !== token) {
    if (socket) socket.disconnect();
    socket = io(SOCKET_URL, { auth: { token }, autoConnect: false });
    socketToken = token;
  }
  return socket;
}
