let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

// Arquivos de áudio reais em public/alerts/. Cada evento novo só precisa
// de uma entrada aqui — cai pro beep sintetizado se o arquivo faltar/falhar.
const ALERT_FILES = {
  newOrder: "/alerts/novo_pedido.mp3",
  kitchenReady: "/alerts/saida_cozinha.mp3",
  lowStock: "/alerts/estoque_baixo.mp3",
} as const;

type AlertName = keyof typeof ALERT_FILES;

function playAlertFile(name: AlertName) {
  try {
    const audio = new Audio(ALERT_FILES[name]);
    audio.volume = 1;
    audio.play().catch(() => playNotificationSound());
  } catch {
    playNotificationSound();
  }
}

// Som de novo pedido (cardápio digital, mesa, comanda).
export function playNewOrderSound() {
  playAlertFile("newOrder");
}

// Som de pedido pronto na cozinha (saída para o salão/PDV).
export function playKitchenReadySound() {
  playAlertFile("kitchenReady");
}

// Som de alerta de estoque baixo.
export function playLowStockSound() {
  playAlertFile("lowStock");
}

// Beep sintetizado (dois tons curtos) — não depende de nenhum arquivo de áudio externo.
// Usado como fallback e para eventos que ainda não têm um som próprio.
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [880, 1180].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.14;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  } catch {
    // ambiente sem suporte a Web Audio — ignora silenciosamente
  }
}
