// Locução por voz (Web Speech API) para o Painel de TV — chama o pedido em voz alta
// quando fica pronto. Não depende de nenhuma API paga.

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  if (cachedVoice !== undefined) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();
  cachedVoice =
    voices.find((v) => v.lang === "pt-BR" && /female|mulher|maria|luciana|francisca/i.test(v.name)) ||
    voices.find((v) => v.lang === "pt-BR") ||
    voices.find((v) => v.lang.startsWith("pt")) ||
    null;
  return cachedVoice;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = undefined;
  };
}

// Anuncia um pedido pronto: "Pedido João" (com nome) ou "Pedido 27" (sem nome).
export function announceOrderReady(numberOrTicket: number, customerName?: string | null) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const text = customerName?.trim()
      ? `Pedido ${customerName.trim()}`
      : `Pedido ${numberOrTicket}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  } catch {
    // navegador sem suporte a speech synthesis — ignora silenciosamente
  }
}
