const { contextBridge, ipcRenderer } = require("electron");

// Expõe exatamente a API que o PDVPanel.tsx já espera em `window.pdvDesktop` —
// veja src/features/dashboard/PDVPanel.tsx: `(window as any).pdvDesktop?.printReceipt`.
// Nada além disso é exposto pro conteúdo web (contextIsolation ligado, sem nodeIntegration).
// A configuração da impressora em si não fica no site — é a janela nativa aberta com F9
// (ver printer-config-window.js), já que em modo kiosk não há como navegar até
// Configurações do painel pra chegar lá.
contextBridge.exposeInMainWorld("pdvDesktop", {
  isDesktopApp: true,

  printReceipt: async (data) => {
    const result = await ipcRenderer.invoke("printer:print-receipt", data);
    if (!result.ok) {
      // O PDV não tem tratamento de erro pra essa chamada (é fire-and-forget hoje),
      // então avisamos o operador diretamente aqui em vez de falhar silenciosamente.
      window.alert((result.error || "Falha ao imprimir o recibo.") + "\n\nAperte F9 para configurar a impressora.");
    }
    return result;
  },

  printCashClosingReport: async (tenantName, summary) => {
    const result = await ipcRenderer.invoke("printer:print-cash-closing", { tenantName, summary });
    if (!result.ok) {
      window.alert((result.error || "Falha ao imprimir o fechamento de caixa.") + "\n\nAperte F9 para configurar a impressora.");
    }
    return result;
  },

  printDanfe: async (data) => {
    const result = await ipcRenderer.invoke("printer:print-danfe", data);
    if (!result.ok) {
      window.alert((result.error || "Falha ao imprimir o DANFE.") + "\n\nAperte F9 para configurar a impressora.");
    }
    return result;
  },
});

// Botão flutuante pra sair do app — em modo kiosk (frame: false) não existe barra de
// título nem X do Windows, então sem isso o único jeito de fechar seria saber de cor o
// atalho Ctrl+Shift+Q. Injetado direto no DOM da página carregada (site real), não faz
// parte do código do painel web.
window.addEventListener("DOMContentLoaded", () => {
  const btn = document.createElement("button");
  btn.textContent = "✕";
  btn.title = "Fechar o app (Ctrl+Shift+Q)";
  Object.assign(btn.style, {
    position: "fixed",
    top: "8px",
    right: "8px",
    zIndex: "2147483647",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.35)",
    color: "#fff",
    fontSize: "14px",
    lineHeight: "28px",
    textAlign: "center",
    cursor: "pointer",
    fontFamily: "sans-serif",
    opacity: "0.55",
    transition: "opacity 0.15s",
  });
  btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
  btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.55"; });
  btn.addEventListener("click", () => ipcRenderer.invoke("app:request-quit"));
  document.body.appendChild(btn);
});
