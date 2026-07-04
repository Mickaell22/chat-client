import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/context.js";
import { friendsList } from "../lib/api.js";
import Avatar from "../components/Avatar.jsx";
import "../Friends.css"

export default function Friends() {
  const { user, token } = useAuth();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    async function loadFriends() {
      try {
        setLoading(true);
        const data = await friendsList({ token });
        setFriends(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadFriends();
  }, [token]);

  return (
    <div className="profile-page">
      <div className="profile-card">

        <Link to="/chat" className="profile-back">
          &larr; Volver al chat
        </Link>

        <h1>Amigos de {user?.username}</h1>
        <Avatar user={user} size={30} />

        <p>
          {user?.email}{" "}
          {user?.emailVerified ? (
            <span className="badge badge-ok">verificado</span>
          ) : (
            <span className="badge badge-warn">sin verificar</span>
          )}
        </p>

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}

        <Tabs friends={friends} loading={loading} />

      </div>
    </div>
  );
}

function Tabs({ friends, loading }) {
  return (
    <div className="tabs">
      <input type="radio" name="tabs" id="tab1" defaultChecked />
      <input type="radio" name="tabs" id="tab2" />
      <input type="radio" name="tabs" id="tab3" />

      <div className="tab-labels">
        <label htmlFor="tab1">Todos</label>
        <label htmlFor="tab2">Solicitudes</label>
        <label htmlFor="tab3">Añadir</label>
      </div>

      <div className="tab-content">

        <div className="panel p1">
          {loading ? (
            <p>Cargando...</p>
          ) : (
            friends.map((f) => (
              <div key={f.id} className="friend-item">
                <strong>{f.friend.username}</strong>
                <small>desde {f.since}</small>
              </div>
            ))
          )}
        </div>

        <div className="panel p2">
          <p>No hay solicitudes pendientes</p>
        </div>

        <div className="panel p3">
          <input placeholder="Buscar usuario..." />
          <button>Enviar solicitud</button>
        </div>

      </div>
    </div>
  );
}