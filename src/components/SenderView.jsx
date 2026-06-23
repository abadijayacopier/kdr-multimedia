import React, { useEffect, useRef, useState } from 'react';

export default function SenderView({ roomId }) {
  const [status, setStatus] = useState('Menginisialisasi...');
  const [connected, setConnected] = useState(false);
  const [activeCamera, setActiveCamera] = useState('environment'); // 'user' | 'environment'
  const [activeResolution, setActiveResolution] = useState('1080p');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [mediaErrorType, setMediaErrorType] = useState(null); // 'insecure' | 'permission' | null

  // Zoom, Focus, and Pause states
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 8, step: 0.1 });
  const [zoomValue, setZoomValue] = useState(1);
  const [focusSupported, setFocusSupported] = useState(false);
  const [focusModes, setFocusModes] = useState([]);
  const [currentFocusMode, setCurrentFocusMode] = useState('continuous');
  const [isPaused, setIsPaused] = useState(false);

  const localVideoRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const queuedCandidatesRef = useRef([]);

  // WebRTC config
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  };

  useEffect(() => {
    // 1. Connect to WebSocket signaling server
    const wsHost = window.location.port === '3000'
      ? `${window.location.hostname}:8080`
      : window.location.host;
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${wsHost}`;

    setStatus('Menghubungkan ke server...');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setStatus('Terhubung ke Server. Menunggu PC...');
      ws.send(JSON.stringify({
        type: 'join',
        roomId,
        data: { clientType: 'sender' }
      }));
    };

    ws.onclose = () => {
      setConnected(false);
      setStatus('Koneksi server terputus.');
    };

    ws.onmessage = async (messageText) => {
      try {
        const message = JSON.parse(messageText.data);
        const { type, data } = message;

        switch (type) {
          case 'receiver-online':
            setStatus('PC Penerima Terdeteksi. Menyiapkan kamera...');
            // Start local stream if not already started
            if (!streamRef.current) {
              await setupCamera(activeCamera, activeResolution);
            } else {
              const track = streamRef.current.getVideoTracks()[0];
              if (track) {
                const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                sendCapabilities(capabilities);
              }
              // Force connection to initiate immediately if camera is already running
              await initiateWebRTCConnection();
            }
            break;

          case 'receiver-disconnected':
            setStatus('PC Penerima terputus. Menunggu kembali...');
            if (pcRef.current) {
              pcRef.current.close();
              pcRef.current = null;
            }
            break;

          case 'answer':
            console.log('Received answer from PC, finalizing peer connection...');
            if (pcRef.current) {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
              setStatus('Mirroring Aktif (Streaming)');
              
              // Process any queued candidates that arrived before the answer
              console.log(`Processing ${queuedCandidatesRef.current.length} queued ICE candidates`);
              for (const candidate of queuedCandidatesRef.current) {
                try {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                  console.error('Error adding queued ICE candidate:', err);
                }
              }
              queuedCandidatesRef.current = [];
            }
            break;

          case 'candidate':
            if (pcRef.current && pcRef.current.remoteDescription) {
              try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(data));
              } catch (err) {
                console.error('Error adding ICE candidate:', err);
              }
            } else {
              console.log('Remote description not set yet, queuing candidate...');
              queuedCandidatesRef.current.push(data);
            }
            break;

          case 'control':
            handleRemoteControl(data);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    // Initialize local camera immediately to show preview
    setupCamera(activeCamera, activeResolution);

    return () => {
      stopAllMedia();
      ws.close();
      if (pcRef.current) pcRef.current.close();
    };
  }, [roomId]);

  // Clean up media tracks
  const stopAllMedia = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Get constraints based on camera and resolution selection
  const getCameraConstraints = (camera, resolution) => {
    const constraints = {
      audio: false, // Mirroring camera only (optional to enable audio)
      video: {
        facingMode: camera === 'user' ? 'user' : { ideal: 'environment' }
      }
    };

    if (resolution === '720p') {
      constraints.video.width = { ideal: 1280 };
      constraints.video.height = { ideal: 720 };
    } else if (resolution === '1080p') {
      constraints.video.width = { ideal: 1920 };
      constraints.video.height = { ideal: 1080 };
    } else if (resolution === '4k') {
      constraints.video.width = { ideal: 3840 };
      constraints.video.height = { ideal: 2160 };
    }

    return constraints;
  };

  // Send camera capabilities to PC
  const sendCapabilities = (capabilities) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'control',
        roomId,
        data: {
          action: 'capabilities',
          value: {
            zoomSupported: !!capabilities.zoom,
            zoomRange: capabilities.zoom ? { min: capabilities.zoom.min || 1, max: capabilities.zoom.max || 8, step: capabilities.zoom.step || 0.1 } : null,
            focusSupported: !!capabilities.focusMode,
            focusModes: capabilities.focusMode || [],
            torchSupported: !!capabilities.torch
          }
        }
      }));
    }
  };

  // Zoom control
  const applyZoom = async (val) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && zoomSupported) {
      try {
        const floatVal = parseFloat(val);
        await track.applyConstraints({
          advanced: [{ zoom: floatVal }]
        });
        setZoomValue(floatVal);
      } catch (err) {
        console.error('Error applying zoom constraint:', err);
      }
    }
  };

  // Focus mode control
  const applyFocusMode = async (mode) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && focusSupported) {
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: mode }]
        });
        setCurrentFocusMode(mode);
      } catch (err) {
        console.error('Error applying focusMode constraint:', err);
      }
    }
  };

  // Pause / Play control
  const applyPause = (shouldPause) => {
    setIsPaused(shouldPause);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !shouldPause;
      });
    }
    
    if (shouldPause) {
      setStatus('Siaran ditangguhkan (PAUSED)');
    } else {
      setStatus('Mirroring Aktif (Streaming)');
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'control',
        roomId,
        data: { action: 'toggle-pause', value: shouldPause }
      }));
    }
  };

  // Setup Mobile Camera
  const setupCamera = async (camera, resolution) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaErrorType('insecure');
      setStatus('Gagal: Browser memblokir akses kamera (SSL/HTTPS diperlukan).');
      return;
    }
    try {
      setStatus('Membuka kamera...');
      stopAllMedia();

      const constraints = getCameraConstraints(camera, resolution);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Check capabilities
      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        
        // Torch
        setTorchSupported(!!capabilities.torch);

        // Zoom
        const hasZoom = !!capabilities.zoom;
        setZoomSupported(hasZoom);
        if (hasZoom) {
          setZoomRange({
            min: capabilities.zoom.min || 1,
            max: capabilities.zoom.max || 8,
            step: capabilities.zoom.step || 0.1
          });
          const defZoom = Math.max(capabilities.zoom.min || 1, Math.min(zoomValue, capabilities.zoom.max || 8));
          setZoomValue(defZoom);
          try {
            await track.applyConstraints({ advanced: [{ zoom: defZoom }] });
          } catch(e) {}
        }

        // Focus Mode
        const hasFocus = !!capabilities.focusMode;
        setFocusSupported(hasFocus);
        if (hasFocus) {
          setFocusModes(capabilities.focusMode || []);
          const defFocus = capabilities.focusMode.includes('continuous') ? 'continuous' : capabilities.focusMode[0];
          setCurrentFocusMode(defFocus);
          try {
            await track.applyConstraints({ advanced: [{ focusMode: defFocus }] });
          } catch(e) {}
        }

        // Report to receiver
        sendCapabilities(capabilities);
      }

      setActiveCamera(camera);
      setActiveResolution(resolution);
      setStatus('Kamera siap. Memulai streaming...');

      // Reset pause state on new camera initialization
      setIsPaused(false);

      // If WebSocket is connected and we are in a session, start WebRTC renegotiation
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        await initiateWebRTCConnection();
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setMediaErrorType('permission');
      setStatus(`Gagal mengakses kamera: ${err.message}`);
    }
  };

  // Initiate WebRTC peer connection and send offer
  const initiateWebRTCConnection = async () => {
    try {
      if (!streamRef.current) return;

      setStatus('Menghubungkan WebRTC...');
      queuedCandidatesRef.current = []; // Clear queue for new connection
      
      if (pcRef.current) {
        pcRef.current.close();
      }

      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      // Add local stream tracks to WebRTC
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'candidate',
            roomId,
            data: event.candidate
          }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setStatus('Mirroring Aktif (Streaming)');
        }
      };

      // Create WebRTC Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'offer',
          roomId,
          data: offer
        }));
      }
    } catch (err) {
      console.error('WebRTC offer failed:', err);
      setStatus(`Gagal inisialisasi WebRTC: ${err.message}`);
    }
  };

  // Handle remote controls sent from PC
  const handleRemoteControl = async (command) => {
    const { action, value } = command;
    console.log(`Received remote control action: ${action}`, value);

    switch (action) {
      case 'switch-camera':
        if (value !== activeCamera) {
          await setupCamera(value, activeResolution);
        }
        break;

      case 'set-resolution':
        if (value !== activeResolution) {
          await setupCamera(activeCamera, value);
        }
        break;

      case 'toggle-flash':
        setFlashlight(value);
        break;

      case 'set-zoom':
        await applyZoom(value);
        break;

      case 'set-focus-mode':
        await applyFocusMode(value);
        break;

      case 'toggle-pause':
        applyPause(value);
        break;

      case 'apply-settings':
        // Apply multiple settings at once
        const targetCam = value.camera || activeCamera;
        const targetRes = value.resolution || activeResolution;
        await setupCamera(targetCam, targetRes);
        setFlashlight(value.flash);
        if (value.zoom !== undefined) await applyZoom(value.zoom);
        if (value.focusMode !== undefined) await applyFocusMode(value.focusMode);
        break;

      default:
        break;
    }
  };

  // Turn torch on/off
  const setFlashlight = async (turnOn) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          await track.applyConstraints({
            advanced: [{ torch: turnOn }]
          });
          setTorchOn(turnOn);
        }
      } catch (err) {
        console.error('Flashlight control error:', err);
      }
    }
  };

  // Local switch camera button (manual override)
  const toggleCameraLocal = () => {
    const nextCam = activeCamera === 'environment' ? 'user' : 'environment';
    setupCamera(nextCam, activeResolution);
    
    // Notify PC of camera switch
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'control',
        roomId,
        data: { action: 'camera-switched-local', value: nextCam }
      }));
    }
  };

  if (mediaErrorType === 'insecure') {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#08090c',
        color: '#fff',
        padding: '1.5rem',
        boxSizing: 'border-box'
      }}>
        <div className="glass-panel" style={{ padding: '1.8rem', width: '100%', maxWidth: '450px', textAlign: 'left', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(18, 22, 33, 0.7)', backdropFilter: 'blur(20px)' }}>
          <h2 style={{ color: '#ff3366', fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 0 }}>
            <span>⚠️</span> Keamanan Browser Memblokir Kamera
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '1.2rem' }}>
            Browser HP memblokir akses kamera (<code>getUserMedia</code>) pada koneksi non-HTTPS jika diakses melalui IP Wi-Fi.
          </p>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-cyan)', marginBottom: '1.2rem' }}>
            <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: '#fff' }}>🔌 Solusi 1: Gunakan Kabel USB (Sangat Direkomendasikan)</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Hubungkan kabel data USB dari HP ke PC Anda dan aktifkan USB Debugging. Lalu di browser HP, buka:
              <br />
              <span style={{ color: 'var(--accent-green)', fontFamily: 'monospace', fontWeight: 'bold' }}>http://localhost:3000/?room={roomId}&role=sender</span>
              <br />
              Karena menggunakan <code>localhost</code>, browser akan selalu mengizinkan kamera tanpa memerlukan SSL/HTTPS.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--accent-blue)', marginBottom: '1.2rem' }}>
            <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: '#fff' }}>🤖 Solusi 2: Bypass di Android (Google Chrome)</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Jika Anda menggunakan Android dan Chrome:
              <br />
              1. Buka tab baru di Chrome HP, lalu ketik:<br />
              <code style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code><br />
              2. Aktifkan (<b>Enabled</b>) opsi tersebut.<br />
              3. Masukkan alamat IP PC Anda ke dalam kolom input:<br />
              <code style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>{window.location.origin}</code><br />
              4. Klik <b>Relaunch</b> dan buka kembali halaman ini.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid #ff00a0' }}>
            <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: '#fff' }}>🍎 Solusi 3: Jika Menggunakan iPhone (iOS Safari)</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              iOS Safari tidak mendukung bypass SSL. Anda <b>wajib</b> menggunakan <b>Kabel USB (Solusi 1)</b> agar dapat melakukan mirroring kamera.
            </p>
          </div>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            KDR Multimedia • Dev: supriyanto abadi jaya
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-view">
      {/* Camera Live Preview on phone screen */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="mobile-preview"
      />

      {/* Blurred Pause Overlay */}
      {isPaused && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(8, 9, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5,
          color: '#fff'
        }}>
          <span style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'blink 1.2s infinite alternate' }}>⏸️</span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--accent-red)', margin: 0 }}>SIARAN DITANGGUHKAN</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Ketuk tombol putar di bawah untuk melanjutkan</p>
        </div>
      )}

      {/* Floating UI Overlays */}
      <div className="mobile-overlay">
        {/* Top Header */}
        <div className="mobile-header">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              📹 KDR Multimedia Sender
            </span>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              Room: {roomId}
            </span>
          </div>
          <div className={`badge ${connected ? 'badge-connected' : 'badge-disconnected'}`} style={{ backdropFilter: 'blur(10px)' }}>
            <span className={`badge-dot ${connected ? 'blink' : ''}`}></span>
            {connected ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>

        {/* Center status message */}
        <div style={{ alignSelf: 'center', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div className="mobile-status-toast">
            {status}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="mobile-footer">
          {/* Active stats */}
          <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0, 0, 0, 0.6)', padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.75rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div>CAM: {activeCamera === 'environment' ? 'BELAKANG' : 'DEPAN'}</div>
            <div>RES: {activeResolution}</div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            {/* Flashlight toggle */}
            {torchSupported && (
              <button
                onClick={() => setFlashlight(!torchOn)}
                className={`mobile-btn-circle ${torchOn ? 'active' : ''}`}
                title="Toggle Flashlight"
              >
                <span style={{ fontSize: '1.4rem' }}>🔦</span>
              </button>
            )}

            {/* Flip camera */}
            <button
              onClick={toggleCameraLocal}
              className="mobile-btn-circle"
              style={{ width: '72px', height: '72px', background: 'rgba(255, 255, 255, 0.2)' }}
              title="Flip Camera"
            >
              <span style={{ fontSize: '1.8rem' }}>🔄</span>
            </button>

            {/* Pause toggle button */}
            <button
              onClick={() => applyPause(!isPaused)}
              className={`mobile-btn-circle ${isPaused ? 'active' : ''}`}
              style={{ backgroundColor: isPaused ? 'var(--accent-red)' : 'rgba(255, 255, 255, 0.15)' }}
              title={isPaused ? 'Mulai Streaming' : 'Tangguhkan Streaming'}
            >
              <span style={{ fontSize: '1.4rem' }}>{isPaused ? '▶️' : '⏸️'}</span>
            </button>
          </div>

          <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '0.2rem' }}>
            Dev: supriyanto abadi jaya
          </span>
        </div>
      </div>
    </div>
  );
}
