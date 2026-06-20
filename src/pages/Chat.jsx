import { useAuth } from '../auth/context.js';

// Placeholder de la pantalla de chat. Por ahora solo confirma que la sesion
// quedo activa; la UI real (salas, DM, online) llega en la fase de chat.
export default function Chat() {
  const { user, signOut } = useAuth();

  return (
    <div className="chat-placeholder">
      <header className="chat-header">
        <span>
          Conectado como <strong>{user?.username}</strong>
        </span>
        <button type="button" onClick={signOut}>
          Cerrar sesion
        </button>
      </header>
      <main>
        {user && user.emailVerified === false && (
          <p className="verify-banner" role="status">
            Tu correo aun no esta verificado. Revisa tu bandeja y abre el enlace
            que te enviamos.
          </p>
        )}
        <p>Sesion iniciada. La pantalla de chat se construye en la siguiente fase.</p>
      </main>
    </div>
  );
}
