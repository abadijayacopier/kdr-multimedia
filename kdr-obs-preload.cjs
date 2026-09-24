const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kdrObs', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  getSrtConfig: (port) => ipcRenderer.invoke('get-srt-config', port)
});
