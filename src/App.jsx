import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/context.js';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Chat from './pages/Chat.jsx';

export default function App() {
  const { isAuthenticated } = useAuth();
  // La raiz manda a chat si hay sesion, o a login si no.
  const home = isAuthenticated ? '/chat' : '/login';

  return (
    <Routes>
      <Route path="/" element={<Navigate to={home} replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
