const { contextBridge, ipcRenderer } = require("electron");

// Expõe exatamente a API que o PDVPanel.tsx já espera em `window.pdvDesktop` —
// veja src/features/dashboard/PDVPanel.tsx: `(window as any).pdvDesktop?.printReceipt`.
// Nada além disso é exposto pro conteúdo web (contextIsolation ligado, sem nodeIntegration).
// A configuração da impressora em si não fica no site — é a janela nativa aberta pelo
// menu Exibir → Configurar Impressora / F9 (ver printer-config-window.js).
contextBridge.exposeInMainWorld("pdvDesktop", {
  isDesktopApp: true,

  // Avisa o processo main qual tenant (slug) está aberto agora — usado pra montar os
  // links do menu nativo (Operação, Catálogo & Estoque, Financeiro...) apontando pro
  // tenant certo. Chamado pelo App.tsx sempre que o slug na URL muda.
  reportCurrentSlug: (slug) => ipcRenderer.send("nav:report-slug", slug),

  // Recebe do processo main qual rota navegar quando o operador clica um item do menu
  // nativo — o próprio App.tsx decide como navegar (React Router), sem recarregar a
  // página inteira nem perder o estado da sessão/socket.
  onNavigate: (callback) => {
    const handler = (_event, path) => callback(path);
    ipcRenderer.on("nav:go-to", handler);
    return () => ipcRenderer.removeListener("nav:go-to", handler);
  },

  // Recebe do processo main a preferência (persistida via electron-store) de esconder
  // a navegação do próprio site (sidebar ou barra de categorias) — controlada pelo item
  // "Esconder menu do sistema" em Exibir, no menu nativo. Chamado no carregamento
  // inicial e sempre que o operador alterna o checkbox.
  onSetHideSystemMenu: (callback) => {
    const handler = (_event, hidden) => callback(hidden);
    ipcRenderer.on("nav:set-hide-system-menu", handler);
    return () => ipcRenderer.removeListener("nav:set-hide-system-menu", handler);
  },

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
