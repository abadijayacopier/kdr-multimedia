# KDR Camera — Native Android SRT Sender

Target pipeline:

Camera2 / MediaCodec -> StreamPack -> SRT -> 4G/5G -> KDR SRT Relay -> OBS

The Android SRT path is isolated from the existing WebRTC, LAN/Wi-Fi and USB
transport. The native implementation will expose startSrt, stopSrt, status,
automatic reconnect, 720p/1080p, 30/60 FPS when supported, bitrate, optional
microphone and camera controls.

The generated Capacitor Android project is created during CI, so final native
plugin registration is applied during the Android build step rather than
committing generated android/ files.
