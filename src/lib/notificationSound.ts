let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

// Chrome/Edge bloqueiam áudio (e speechSynthesis) em qualquer aba que nunca recebeu um
// gesto do usuário (clique/toque) — comum no Painel de TV, que fica numa aba/tela aberta
// sem ninguém interagir. Chame isso dentro de um handler de clique/toque real pra "destravar"
// o AudioContext pro resto da sessão daquela aba.
export function primeAudioContext() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}

// Arquivos de áudio reais em public/alerts/. Cada evento novo só precisa
// de uma entrada aqui — cai pro beep sintetizado se o arquivo faltar/falhar.
const ALERT_FILES = {
  newOrder: "/alerts/novo_pedido.mp3",
  kitchenReady: "/alerts/som_campainha.mp3",
  tvPanelReady: "/alerts/som_painel_cozinha.mp3",
  lowStock: "/alerts/estoque_baixo.mp3",
  orderDelayed: "/alerts/error_atraso.mp3",
} as const;

type AlertName = keyof typeof ALERT_FILES;

// Todos os sons disponíveis no sistema, pro admin escolher qual toca quando a senha é
// chamada no Painel de Pedidos (Configurações > Config. Painel TV). Rótulos amigáveis
// pra exibir num dropdown com botão de "ouvir" antes de salvar.
export const READY_SOUND_OPTIONS: { file: string; label: string }[] = [
  { file: "/alerts/som_painel_cozinha.mp3", label: "Painel da Cozinha (padrão)" },
  { file: "/alerts/som_campainha.mp3", label: "Campainha" },
  { file: "/alerts/novo_pedido.mp3", label: "Novo Pedido" },
  { file: "/alerts/saida_cozinha.mp3", label: "Saída da Cozinha" },
  { file: "/alerts/estoque_baixo.mp3", label: "Estoque Baixo" },
];

function playAlertFile(name: AlertName) {
  try {
    const audio = new Audio(ALERT_FILES[name]);
    audio.volume = 1;
    audio.play().catch(() => playNotificationSound());
  } catch {
    playNotificationSound();
  }
}

// Toca um som pelo caminho do arquivo (ex: um dos valores em READY_SOUND_OPTIONS) — usado
// tanto no preview do painel de configurações quanto na chamada de senha real, que agora
// usa o arquivo escolhido pelo admin em vez de um som fixo.
export function playSoundFile(path: string) {
  try {
    const audio = new Audio(path);
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

// Som de pedido pronto na cozinha (saída para o salão/PDV) — usado no dashboard.
export function playKitchenReadySound() {
  playAlertFile("kitchenReady");
}

// Som de pedido pronto no Painel de TV (/:slug/display) — som próprio, diferente
// do usado no dashboard administrativo. Aceita um arquivo customizado (escolhido pelo
// admin em Configurações > Config. Painel TV); sem isso, usa o som padrão de sempre.
export function playTvPanelReadySound(customFile?: string) {
  if (customFile) {
    playSoundFile(customFile);
  } else {
    playAlertFile("tvPanelReady");
  }
}

// Som de alerta de estoque baixo.
export function playLowStockSound() {
  playAlertFile("lowStock");
}

// Som de pedido atrasado — em preparo há mais de 30min, ou pronto sem retirada há
// um tempo (Painel de Pedidos).
export function playOrderDelayedSound() {
  playAlertFile("orderDelayed");
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
