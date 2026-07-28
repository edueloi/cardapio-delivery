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

// Sem barra de menu nativa — fechar o app, ajustar zoom, recarregar, tela cheia e
// configurar a impressora agora são só atalhos de teclado (ver main.js →
// registerShortcuts). A faixa de 36px reservada pelos botões nativos de
// minimizar/maximizar/fechar (titleBarOverlay) é a única coisa que o app web precisa
// deixar livre no topo — ver isDesktopApp acima, usado por DashboardShell.tsx.
