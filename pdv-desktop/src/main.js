const { app, BrowserWindow, ipcMain, Menu, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const Store = require("electron-store");
const printer = require("./printer");
const { openPrinterConfigWindow } = require("./printer-config-window");

// Placas de vídeo integradas antigas (Intel HD Graphics etc.) com driver desatualizado
// costumam ter bug conhecido de renderização de texto via GPU no Chromium/Electron —
// letras saem serrilhadas/pixeladas em vez de suavizadas. Precisa vir antes de
// app.whenReady(); desliga só a aceleração de GPU, sem afetar nada de lógica do app.
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-software-rasterizer");

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
  refreshAppMenu(); // atualiza o label "Zoom: N%" no menu Exibir
  return clamped;
}

let mainWindow = null;
let currentSlug = null; // tenant aberto agora — reportado pelo renderer via nav:report-slug

// Mesmos grupos/rotas do menu lateral do dashboard (ver
// src/features/dashboard/config/navigation.ts e src/features/dashboard/types.ts →
// TAB_TO_PATH) — duplicado aqui em JS puro porque o processo main não importa código
// React/TS. Se um item novo for adicionado lá, replicar aqui também.
const NAV_GROUPS = [
  {
    label: "Operação",
    items: [
      { label: "Visão Geral", path: "visao-geral" },
      { label: "PDV — Caixa", path: "pdv" },
      { label: "Garçom", path: "garcom" },
      { label: "Painel de Pedidos", path: "pedidos" },
      { label: "Config. Painel TV", path: "painel-de-pedidos" },
      { label: "Agendamentos", path: "agendamentos" },
      { label: "Mesas e QR Code", path: "mesas" },
      { label: "Histórico", path: "historico" },
    ],
  },
  {
    label: "Catálogo & Estoque",
    items: [
      { label: "Cardápio", path: "cardapio" },
      { label: "Estoque", path: "estoque" },
      { label: "Produção", path: "producao" },
      { label: "Fornecedores", path: "fornecedores" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { label: "Fluxo de Caixa", path: "financeiro" },
      { label: "Entradas e Saídas", path: "entradas-saidas" },
      { label: "Relatórios", path: "relatorios" },
      { label: "Notas Fiscais", path: "notas-fiscais" },
    ],
  },
  {
    label: "Clientes & Marketing",
    items: [
      { label: "Clientes — CRM", path: "clientes" },
      { label: "Fidelidade", path: "fidelidade" },
      { label: "Promoções", path: "promocoes" },
      { label: "Combos", path: "combos" },
      { label: "WhatsApp", path: "whatsapp" },
    ],
  },
  {
    label: "Administração",
    items: [
      { label: "Configurações", path: "configuracoes" },
      { label: "Equipe", path: "equipe" },
      { label: "Downloads", path: "downloads" },
      { label: "Manual e Ajuda", path: "manual" },
    ],
  },
];

function navigateTo(navPath) {
  if (!mainWindow) return;
  if (!currentSlug) {
    // Ainda não sabemos o tenant (ex: operador está na tela de login) — não há pra onde
    // navegar ainda, então só avisa em vez de montar uma URL quebrada.
    dialog.showMessageBox(mainWindow, {
      type: "info",
      message: "Faça login primeiro para navegar pelo menu.",
    });
    return;
  }
  mainWindow.webContents.send("nav:go-to", `/dashboard/${currentSlug}/${navPath}`);
}

function getHideSystemMenu() {
  return store.get("hideSystemMenu", false);
}

function setHideSystemMenu(value) {
  store.set("hideSystemMenu", value);
  if (mainWindow) mainWindow.webContents.send("nav:set-hide-system-menu", value);
  refreshAppMenu(); // atualiza o "check" do item no menu Exibir
}

// Barra de menu nativa (PDV / <categorias> / Exibir) — cada categoria do dashboard
// (Operação, Catálogo & Estoque, Financeiro, Clientes & Marketing, Administração) é seu
// próprio menu de topo, lado a lado com PDV e Exibir — não um item dentro de um menu
// "Navegar" só. Clicar num item manda o renderer trocar de rota (ver navigateTo acima e
// o listener nav:go-to no App.tsx) sem recarregar a página inteira. Os atalhos de
// teclado abaixo continuam funcionando em paralelo (F11 tela cheia, F9 impressora,
// Ctrl+R, Ctrl+Q, zoom).
function buildAppMenu() {
  const zoomPercent = Math.round(getZoomFactor() * 100);
  return Menu.buildFromTemplate([
    {
      label: "PDV",
      submenu: [
        { label: "Recarregar", accelerator: "CmdOrCtrl+R", click: () => mainWindow?.reload() },
        { label: "Sair", accelerator: "CmdOrCtrl+Q", click: () => confirmAndQuit() },
      ],
    },
    ...NAV_GROUPS.map((group) => ({
      label: group.label,
      submenu: group.items.map((item) => ({
        label: item.label,
        click: () => navigateTo(item.path),
      })),
    })),
    {
      label: "Exibir",
      submenu: [
        {
          label: "Tela Cheia",
          accelerator: "F11",
          type: "checkbox",
          checked: mainWindow?.isFullScreen() ?? false,
          click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()),
        },
        { type: "separator" },
        { label: `Zoom: ${zoomPercent}%`, enabled: false },
        { label: "Aumentar Zoom", accelerator: "CmdOrCtrl+=", click: () => setZoomFactor(getZoomFactor() + ZOOM_STEP) },
        { label: "Diminuir Zoom", accelerator: "CmdOrCtrl+-", click: () => setZoomFactor(getZoomFactor() - ZOOM_STEP) },
        { label: "Restaurar Zoom Padrão", accelerator: "CmdOrCtrl+0", click: () => setZoomFactor(1) },
        { type: "separator" },
        { label: "Configurar Impressora...", accelerator: "F9", click: () => openPrinterConfigWindow(mainWindow) },
        { type: "separator" },
        {
          label: "Esconder menu do sistema (lateral/topo)",
          type: "checkbox",
          checked: getHideSystemMenu(),
          // Controla a navegação do próprio site (sidebar ou barra de categorias do
          // dashboard) — não tem relação com esta barra de menu nativa do Windows, que
          // continua sempre visível. Útil quando o menu nativo já cobre a navegação e o
          // menu do site fica redundante, competindo por espaço em telas menores.
          click: (menuItem) => setHideSystemMenu(menuItem.checked),
        },
      ],
    },
  ]);
}

// Reconstrói o menu inteiro sempre que o zoom muda, só pra atualizar o label "Zoom: N%" —
// o Electron não tem binding reativo de label, então é preciso remontar o template.
function refreshAppMenu() {
  Menu.setApplicationMenu(buildAppMenu());
}

// Atalhos de teclado equivalentes às ações do menu Exibir — continuam funcionando mesmo
// com o menu nativo visível, pra quem já tinha o hábito de usar F11/F9/Ctrl+R direto.
function registerShortcuts(win) {
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const ctrlOrCmd = input.control || input.meta;

    if (input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === "F9") {
      openPrinterConfigWindow(win);
      event.preventDefault();
    } else if (ctrlOrCmd && input.key.toLowerCase() === "r") {
      win.reload();
      event.preventDefault();
    } else if (ctrlOrCmd && input.key.toLowerCase() === "q") {
      confirmAndQuit();
      event.preventDefault();
    } else if (ctrlOrCmd && (input.key === "=" || input.key === "+")) {
      setZoomFactor(getZoomFactor() + ZOOM_STEP);
      event.preventDefault();
    } else if (ctrlOrCmd && input.key === "-") {
      setZoomFactor(getZoomFactor() - ZOOM_STEP);
      event.preventDefault();
    } else if (ctrlOrCmd && input.key === "0") {
      setZoomFactor(1);
      event.preventDefault();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    backgroundColor: "#0A1628",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Sessão persistente própria — mantém o login salvo entre reinícios do app,
      // igual um navegador comum faria com localStorage/cookies.
      partition: "persist:boxsys-pdv",
    },
  });

  refreshAppMenu();
  registerShortcuts(mainWindow);

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.loadURL(APP_URL);

  // Reaplica o zoom e a preferência de esconder o menu do sistema a cada carregamento —
  // nenhum dos dois sobrevive a navegações (login → dashboard troca de URL/recarrega o
  // React do zero), então sem isso o ajuste do operador seria perdido no primeiro reload.
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.setZoomFactor(getZoomFactor());
    mainWindow.webContents.send("nav:set-hide-system-menu", getHideSystemMenu());
  });

  mainWindow.webContents.on("did-fail-load", (_event, _code, description) => {
    console.error("[main] Failed to load app:", description);
    setTimeout(() => mainWindow?.loadURL(APP_URL), 3000);
  });

  // Links externos (ex: WhatsApp, PDF em nova aba) abrem no navegador padrão do sistema,
  // não dentro do app — o app é só pro PDV em si. "Ver Cardápio" (/:slug, sem /dashboard/
  // ou /pdv/ no caminho) também vai pro navegador, mesmo sendo o mesmo domínio: é a
  // loja pública, sem link de volta pro painel — se abrisse numa 2ª janela do próprio
  // Electron, o operador podia achar que travou (mesmo bug que o "Ver Cardápio" causava
  // navegando na mesma janela, só que numa janela nova em vez da atual).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isBoxsysDomain = url.startsWith("https://www.boxsys.com.br") || url.startsWith("https://boxsys.com.br");
    const isPublicMenuPage = isBoxsysDomain && !/\/(dashboard|pdv|cozinha|superadmin|login)(\/|$)/.test(new URL(url).pathname);
    if (!isBoxsysDomain || isPublicMenuPage) {
      require("electron").shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
}

// Usada pelo item "Sair" do menu PDV — sempre com confirmação, pra ninguém fechar o
// PDV sem querer no meio de uma venda.
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

ipcMain.handle("app:request-quit", confirmAndQuit);

// Renderer avisa qual tenant (slug) está aberto — usado por navigateTo() pra montar a
// URL de destino quando o operador clica um item do menu "Navegar".
ipcMain.on("nav:report-slug", (_event, slug) => {
  currentSlug = slug || null;
});

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
  setupAutoUpdate();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
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
