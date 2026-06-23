const { app, BrowserWindow, Menu } = require('electron');
const { fork } = require('child_process');
const path = require('path');

let mainWindow;
let serverProcess;

function startServer() {
  console.log('[Electron] Starting backend server...');
  serverProcess = fork(path.join(__dirname, 'server/index.js'), [], {
    env: { 
      ...process.env, 
      PORT: '8080', 
      IS_ELECTRON: 'true'
    }
  });

  serverProcess.on('exit', (code) => {
    console.log(`[Electron] Server process exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    title: 'KDR Multimedia - Camera Mirroring',
    backgroundColor: '#08090c',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'public/icon.png')
  });

  // Hide the default electron menu bar for a cleaner native look
  Menu.setApplicationMenu(null);

  // Poll server until it responds, then load the URL
  function loadPage() {
    mainWindow.loadURL('http://localhost:8080').catch((err) => {
      console.log('[Electron] Server not ready yet, retrying...');
      setTimeout(loadPage, 200);
    });
  }

  loadPage();

  // Open developer tools in development mode
  if (!app.isPackaged || process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start server on app startup
app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Clean quit
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Ensure backend server is terminated when exiting
app.on('will-quit', () => {
  if (serverProcess) {
    console.log('[Electron] Stopping backend server...');
    serverProcess.kill('SIGINT');
  }
});
