const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    title: 'KDR OBS Controller',
    backgroundColor: '#08090c',
    webPreferences: { preload: path.join(__dirname, 'kdr-obs-preload.cjs'), contextIsolation: true, nodeIntegration: false },
    icon: path.join(__dirname, 'public/icon.png')
  });
  win.loadFile(path.join(__dirname, 'kdr-obs-controller.html'));
  if (!app.isPackaged) win.webContents.openDevTools();
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
