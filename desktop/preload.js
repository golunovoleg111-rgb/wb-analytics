const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('BJobDesktop', {
  getInfo: () => ipcRenderer.invoke('desktop-info'),
  exportJson: (snapshot) => ipcRenderer.invoke('desktop-export-json', snapshot),
  importJson: () => ipcRenderer.invoke('desktop-import-json'),
  lanStart: () => ipcRenderer.invoke('lan-start'),
  lanStop: () => ipcRenderer.invoke('lan-stop'),
  lanStatus: () => ipcRenderer.invoke('lan-status'),
  lanPush: (payload) => ipcRenderer.invoke('lan-push', payload),
  lanPull: (payload) => ipcRenderer.invoke('lan-pull', payload),
  syncStatus: () => ipcRenderer.invoke('sync-status'),
  exportSyncJournal: () => ipcRenderer.invoke('sync-export'),
});
