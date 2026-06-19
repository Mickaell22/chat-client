import { Navigate } from 'react-router-dom';
import { useAuth } from './context.js';

// Sin token no hay chat: redirige a login (invariante del proyecto).
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
