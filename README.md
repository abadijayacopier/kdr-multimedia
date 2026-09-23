# 📹 KDR Multimedia — KDR Camera

**KDR Multimedia** adalah platform kamera dan streaming untuk kebutuhan produksi live streaming, broadcast, dokumentasi acara, dan monitoring kamera. Project ini menyediakan aplikasi web/PWA, integrasi desktop, serta **KDR Camera Android** dengan dukungan **SRT** untuk pengiriman video ke server/broadcast workflow.

> 🚧 **Status:** Aktif dikembangkan. Build Android APK sudah menggunakan GitHub Actions. Fitur native SRT sedang dalam tahap integrasi dan pengujian perangkat Android.

---

## ✨ Fitur

### 🌐 Web / PWA
- WebRTC camera streaming dengan latensi rendah.
- Multi-camera dashboard.
- Monitoring beberapa kamera dalam satu layar.
- Dukungan koneksi melalui jaringan lokal maupun internet.
- PWA untuk Android dan iPhone.
- Kontrol kamera seperti resolusi, zoom, fokus, dan flashlight jika didukung perangkat/browser.
- OBS Browser Source untuk mengambil feed kamera.

### 🖥️ Desktop
- Electron desktop client.
- Cocok untuk workflow produksi di PC Windows.
- Dapat digunakan bersama OBS Studio dan software broadcast lainnya.

### 📱 KDR Camera Android
KDR Camera sedang dikembangkan sebagai aplikasi Android khusus untuk kamera broadcast.

Fitur native yang sudah disiapkan:
- Kamera Android.
- Mikrofon.
- Streaming **SRT Caller**.
- Stream ID.
- Passphrase.
- Latency SRT.
- Pilihan bitrate.
- Resolusi dan FPS.
- Status **LIVE / reconnecting / error**.
- Reconnect otomatis ketika koneksi SRT terputus.
- Launcher icon KDR Multimedia.
- APK release build melalui GitHub Actions.

---

# 📡 SRT Streaming

KDR Camera Android menggunakan alur:

```
KDR Camera Android
       │
       │ SRT
       ▼
   SRT Server
       │
       ├──► OBS Studio
       │
       ├──► Media Server
       │
       └──► Workflow Broadcast
```

Format endpoint yang digunakan:

```
srt://SERVER_IP:PORT
```

Konfigurasi dasar:

| Parameter | Contoh |
|---|---|
| Endpoint | `srt://SERVER_IP:9000` |
| Stream ID | `kdr-camera` |
| Latency | `120 ms` |
| Bitrate | `2–8 Mbps` |
| FPS | `30` |
| Resolusi | `1280×720 / 1920×1080 / 3840×2160` |

> Catatan: keberhasilan capture kamera, audio, dan pengiriman SRT tetap perlu divalidasi pada perangkat Android fisik.

---

# 🎬 Integrasi OBS Studio

Untuk workflow broadcast, target arsitektur:

```
Android Camera
      │
      │ SRT
      ▼
 SRT Receiver
      │
      ▼
 OBS Studio
      │
      ├──► YouTube
      ├──► Facebook
      ├──► TikTok
      └──► Platform lainnya
```

OBS dapat digunakan untuk:
- switching kamera,
- overlay,
- logo,
- lower third,
- audio mixing,
- recording,
- live streaming ke beberapa platform.

---

# 🔌 Metode Koneksi Web

## 1. HTTPS / Tunneling

Metode yang paling praktis untuk koneksi melalui internet.

Kelebihan:
- HTTPS.
- Mendukung WebRTC.
- Cocok untuk Android dan iPhone.
- Tidak perlu membuka port kamera secara langsung.

## 2. Wi-Fi Lokal

Cocok untuk produksi di lokasi yang sama.

Contoh:

```
PC / Server
192.168.1.10
      │
      │ Wi-Fi
      ▼
Android / iPhone
```

## 3. USB Android

Untuk workflow lokal dengan Android, koneksi dapat menggunakan ADB reverse:

```bash
adb reverse tcp:8080 tcp:8080
```

Kemudian:

```
http://localhost:8080
```

## 4. USB iPhone

iPhone dapat menggunakan koneksi USB Personal Hotspot untuk workflow lokal. Untuk akses kamera melalui Safari, gunakan endpoint HTTPS/tunneling yang disediakan aplikasi.

---

# 🚀 Menjalankan Project

## Prasyarat

- Node.js
- npm
- Git

Clone repository:

```bash
git clone https://github.com/abadijayacopier/kdr-multimedia.git
cd kdr-multimedia
```

Install dependency:

```bash
npm install
```

Jalankan development:

```bash
npm run dev
```

Build production:

```bash
npm run build
```

---

# 🖥️ Electron

Jalankan Electron:

```bash
npm run electron:start
```

Membuat installer Windows:

```bash
npm run electron:dist
```

Output installer berada di:

```
dist-electron/
```

---

# 📱 Build KDR Camera Android

Build Android dilakukan melalui **GitHub Actions**.

Workflow:

```
.github/workflows/android.yml
```

Alur build:

```
React / Vite
     │
     ▼
npm run build
     │
     ▼
Capacitor Android
     │
     ▼
Native SRT integration
     │
     ▼
Gradle
     │
     ▼
kdr-camera.apk
```

Nama APK:

```
kdr-camera.apk
```

Artifact GitHub Actions:

```
kdr-camera-apk
```

---

# 🧩 Struktur Native Android

Bagian native Android utama:

```
android-native/
├── KdrSrtPlugin.java
├── SrtSenderConfig.kt
└── SrtSenderService.kt
```

### KdrSrtPlugin

Bridge antara JavaScript/Capacitor dengan native Android.

API utama:

```
start()
stop()
status()
```

### SrtSenderConfig

Menyimpan konfigurasi:

- endpoint
- stream ID
- passphrase
- latency
- width
- height
- FPS
- bitrate
- audio

### SrtSenderService

Menangani:

- camera source,
- microphone source,
- encoding,
- SRT connection,
- reconnect,
- status streaming.

---

# 🛠️ Roadmap

## Fase 1 — Fondasi
- [x] WebRTC camera streaming
- [x] Multi-camera dashboard
- [x] PWA
- [x] Electron
- [x] Android build
- [x] KDR launcher icon
- [x] APK bernama `kdr-camera.apk`

## Fase 2 — Native SRT
- [x] Native SRT service
- [x] SRT endpoint
- [x] Stream ID
- [x] Passphrase
- [x] Latency
- [x] Bitrate
- [x] Reconnect
- [x] Status SRT pada UI
- [ ] Pengujian kamera Android fisik
- [ ] Pengujian microphone Android fisik
- [ ] Pengujian SRT end-to-end

## Fase 3 — Broadcast
- [ ] SRT receiver/server
- [ ] SRT → OBS
- [ ] Monitoring bitrate
- [ ] Monitoring FPS
- [ ] Monitoring packet loss
- [ ] Audio level meter
- [ ] Camera switching
- [ ] Reconnect monitoring
- [ ] Multi-camera SRT

## Fase 4 — Produksi
- [ ] Preset streaming
- [ ] Scene/shot management
- [ ] Remote camera control
- [ ] Recording
- [ ] Authentication
- [ ] Stream management
- [ ] Monitoring dashboard
- [ ] Production-ready release

---

# 🔐 Keamanan

Jangan menyimpan credential atau secret secara langsung di source code.

Hindari memasukkan:

- API key
- password server
- SRT passphrase produksi
- token
- credential database

ke dalam repository publik.

Untuk deployment produksi, gunakan environment variables atau secret management.

---

# 📂 Repository

Repository:

**KDR Multimedia**

```
https://github.com/abadijayacopier/kdr-multimedia
```

---

# ☕ Dukungan Pengembang

Jika project ini membantu kebutuhan streaming, produksi multimedia, atau pekerjaan Anda, dukungan untuk pengembangan sangat diapresiasi.

**DANA:** `085655620979`  
a.n. **Supriyanto Abadi Jaya**

---

## ❤️ KDR Multimedia

Dikembangkan untuk kebutuhan:

**Live Streaming • Camera • Broadcast • OBS • WebRTC • SRT • Multimedia**

**Developed with ❤️ by Supriyanto Abadi Jaya | KDR Multimedia © 2026**
