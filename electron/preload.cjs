const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("myrcon", {
  onUpdateAvailable: (callback) => subscribe("update:available", callback),
  onUpdateDownloadProgress: (callback) => subscribe("update:download-progress", callback),
  onUpdateDownloaded: (callback) => subscribe("update:downloaded", callback),
  onUpdateError: (callback) => subscribe("update:error", callback),
  installUpdate: () => ipcRenderer.send("update:install"),
  skipUpdate: (version) => ipcRenderer.send("update:skip", version),
});
