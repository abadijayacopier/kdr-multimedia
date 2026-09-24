const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

let win;

function getLocalIpv4() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const item of entries || []) {
      if (item && item.family === 'IPv4' && !item.internal) {
        return item.address;
      }
    }
  }
  return '127.0.0.1';
}

ipcMain.handle('get-srt-config', async (_event, port = 9000) => {
  const host = getLocalIpv4();
  const safePort = Number(port) || 9000;
  const payload = JSON.stringify({ type: 'kdr-srt', host, port: safePort, mode: 'listener' });
  const qrDataUrl = await QRCode.toDataURL(payload, { margin: 2, width: 260 });
  return { host, port: safePort, payload, qrDataUrl };
});

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
