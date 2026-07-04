// El status crudo puede venir como 'invisible' (uno mismo, via el propio
// socket) — para pintarlo se trata igual que 'offline' (nadie mas lo ve
// distinto de offline, ver getPresenceStatus en el backend).
export function asDotStatus(status) {
  return status === 'invisible' ? 'offline' : status;
}
