const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kdrObs', {
  getVersion: () => ipcRenderer.invoke('get-version')
});
