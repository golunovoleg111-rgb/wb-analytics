const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('BJobDesktop', {
  getInfo: () => ipcRenderer.invoke('desktop-info'),
});
