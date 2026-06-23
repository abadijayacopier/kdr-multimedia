# 📹 KDR Multimedia - Camera Mirroring

Aplikasi Mirroring Kamera HP berkualitas tinggi langsung ke PC Anda via USB / Wi-Fi dengan **0ms Delay (Latensi Rendah)** berbasis WebRTC. Sangat cocok digunakan untuk input video OBS Studio, vMix, Zoom, Google Meet, dan kebutuhan broadcast profesional lainnya.

---

## ✨ Fitur Utama
*   **0ms Latency (Ultra Low Delay):** Menggunakan protokol WebRTC P2P (Peer-to-Peer) untuk transfer video langsung secara offline tanpa delay.
*   **Multi-Camera Dashboard:** Monitoring banyak kamera HP sekaligus dalam satu layar grid terpadu secara real-time.
*   **Dukungan Beda Jaringan (TURN Server):** Terintegrasi dengan Open Relay TURN Server untuk menembus firewall CGNAT / jaringan seluler data (4G/5G).
*   **Electron Desktop Client:** Jalankan sebagai aplikasi desktop native Windows tanpa perlu membuka browser manual.
*   **PWA (Progressive Web App):** Bisa diinstal langsung ke layar utama HP Android & iPhone Anda untuk mempermudah akses cepat seperti aplikasi native.
*   **Kontrol Kamera Penuh:** Mengatur zoom digital, menyalakan senter (flashlight), fokus otomatis, dan resolusi video dari panel kontrol PC.

---

## 🔌 4 Opsi Metode Koneksi Pintar

### 1. Jaringan Tunneling (HTTPS - Rekomendasi)
*   **Kelebihan:** Sangat mudah, otomatis HTTPS, mendukung Android & Safari iOS secara langsung.
*   **Cara Penggunaan:** Cukup aktifkan server, lalu scan QR Code berlabel **Tunneling** menggunakan kamera HP Anda.

### 2. Wi-Fi IP Lokal (Offline & Cepat)
*   **Kelebihan:** Offline penuh tanpa kuota internet lewat Wi-Fi rumah/kantor Anda.
*   **Bypass Izin Kamera (HTTP):**
    *   **Android (Chrome):** Buka `chrome://flags/#unsafely-treat-insecure-origin-as-secure` di Chrome HP. Tempelkan URL IP lokal PC Anda (contoh: `http://192.168.1.10:8080`), ubah ke **Enabled**, lalu klik **Relaunch**.
    *   **iPhone (Safari):** Safari memblokir kamera di HTTP biasa, disarankan menggunakan metode **Tunneling** atau **USB iPhone**.

### 3. Kabel USB Android (0ms Delay)
*   **Kelebihan:** Latensi 0ms, super lancar, dan otomatis lolos izin kamera tanpa konfigurasi SSL!
*   **Cara Penggunaan:**
    1. Aktifkan **Opsi Pengembang** dan **USB Debugging** di HP Android Anda.
    2. Hubungkan HP ke PC via kabel USB.
    3. Jalankan perintah di PowerShell PC:
       ```powershell
       adb reverse tcp:8080 tcp:8080
       ```
    4. Buka Chrome di HP dan ketik `http://localhost:8080` (atau scan QR Code pada tab **USB Android**).

### 4. Kabel USB iPhone (0ms Delay + HTTPS Bypass)
*   **Kelebihan:** Latensi 0ms dan stabil untuk perangkat Apple.
*   **Cara Penggunaan:**
    1. Hubungkan iPhone ke PC menggunakan kabel data USB.
    2. Aktifkan **Personal Hotspot (USB Only)** di iPhone.
    3. Pilih **"Percayai Komputer Ini" (Trust)** di iPhone.
    4. Buka Safari di iPhone ke link **Tunneling HTTPS** yang ada di tab **USB iPhone**. Sinyal WebRTC akan diloloskan Safari lewat HTTPS, tetapi transfer video aslinya akan secara otomatis mengalir lewat kabel USB fisik!

---

## 🎥 Integrasi OBS Studio (Browser Source)
Anda dapat mengambil umpan video bersih (*clean feed*) tanpa panel kontrol/tombol untuk dimasukkan langsung ke OBS Studio:
1. Salin **OBS Browser Source URL** dari panel bawah panduan koneksi.
2. Di OBS Studio, tambahkan Source baru bertipe **Browser**.
3. Tempel URL yang sudah disalin, lalu atur ukuran resolusi (Width: **1920**, Height: **1080**).

---

## 🚀 Cara Menjalankan Project (Developer Mode)

### Prasyarat
*   Node.js terinstal di PC.
*   Git terinstal di PC.

### Instalasi Dependensi & Development
1. Clone project ini ke local folder Anda.
2. Jalankan perintah untuk menginstal dependensi:
   ```bash
   npm install
   ```
3. Untuk menjalankan mode pengembangan frontend & backend secara bersamaan:
   ```bash
   npm run dev
   ```

---

## 💻 Cara Menggunakan Versi Desktop (Electron App)

1. Pastikan Anda telah menginstal seluruh paket pendukung:
   ```bash
   npm install
   ```
2. Build frontend React ke dalam file produksi:
   ```bash
   npm run build
   ```
3. Jalankan aplikasi Electron desktop:
   ```bash
   npm run electron:start
   ```

### Membuat File Installer `.exe` Mandiri untuk Windows
Anda bisa membungkus aplikasi ini menjadi installer mandiri yang bisa diinstal di komputer mana saja tanpa memerlukan Node.js terinstal:
```bash
npm run electron:dist
```
Hasil file `.exe` setup installer dan portable akan terbentuk di folder **`dist-electron/`**.

---

## ☕ Dukung Pengembang (Donasi Secangkir Kopi)
Jika aplikasi ini bermanfaat bagi kelancaran streaming, produksi multimedia, atau pekerjaan Anda, dukung pengembang agar terus bersemangat merilis pembaruan fitur menarik lainnya!

Anda dapat berdonasi untuk segelas kopi hangat melalui:

*   **DANA:** `085655620979` (a.n Supriyanto Abadi Jaya)

Terima kasih banyak atas apresiasi dan dukungan Anda! 🙏

---
**Developed with ❤️ by Supriyanto Abadi Jaya | KDR Multimedia © 2026**
