const { app, BrowserWindow, ipcMain, Menu, globalShortcut, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const Store = require("electron-store");
const printer = require("./printer");
const { openPrinterConfigWindow } = require("./printer-config-window");

// Mesmo domínio do painel web — o app desktop é só uma janela nativa em cima do mesmo
// sistema, sem duplicar lógica de negócio. Login, PDV, tudo vem direto do servidor real.
const APP_URL = "https://www.boxsys.com.br/login";

const store = new Store();
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;

function getZoomFactor() {
  return store.get("zoomFactor", 1);
}

function setZoomFactor(factor) {
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(factor * 100) / 100));
  store.set("zoomFactor", clamped);
  if (mainWindow) mainWindow.webContents.setZoomFactor(clamped);
  return clamped;
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    // Modo caixa/totem: ocupa a tela inteira, sem barra de título nem bordas do Windows.
    // F9 abre a configuração da impressora, Ctrl+Shift+Q fecha o app (ver registerShortcuts).
    frame: false,
    kiosk: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Sessão persistente própria — mantém o login salvo entre reinícios do app,
      // igual um navegador comum faria com localStorage/cookies.
      partition: "persist:boxsys-pdv",
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.loadURL(APP_URL);

  // Reaplica o zoom salvo a cada carregamento — o zoomFactor de um webContents não
  // sobrevive a navegações (login → PDV troca de URL), então sem isso o ajuste do
  // operador seria perdido no primeiro reload.
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.setZoomFactor(getZoomFactor());
  });

  mainWindow.webContents.on("did-fail-load", (_event, _code, description) => {
    console.error("[main] Failed to load app:", description);
    setTimeout(() => mainWindow?.loadURL(APP_URL), 3000);
  });

  // Links externos (ex: WhatsApp, PDF em nova aba) abrem no navegador padrão do sistema,
  // não dentro do app — o app é só pro PDV em si.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith("https://www.boxsys.com.br") && !url.startsWith("https://boxsys.com.br")) {
      require("electron").shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
}

// Usada tanto pelo atalho Ctrl+Shift+Q quanto pelo botão flutuante injetado no preload —
// mesmo fluxo de confirmação nos dois casos, pra ninguém fechar o PDV sem querer.
async function confirmAndQuit() {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Cancelar", "Fechar o App"],
    defaultId: 0,
    cancelId: 0,
    title: "Fechar Box Sys PDV",
    message: "Tem certeza que deseja fechar o aplicativo?",
  });
  if (response === 1) app.quit();
}

// Atalhos globais — necessários porque em modo kiosk (sem barra/menu) não existe outra
// forma óbvia de acessar a configuração da impressora ou fechar o app.
function registerShortcuts() {
  globalShortcut.register("F9", () => {
    openPrinterConfigWindow(mainWindow);
  });

  globalShortcut.register("CommandOrControl+Shift+Q", confirmAndQuit);
}

ipcMain.handle("app:request-quit", confirmAndQuit);

// Auto-update: checa no servidor (public/downloads/pdv-updates/ no VPS) se existe uma
// versão nova, baixa em segundo plano e instala no próximo fechamento do app — assim uma
// mudança no app desktop (impressora, janela, atalhos) chega em todo mundo sem precisar
// reinstalar manualmente, igual o PDV em si já atualiza sozinho por rodar do site.
function setupAutoUpdate() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (err) => {
    console.error("[updater] Error:", err);
  });

  autoUpdater.on("update-downloaded", () => {
    // Instala na próxima vez que o app fechar — não interrompe o operador no meio de uma
    // venda. O PDV roda o dia todo, então na prática atualiza na virada do turno/reinício.
    console.log("[updater] Update downloaded, will install on next quit.");
  });

  autoUpdater.checkForUpdates().catch((err) => console.error("[updater] Check failed:", err));
  // Reverifica periodicamente, já que o app fica aberto o dia inteiro num PDV.
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => console.error("[updater] Check failed:", err));
  }, 4 * 60 * 60 * 1000);
}

app.whenReady().then(() => {
  createWindow();
  registerShortcuts();
  setupAutoUpdate();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── Impressão térmica direta (ESC/POS) ──────────────────────────────────────
// Chamada pelo preload.js quando o PDV (site) pede pra imprimir o recibo. A configuração
// da impressora em si (F9) tem seus próprios handlers em printer-config-window.js.
ipcMain.handle("printer:print-receipt", async (_event, data) => {
  try {
    await printer.printReceipt(data, mainWindow);
    return { ok: true };
  } catch (err) {
    console.error("[main] Print failed:", err);
    return { ok: false, error: err.message || "Falha ao imprimir." };
  }
});

ipcMain.handle("printer:print-cash-closing", async (_event, { tenantName, summary }) => {
  try {
    await printer.printCashClosingReport(tenantName, summary);
    return { ok: true };
  } catch (err) {
    console.error("[main] Cash closing print failed:", err);
    return { ok: false, error: err.message || "Falha ao imprimir o fechamento." };
  }
});

ipcMain.handle("zoom:get", () => getZoomFactor());

ipcMain.handle("zoom:set", (_event, direction) => {
  const current = getZoomFactor();
  if (direction === "in") return setZoomFactor(current + ZOOM_STEP);
  if (direction === "out") return setZoomFactor(current - ZOOM_STEP);
  return setZoomFactor(1);
});

ipcMain.handle("printer:print-danfe", async (_event, data) => {
  try {
    await printer.printDanfe(data);
    return { ok: true };
  } catch (err) {
    console.error("[main] DANFE print failed:", err);
    return { ok: false, error: err.message || "Falha ao imprimir o DANFE." };
  }
});
