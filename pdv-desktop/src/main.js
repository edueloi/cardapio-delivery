const { app, BrowserWindow, ipcMain, Menu, globalShortcut, dialog } = require("electron");
const path = require("path");
const printer = require("./printer");
const { openPrinterConfigWindow } = require("./printer-config-window");

// Mesmo domínio do painel web — o app desktop é só uma janela nativa em cima do mesmo
// sistema, sem duplicar lógica de negócio. Login, PDV, tudo vem direto do servidor real.
const APP_URL = "https://www.boxsys.com.br/login";

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

// Atalhos globais — necessários porque em modo kiosk (sem barra/menu) não existe outra
// forma óbvia de acessar a configuração da impressora ou fechar o app.
function registerShortcuts() {
  globalShortcut.register("F9", () => {
    openPrinterConfigWindow(mainWindow);
  });

  globalShortcut.register("CommandOrControl+Shift+Q", async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Cancelar", "Fechar o App"],
      defaultId: 0,
      cancelId: 0,
      title: "Fechar Box Sys PDV",
      message: "Tem certeza que deseja fechar o aplicativo?",
    });
    if (response === 1) app.quit();
  });
}

app.whenReady().then(() => {
  createWindow();
  registerShortcuts();

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
