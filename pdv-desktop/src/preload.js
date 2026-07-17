const { contextBridge, ipcRenderer } = require("electron");

// Expõe exatamente a API que o PDVPanel.tsx já espera em `window.pdvDesktop` —
// veja src/features/dashboard/PDVPanel.tsx: `(window as any).pdvDesktop?.printReceipt`.
// Nada além disso é exposto pro conteúdo web (contextIsolation ligado, sem nodeIntegration).
// A configuração da impressora em si não fica no site — é a janela nativa aberta pelo
// menu Exibir → Configurar Impressora / F9 (ver printer-config-window.js).
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

// Fechar o app, ajustar zoom, recarregar e configurar a impressora ficam na barra de
// menu nativa (PDV / Exibir, ver main.js → buildAppMenu) — a janela agora é uma janela
// normal do Windows, com essa barra sempre visível no topo.
