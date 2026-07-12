// Notificaciones de DM: aviso del navegador + beep corto.
// ponytail: el sonido es un beep de dos tonos generado con WebAudio (cero
// assets); el aviso usa la Notification API nativa. Sin service worker: solo
// notifica mientras la pestaña este abierta (aunque este en segundo plano).

// Pide el permiso de notificaciones (debe llamarse desde un gesto del
// usuario, p.ej. el click del toggle). Devuelve true si quedo concedido.
export async function ensureNotifyPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

// Muestra el aviso nativo. El click enfoca la pestaña y avisa al caller
// (para abrir la conversacion).
export function showNotification({ title, body, icon, onClick }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, icon: icon ?? undefined, tag: 'pub-dm' });
  n.onclick = () => {
    window.focus();
    onClick?.();
    n.close();
  };
}

// Beep corto de dos tonos (~0.25s), volumen bajo.
let audioCtx = null;
export function beep() {
  try {
    audioCtx = audioCtx ?? new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const gain = ctx.createGain();
    gain.gain.value = 0.06;
    gain.connect(ctx.destination);
    for (const [freq, at] of [[880, 0], [1174.66, 0.12]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.12);
    }
  } catch {
    /* sin audio disponible: se ignora */
  }
}
