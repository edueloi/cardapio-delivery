const { app, BrowserWindow, ipcMain, Menu, session } = require("electron");
const path = require("path");
const printer = require("./printer");

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
    mainWindow.maximize();
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

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── Impressão térmica direta (ESC/POS) ──────────────────────────────────────
ipcMain.handle("printer:print-receipt", async (_event, data) => {
  try {
    await printer.printReceipt(data);
    return { ok: true };
  } catch (err) {
    console.error("[main] Print failed:", err);
    return { ok: false, error: err.message || "Falha ao imprimir." };
  }
});

ipcMain.handle("printer:test-print", async () => {
  try {
    await printer.testPrint();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Falha ao imprimir." };
  }
});

ipcMain.handle("printer:get-config", () => printer.getPrinterConfig());

ipcMain.handle("printer:set-config", (_event, config) => {
  printer.setPrinterConfig(config);
  return { ok: true };
});

ipcMain.handle("printer:list-serial-ports", () => printer.listSerialPorts());
