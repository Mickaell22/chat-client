import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import App from './App.jsx';
import './index.css';

// Tema elegido por el usuario (toggle en el chat), aplicado antes del primer
// render para que login/registro no parpadeen en oscuro.
document.documentElement.dataset.theme = localStorage.getItem('pub.theme') || 'dark';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
