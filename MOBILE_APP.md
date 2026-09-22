# KDR Camera — Android & iOS

KDR Camera is the mobile camera client for KDR Multimedia. It packages the existing WebRTC camera sender as an Android/iOS application with Capacitor.

## Architecture

Phone camera → WebRTC → KDR Multimedia server → OBS Browser Source

The first mobile release uses WebRTC because the repository already has a multi-camera dashboard and OBS clean-feed view. SRT/NDI can be added later as native streaming engines.

## Build

Requirements:
- Node.js 20+
- Android Studio + Android SDK for Android
- Xcode 16+ on macOS for iOS

Install dependencies:

    npm install

Generate native projects:

    npm run mobile:add

Sync:

    npm run cap:sync

Open Android:

    npm run mobile:android

Open iOS:

    npm run mobile:ios

## Use

The mobile app opens in sender mode. Enter the Room ID and PIN shown by the KDR Multimedia PC dashboard.

For local Wi-Fi/LAN, keep the phone and PC on the same network. For remote connections, use the existing HTTPS tunnel/TURN configuration.

## OBS

Use the existing OBS clean-feed URL (?view=obs) as an OBS Browser Source. Set 1920×1080 for a 1080p camera.

## Next milestones

1. Native camera controls
2. 1080p/60 FPS profiles
3. Native audio controls
4. SRT output
5. NDI output
6. QR pairing
7. KDR CAM 01–04 labels
