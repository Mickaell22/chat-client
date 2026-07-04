// Nombre visible: el alias si el usuario lo eligio, si no el username.
export function displayName(user) {
  return user?.alias?.trim() || user?.username || '?';
}
