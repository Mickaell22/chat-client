// Avatar reutilizable: muestra la foto del usuario si tiene avatarUrl, o un
// circulo con su inicial y un color derivado del nombre (estable por usuario).

// Hash simple del username -> hue (0-360). Mismo nombre, mismo color siempre.
function hueFromName(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export default function Avatar({ user, size = 40 }) {
  const username = user?.username ?? '?';
  const style = { width: size, height: size, fontSize: size * 0.42 };

  if (user?.avatarUrl) {
    return (
      <img
        className="avatar"
        src={user.avatarUrl}
        alt={username}
        style={style}
        width={size}
        height={size}
      />
    );
  }

  const hue = hueFromName(username);
  return (
    <span
      className="avatar avatar-initials"
      style={{ ...style, background: `hsl(${hue} 55% 45%)` }}
      aria-hidden="true"
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}
