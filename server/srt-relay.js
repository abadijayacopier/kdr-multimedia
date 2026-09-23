import { spawn } from 'child_process';
import process from 'process';

const listenPort = Number(process.env.SRT_LISTEN_PORT || 9000);
const outputUrl = process.env.SRT_OUTPUT_URL || '';
const streamId = process.env.SRT_STREAM_ID || 'kdr-camera';
const latency = Number(process.env.SRT_LATENCY || 120);
const passphrase = process.env.SRT_PASSPHRASE || '';

let ffmpeg = null;

function buildInputUrl() {
  const params = new URLSearchParams({
    mode: 'listener',
    latency: String(latency),
    'streamid': streamId
  });
  if (passphrase) params.set('passphrase', passphrase);
  return `srt://0.0.0.0:${listenPort}?${params.toString()}`;
}

function startRelay() {
  if (!outputUrl) {
    console.log('[SRT] Relay idle: SRT_OUTPUT_URL is not configured.');
    return;
  }

  if (ffmpeg) return;

  const inputUrl = buildInputUrl();
  console.log(`[SRT] Starting relay: ${inputUrl} -> ${outputUrl}`);

  ffmpeg = spawn('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'warning',
    '-fflags', '+genpts',
    '-i', inputUrl,
    '-map', '0:v:0?',
    '-map', '0:a:0?',
    '-c', 'copy',
    '-f', 'mpegts',
    outputUrl
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  ffmpeg.stdout.on('data', data => console.log(`[SRT/ffmpeg] ${data.toString().trim()}`));
  ffmpeg.stderr.on('data', data => console.log(`[SRT/ffmpeg] ${data.toString().trim()}`));

  ffmpeg.on('error', err => {
    console.error('[SRT] ffmpeg could not start:', err.message);
    ffmpeg = null;
  });

  ffmpeg.on('close', code => {
    console.log(`[SRT] Relay process stopped (code ${code}). Retrying in 3s...`);
    ffmpeg = null;
    setTimeout(startRelay, 3000);
  });
}

function stopRelay() {
  if (ffmpeg) {
    ffmpeg.kill('SIGTERM');
    ffmpeg = null;
  }
}

process.on('SIGINT', () => { stopRelay(); process.exit(0); });
process.on('SIGTERM', () => { stopRelay(); process.exit(0); });

console.log('==================================================');
console.log('KDR MULTIMEDIA - SRT RELAY');
console.log('==================================================');
console.log(`[*] SRT listen port : ${listenPort}`);
console.log(`[*] Stream ID       : ${streamId}`);
console.log(`[*] Latency         : ${latency} ms`);
console.log(`[*] Output          : ${outputUrl || '(not configured)'}`);
console.log('==================================================');

startRelay();
