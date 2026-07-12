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

// Anuncia um pedido pronto: "Senha número 27, retirar no balcão" — sempre pelo número
// da senha (não pelo nome do cliente), pra ficar fácil de identificar de longe.
export function announceOrderReady(numberOrTicket: number) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const text = `Senha número ${numberOrTicket}, retirar no balcão`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.88;   // Um pouco mais devagar para maior clareza
    utterance.pitch = 1.05;  // Ligeiramente mais agudo para soar mais natural
    utterance.volume = 1;

    const voice = pickVoice();
    if (voice) utterance.voice = voice;

    // Cancela qualquer fala anterior antes de falar (evita sobreposição)
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // navegador sem suporte a speech synthesis — ignora silenciosamente
  }
}
