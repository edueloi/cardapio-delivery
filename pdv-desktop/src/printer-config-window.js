// Janela nativa de configuração da impressora — aberta com F9. Existe fora do site porque,
// em modo kiosk, não há barra/menu pra chegar em Configurações do painel web, e a lista de
// impressoras instaladas só está disponível aqui no processo principal do Electron.
const { BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const printer = require("./printer");

let configWindow = null;

function openPrinterConfigWindow(parentWindow) {
  if (configWindow) {
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 480,
    height: 420,
    parent: parentWindow || undefined,
    modal: true,
    resizable: false,
    autoHideMenuBar: true,
    title: "Configurar Impressora",
    webPreferences: {
      preload: path.join(__dirname, "printer-config-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  configWindow.setMenu(null);
  configWindow.loadFile(path.join(__dirname, "printer-config.html"));

  configWindow.on("closed", () => {
    configWindow = null;
  });
}

// Handlers desta janela — separados dos handlers principais em main.js pra manter a
// lógica de config de impressora isolada num único lugar.
ipcMain.handle("printer-config:list", async () => {
  return printer.listPrinters(configWindow || BrowserWindow.getAllWindows()[0]);
});

ipcMain.handle("printer-config:get", () => printer.getPrinterConfig());

ipcMain.handle("printer-config:set", (_event, config) => {
  printer.setPrinterConfig(config);
  return { ok: true };
});

ipcMain.handle("printer-config:test", async () => {
  try {
    await printer.testPrint(configWindow);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || "Falha ao imprimir." };
  }
});

ipcMain.handle("printer-config:close", () => {
  configWindow?.close();
});

module.exports = { openPrinterConfigWindow };
