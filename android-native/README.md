# KDR Camera — Native Android SRT Sender

Target pipeline:

**Camera2 → MediaCodec/H.264 → MPEG-TS → SRT → 4G/5G → KDR SRT Relay → OBS**

The native SRT path is isolated from the existing **WebRTC/LAN/Wi-Fi/USB Network** paths. HDMI Capture is also unchanged.

## Implemented in this stage

- StreamPack 3.2.x camera streamer.
- H.264 hardware encoding through Android MediaCodec.
- 720p/1080p and configurable FPS/bitrate.
- Optional microphone audio.
- SRT caller URL with stream ID, latency and optional passphrase.
- Native Capacitor bridge: `KdrSrt.start()`, `KdrSrt.stop()`, `KdrSrt.status()`.
- Automatic reconnect with exponential backoff up to 8 seconds.
- Native Android files are copied into the generated Capacitor project during CI, so the generated `android/` directory does not need to be committed.

## Important

The sender is now wired to the real StreamPack pipeline, but **end-to-end Remote Live is not considered production-ready until the Android APK build and a real 4G/5G → SRT relay → OBS test both pass**.

The existing LAN/Wi-Fi, USB Network and HDMI Capture modes are not replaced by this path.
