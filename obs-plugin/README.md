# KDR Camera — OBS Plugin

Native OBS Studio source integration for KDR Multimedia.

## What it does

Adds a source named **KDR Camera** to OBS Studio.

Instead of manually adding a Browser Source, the plugin creates a private OBS Browser Source internally and points it at the KDR receiver page. The existing KDR WebRTC transport is therefore reused.

### Settings

- **KDR Server** — normally `http://127.0.0.1:8080`
- **Room / Camera ID** — for example `KDR01`
- **PIN** — optional
- **Width** — default 1920
- **Height** — default 1080
- **FPS** — default 30

## OBS requirement

The OBS installation must include **Browser Source / obs-browser**, because KDR Camera uses OBS's Chromium browser engine to render the WebRTC receiver.

## Intended workflow

1. Start the KDR Multimedia server on the PC.
2. Add **KDR Camera** from OBS Sources.
3. Enter the KDR room ID.
4. Scan the QR code with the KDR Camera Android app.
5. The video appears directly as a KDR Camera source in OBS.

## Next native transport phase

This first plugin release deliberately reuses the already-working WebRTC receiver. A later native transport can replace the browser engine with SRT/NDI/native WebRTC without changing the OBS source UI.
