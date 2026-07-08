const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("printerConfig", {
  list: () => ipcRenderer.invoke("printer-config:list"),
  get: () => ipcRenderer.invoke("printer-config:get"),
  set: (config) => ipcRenderer.invoke("printer-config:set", config),
  test: () => ipcRenderer.invoke("printer-config:test"),
  close: () => ipcRenderer.invoke("printer-config:close"),
});
