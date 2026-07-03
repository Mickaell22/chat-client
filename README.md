<div align="center">

# chat-client

### Interfaz web de pub, un sistema de chat en tiempo real

Frontend de **pub**, un chat en tiempo real desarrollado como proyecto de
**Aplicaciones Distribuidas**. Construido con React y Vite, se conecta por
WebSockets al backend para enviar y recibir mensajes al instante.

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO--client-4-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2023-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Railway](https://img.shields.io/badge/Railway-Deploy-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)

</div>

---

## Tabla de contenido

<!-- - [Capturas](#capturas) -->
- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Ejecución](#ejecución)
- [Build de producción](#build-de-producción)
- [Despliegue en Railway](#despliegue-en-railway)
- [Backend](#backend)

---

<!--
## Capturas

> Reemplazá estas imágenes por tus capturas reales (colócalas en `docs/screenshots/`).

<div align="center">

| Inicio de sesión | Registro |
|:---:|:---:|
| ![Login](docs/screenshots/login.png) | ![Registro](docs/screenshots/registro.png) |

| Chat en tiempo real | Mensajes privados |
|:---:|:---:|
| ![Chat](docs/screenshots/chat.png) | ![DM](docs/screenshots/dm.png) |

</div>

---
-->

## Características

- Pantallas de **registro** e **inicio de sesión** (autenticación con JWT).
- **Verificación de correo** y **recuperación de contraseña** por email.
- **Perfil de usuario** con **foto de avatar** (subida a Cloudinary), alias
  editable, bio y color de perfil. Perfiles de otros usuarios visibles en un
  modal de solo lectura.
- **Estado de presencia** tipo Discord (conectado / no molestar / invisible).
- **Mensajería en tiempo real** mediante WebSockets (socket.io-client).
- **Lista de usuarios conectados** actualizada en vivo, con avatares.
- **Salas de chat múltiples**: crear, unirse y salir.
- **Mensajes privados** (DM) entre usuarios.
- Historial de mensajes al abrir una conversación.
- Rutas protegidas: sin sesión válida no se accede al chat.

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| UI | React 19 |
| Bundler / dev server | Vite 7 |
| Tiempo real | socket.io-client 4 |
| Ruteo | React Router |
| Lenguaje | JavaScript (ESM) |
| Tipografía | Fraunces (Google Fonts) + system-ui |

> La interfaz usa un tema oscuro neutro con design tokens (variables CSS) y la
> tipografía **Fraunces** cargada desde Google Fonts; si no hay red, cae a una
> serif del sistema (fallback), así que no es un requisito de build.

---

## Arquitectura

```
┌─────────────────┐   HTTP (login / registro · JWT)   ┌──────────────────────┐
│   chat-client   │ ────────────────────────────────► │     chat-server      │
│  (este repo)    │   WebSocket (Socket.IO · JWT)      │  (Express + Socket)  │
│                 │ ◄────────────────────────────────► │                      │
└─────────────────┘                                    └──────────────────────┘
```

El JWT recibido al iniciar sesión se envía en el header `Authorization: Bearer`
para las peticiones HTTP y en `auth: { token }` al abrir el socket.

---

## Estructura del proyecto

```
chat-client/
├── public/                  # Estáticos
├── src/
│   ├── main.jsx             # Punto de entrada (BrowserRouter + AuthProvider)
│   ├── App.jsx              # Rutas (/login, /register, /chat y /profile protegidas, email)
│   ├── index.css            # Estilos globales + design tokens (variables CSS)
│   ├── auth/
│   │   ├── context.js       # AuthContext + hook useAuth
│   │   ├── AuthContext.jsx  # AuthProvider (sesión JWT en localStorage)
│   │   └── ProtectedRoute.jsx
│   ├── pages/               # Login.jsx, Register.jsx, Chat.jsx
│   ├── components/          # PasswordInput.jsx (toggle ojo), Brand.jsx
│   └── lib/api.js           # Cliente fetch de la API de auth
├── docs/screenshots/        # Capturas para el README
├── .env.example
├── index.html
└── vite.config.js
```

---

## Requisitos previos

- **Node.js** >= 20 (probado en 22) y **npm**.
- El backend [**chat-server**](#backend) corriendo (local o en Railway).

---

## Instalación

```bash
git clone <url-del-repo>
cd chat-client
npm install
```

---

## Variables de entorno

Vite solo expone al cliente las variables con prefijo `VITE_`. Copiá el ejemplo:

```bash
cp .env.example .env
```

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_API_URL` | Base de la API HTTP de autenticación | `http://localhost:4000` |
| `VITE_SOCKET_URL` | URL del servidor WebSocket | `http://localhost:4000` |

> Son variables de **build-time**: al desplegar, hay que definirlas antes de buildear.

---

## Ejecución

```bash
npm run dev      # servidor de desarrollo en http://localhost:5173
```

---

## Build de producción

```bash
npm run build    # genera la carpeta dist/
npm run preview  # sirve el build localmente para probarlo
```

---

## Despliegue en Railway

Desplegado en el proyecto **chat-tiempo-real**, servicio **chat-client**
(linkeado al repo de GitHub: cada push a `main` dispara redeploy automático):

**https://chat-client-production-4b10.up.railway.app**

Pasos seguidos:

1. Servicio `chat-client` creado con `railway add --repo <owner>/chat-client`
   dentro del mismo proyecto Railway que el backend.
2. `VITE_API_URL` y `VITE_SOCKET_URL` seteadas con la URL de `chat-server`
   **antes** del build (son variables de build-time de Vite).
3. Railway detecta automáticamente que es una app estática de Vite (`npm run
   build` + sin script `start`) y sirve la carpeta `dist/` con Caddy — no hace
   falta configurar un servidor propio.
4. Dominio público generado con `railway domain`.

---

## Backend

El servidor que consume esta aplicación está en el repositorio
**[chat-server](#)** (Node.js + Express + Socket.IO + Prisma + PostgreSQL).

---

<div align="center">
Proyecto académico — Aplicaciones Distribuidas · Segundo parcial
</div>
