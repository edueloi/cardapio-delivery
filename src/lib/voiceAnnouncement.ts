// Locução por voz (Web Speech API) para o Painel de TV — chama o pedido em voz alta
// quando fica pronto. Não depende de nenhuma API paga.
//
// Ordem de preferência de vozes (pt-BR):
//   1. Vozes neurais Microsoft (Windows 10/11) — ex: "Microsoft Francisca"
//   2. Vozes Google Neural (Chrome) — ex: "Google português do Brasil"
//   3. Qualquer voz pt-BR disponível
//   4. Qualquer voz em português

let cachedVoice: SpeechSynthesisVoice | null | undefined;

/** Retorna o log das vozes disponíveis em pt-BR (útil para debug no console). */
export function listAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.startsWith("pt"));
}

// Escolhe uma voz específica pelo nome exato (salvo em DisplayPanelConfig.voiceName) —
// usada quando o admin escolheu manualmente uma voz em vez de deixar a seleção automática.
function pickVoiceByName(name: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  return window.speechSynthesis.getVoices().find((v) => v.name === name) ?? null;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  if (cachedVoice !== undefined) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();

  // 1. Vozes neurais Microsoft pt-BR (Windows 10/11 — alta qualidade)
  //    Exemplos: "Microsoft Francisca Online (Natural)", "Microsoft Thalita"
  const microsoftNeural = voices.find(
    (v) =>
      v.lang === "pt-BR" &&
      /microsoft/i.test(v.name) &&
      /(online|natural|neural)/i.test(v.name)
  );

  // 2. Qualquer voz Microsoft pt-BR (mesmo sem Natural)
  const microsoftAny = voices.find(
    (v) => v.lang === "pt-BR" && /microsoft/i.test(v.name)
  );

  // 3. Voz Google pt-BR (Chrome)
  const googleVoice = voices.find(
    (v) => v.lang === "pt-BR" && /google/i.test(v.name)
  );

  // 4. Qualquer voz pt-BR
  const anyPtBR = voices.find((v) => v.lang === "pt-BR");

  // 5. Qualquer voz em português
  const anyPt = voices.find((v) => v.lang.startsWith("pt"));

  cachedVoice =
    microsoftNeural ?? microsoftAny ?? googleVoice ?? anyPtBR ?? anyPt ?? null;

  if (cachedVoice) {
    console.log(`[VoiceAnnouncement] Voz selecionada: "${cachedVoice.name}" (${cachedVoice.lang})`);
  } else {
    console.warn("[VoiceAnnouncement] Nenhuma voz pt-BR encontrada. Vozes disponíveis:", voices.map((v) => `${v.name} (${v.lang})`));
  }

  return cachedVoice;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = undefined; // Reseta cache quando vozes são carregadas
  };
}

export const DEFAULT_VOICE_TEXT = "Senha número {numero}, {nome}, retirar no balcão";

// Anuncia um pedido pronto pelo número da senha e, quando disponível, pelo primeiro
// nome do cliente (ex: "Senha número 007, Felipe, retirar no balcão") — o dono pode
// incluir {nome} no texto customizado em Configurações > Config. Painel TV; se o texto
// não tiver {nome} ou o pedido não tiver nome cadastrado, nada muda (comportamento antigo).
export function announceOrderReady(numberOrTicket: number, opts?: { voiceName?: string | null; text?: string; customerName?: string | null }) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const firstName = (opts?.customerName || "").trim().split(/\s+/)[0] || "";
    let text = (opts?.text || DEFAULT_VOICE_TEXT).replace("{numero}", String(numberOrTicket));
    text = firstName ? text.replace("{nome}", firstName) : text.replace(/,?\s*\{nome\}/, "");

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.88;   // Um pouco mais devagar para maior clareza
    utterance.pitch = 1.05;  // Ligeiramente mais agudo para soar mais natural
    utterance.volume = 1;

    const voice = (opts?.voiceName && pickVoiceByName(opts.voiceName)) || pickVoice();
    if (voice) utterance.voice = voice;

    // Cancela qualquer fala anterior antes de falar (evita sobreposição)
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // navegador sem suporte a speech synthesis — ignora silenciosamente
  }
}
