import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn, exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically copy the generated PWA PNG icon on server startup
try {
  const sourcePath = 'C:\\Users\\AJ\\.gemini\\antigravity\\brain\\e9dfce05-883f-4896-a8ad-89f90823d798\\kdr_multimedia_logo_1782195267874.png';
  const destPath = path.join(__dirname, '../public/icon.png');
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath);
    console.log('[*] Successfully copied PWA icon to public/icon.png');
  }
} catch (err) {
  console.error('[!] Failed to copy PWA icon on startup:', err);
}

const app = express();
const port = process.env.PORT || 8080;

// Enable CORS for frontend development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Serve production client build files if they exist
app.use(express.static(path.join(__dirname, '../dist')));

// Helper to get local IP address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

let activeTunnelUrl = null;

// Endpoint to get connection details for QR Code
app.get('/api/info', (req, res) => {
  const localIp = getLocalIpAddress();
  res.json({
    localIp,
    wsPort: port,
    clientPort: 3000,
    wsUrl: activeTunnelUrl 
      ? activeTunnelUrl.replace('https://', 'wss://') 
      : `ws://${localIp}:${port}`,
    httpUrl: activeTunnelUrl 
      ? activeTunnelUrl 
      : `http://${localIp}:3000`,
    activeTunnelUrl: activeTunnelUrl
  });
});

// Handle wildcard routing for client
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // In development mode, automatically redirect to Vite dev server (port 3000)
    const clientPort = 3000;
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Redirecting to Dev Server...</title>
        <style>
          body { 
            background: #08090c; 
            color: #8f9cae; 
            font-family: 'Outfit', sans-serif; 
            display: flex; 
            height: 100vh; 
            align-items: center; 
            justify-content: center; 
            margin: 0; 
            text-align: center;
          }
          h2 { color: #00f2fe; margin-bottom: 8px; }
          a { color: #4facfe; text-decoration: none; font-weight: 500; }
        </style>
      </head>
      <body>
        <div>
          <h2>Antigravity Mirror</h2>
          <p>Redirecting to client development server on port ${clientPort}...</p>
          <p><a id="redir-link" href="#">Klik di sini jika Anda tidak dialihkan otomatis</a></p>
        </div>
        <script>
          const currentUrl = new URL(window.location.href);
          currentUrl.port = "${clientPort}";
          document.getElementById('redir-link').href = currentUrl.href;
          window.location.replace(currentUrl.href);
        </script>
      </body>
      </html>
    `);
  }
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

// Rooms state: { [roomId]: { receiver: ws, sender: ws } }
const rooms = new Map();

wss.on('connection', (ws) => {
  let currentRoomId = null;
  let clientType = null; // 'receiver' (PC) or 'sender' (HP)

  ws.on('message', (messageText) => {
    try {
      const message = JSON.parse(messageText);
      const { type, roomId, data } = message;

      switch (type) {
        case 'join':
          currentRoomId = roomId;
          clientType = data.clientType; // 'receiver' or 'sender'
          
          if (!rooms.has(roomId)) {
            rooms.set(roomId, { receiver: null, sender: null });
          }
          
          const room = rooms.get(roomId);
          room[clientType] = ws;

          console.log(`[Room ${roomId}] ${clientType} connected.`);

          // Notify each other if both are present in the room
          if (room.receiver && room.sender) {
            // Notify receiver that sender is online
            room.receiver.send(JSON.stringify({ type: 'sender-joined' }));
            // Notify sender that receiver is online
            room.sender.send(JSON.stringify({ type: 'receiver-online' }));
          }
          break;

        case 'offer':
        case 'answer':
        case 'candidate':
        case 'control':
          // Relay message to the other peer in the room
          if (currentRoomId && rooms.has(currentRoomId)) {
            const targetType = clientType === 'receiver' ? 'sender' : 'receiver';
            const targetWs = rooms.get(currentRoomId)[targetType];
            
            if (targetWs && targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(JSON.stringify({ type, data }));
            }
          }
          break;
          
        default:
          console.log('Unknown message type:', type);
      }
    } catch (err) {
      console.error('Error handling WS message:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      
      if (room[clientType] === ws) {
        room[clientType] = null;
        console.log(`[Room ${currentRoomId}] ${clientType} disconnected.`);
        
        // Notify other client about disconnection
        const targetType = clientType === 'receiver' ? 'sender' : 'receiver';
        const targetWs = room[targetType];
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({ type: `${clientType}-disconnected` }));
        }
      }

      // Clean up empty room
      if (!room.receiver && !room.sender) {
        rooms.delete(currentRoomId);
        console.log(`[Room ${currentRoomId}] Cleaned up empty room.`);
      }
    }
  });
});

let tunnelProcess = null;
let browserOpened = false;

function startTunnel() {
  console.log('[*] Memulai SSH Tunnel ke localhost.run...');
  
  tunnelProcess = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-R', '80:localhost:8080',
    'nokey@localhost.run'
  ]);

  tunnelProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[SSH Tunnel]: ${output.trim()}`);
    
    // Parse URL from stdout (look for https://...lhr.life or https://...localhost.run)
    const match = output.match(/https:\/\/[a-zA-Z0-9.-]+\.(lhr\.life|localhost\.run)/i);
    if (match) {
      activeTunnelUrl = match[0];
      console.log(`\n==================================================`);
      console.log(`[*] TUNNEL AKTIF: ${activeTunnelUrl}`);
      console.log(`[*] QR Code HP akan otomatis menggunakan link ini!`);
      console.log(`==================================================\n`);

      // Automatically open the PC browser to the local server (only if NOT running in Electron)
      if (!browserOpened && process.env.IS_ELECTRON !== 'true') {
        browserOpened = true;
        console.log('[*] Membuka browser PC secara otomatis...');
        const startUrl = `http://localhost:${port}`;
        const platform = os.platform();
        if (platform === 'win32') {
          exec(`start ${startUrl}`);
        } else if (platform === 'darwin') {
          exec(`open ${startUrl}`);
        } else {
          exec(`xdg-open ${startUrl}`);
        }
      }
    }
  });

  tunnelProcess.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Warning') || output.includes('Error')) {
      console.warn(`[SSH Tunnel Warning]: ${output.trim()}`);
    }
  });

  tunnelProcess.on('close', (code) => {
    console.log(`[SSH Tunnel] Koneksi terputus (Code: ${code}). Mencoba menyambungkan kembali dalam 5 detik...`);
    activeTunnelUrl = null;
    setTimeout(startTunnel, 5000);
  });
}

// Kill SSH process on exit
process.on('exit', () => {
  if (tunnelProcess) {
    tunnelProcess.kill();
  }
});

server.listen(port, () => {
  const localIp = getLocalIpAddress();
  console.log(`==================================================`);
  console.log(`   ANTIGRAVITY CAMERA MIRRORING SIGNALING SERVER  `);
  console.log(`==================================================`);
  console.log(`[*] Signaling Server running on: http://localhost:${port}`);
  console.log(`[*] WebSocket Server running on: ws://localhost:${port}`);
  console.log(`[*] Local Network IP: ${localIp}`);
  console.log(`==================================================`);
  console.log(`[USB MODE GUIDE] Run: adb reverse tcp:3000 tcp:3000; adb reverse tcp:${port} tcp:${port}`);
  console.log(`==================================================`);
  
  // Start the tunnel automatically
  startTunnel();
});
