const { contextBridge, ipcRenderer } = require("electron");

// Expõe exatamente a API que o PDVPanel.tsx já espera em `window.pdvDesktop` —
// veja src/features/dashboard/PDVPanel.tsx: `(window as any).pdvDesktop?.printReceipt`.
// Nada além disso é exposto pro conteúdo web (contextIsolation ligado, sem nodeIntegration).
contextBridge.exposeInMainWorld("pdvDesktop", {
  isDesktopApp: true,

  printReceipt: async (data) => {
    const result = await ipcRenderer.invoke("printer:print-receipt", data);
    if (!result.ok) {
      // O PDV não tem tratamento de erro pra essa chamada (é fire-and-forget hoje),
      // então avisamos o operador diretamente aqui em vez de falhar silenciosamente.
      window.alert(result.error || "Falha ao imprimir o recibo. Verifique a impressora.");
    }
    return result;
  },

  printer: {
    testPrint: () => ipcRenderer.invoke("printer:test-print"),
    getConfig: () => ipcRenderer.invoke("printer:get-config"),
    setConfig: (config) => ipcRenderer.invoke("printer:set-config", config),
    listSerialPorts: () => ipcRenderer.invoke("printer:list-serial-ports"),
  },
});
