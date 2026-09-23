# KDR Camera SRT Relay

Relay sederhana untuk jalur **Remote Live**:

```
KDR Camera (4G/5G)
       |
       | SRT
       v
   KDR SRT Relay
       |
       | SRT / MPEG-TS
       v
 OBS / KDR Camera Receiver
```

## Kenapa relay terpisah?

PC event biasanya berada di balik NAT/router. Relay publik menjadi titik temu sehingga kamera yang berada jauh tidak perlu membuka port inbound di lokasi acara.

## Menjalankan

Diperlukan server/VPS publik dengan UDP port yang bisa dibuka.

Contoh:

```bash
export SRT_LISTEN_PORT=9000
export SRT_OUTPUT_URL="srt://OBS_TARGET:9001?mode=caller&latency=120&streamid=kdr-camera"
export SRT_STREAM_ID="kdr-camera"
export SRT_LATENCY=120
export SRT_PASSPHRASE="ganti-dengan-password"
docker compose -f deploy/srt-relay/docker-compose.yml up -d --build
```

## Catatan penting

- Relay ini adalah **fondasi transport SRT**, bukan pengganti sender kamera Android/iOS.
- Saat ini aplikasi browser/WebRTC yang sudah ada tetap dipertahankan untuk LAN/Wi-Fi, USB Network, HDMI dan Remote Live WebRTC.
- Integrasi **native SRT sender di Android/iOS** adalah tahap berikutnya agar HP dapat benar-benar mengirim video langsung sebagai SRT.
- Jangan membuka UDP port relay tanpa firewall dan passphrase untuk deployment publik.
