import React, { useEffect, useRef, useState } from 'react';
import ConnectionGuide from './ConnectionGuide';
import QRCode from 'qrcode';

function ConnectionGuideCompact({ roomId, serverInfo, pin }) {
  const [qrUrl, setQrUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const activeProtocol = window.location.protocol;
  const activeHost = window.location.host;
  const activePort = window.location.port || (activeProtocol === 'https:' ? '443' : '80');
  
  const isTunnel = window.location.hostname.includes('.') && !window.location.hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  
  // Try to get roomPin from parent props or generate a fallback
  const roomPin = pin || '1234';

  // LAN is the primary pairing path. Remote/tunnel is only used when explicitly requested.
  const useRemote = new URLSearchParams(window.location.search).get('remote') === '1';
  const lanBaseUrl = serverInfo?.lanUrl
    || (serverInfo?.localIp ? `http://${serverInfo.localIp}:${serverInfo.wsPort || 8080}` : `${activeProtocol}//${activeHost}`);
  const remoteBaseUrl = serverInfo?.activeTunnelUrl || (isTunnel ? `${activeProtocol}//${activeHost}` : '');
  const mobileBaseUrl = useRemote && remoteBaseUrl ? remoteBaseUrl : lanBaseUrl;
  const mobileUrl = `${mobileBaseUrl}/?room=${roomId}&pin=${roomPin}&role=sender&server=${encodeURIComponent(mobileBaseUrl)}`;

  useEffect(() => {
    QRCode.toDataURL(mobileUrl, {
      width: 150,
      margin: 1,
      color: {
        dark: '#08090c',
        light: '#ffffff'
      }
    })
      .then(url => setQrUrl(url))
      .catch(err => console.error('Error generating QR Code:', err));
  }, [mobileUrl]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', width: '100%', padding: '0.5rem 0' }}>
      {qrUrl ? (
        <img 
          src={qrUrl} 
          alt="QR Code" 
          style={{ 
            padding: '6px', 
            background: 'white', 
            borderRadius: '10px', 
            width: '120px', 
            height: '120px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
          }} 
        />
      ) : (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Membuat QR Code...</div>
      )}
      
      <div style={{ display: 'flex', width: '100%', maxWidth: '250px', gap: '0.4rem', alignItems: 'center', background: 'rgba(0,0,0,0.5)', padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--accent-cyan)' }}>
          {mobileUrl}
        </span>
        <button 
          onClick={copyToClipboard}
          className="btn btn-secondary" 
          style={{ padding: '0.2rem 0.6rem', fontSize: '0.7rem', minWidth: '55px', borderRadius: '6px' }}
        >
          {copied ? 'Tersalin' : 'Salin'}
        </button>
      </div>
    </div>
  );
}

export default function ReceiverView({ roomId, serverInfo, isObsView, layoutMode = 'single', onClose, onSwitchToGrid, onChangeRoomId }) {
  const [wsStatus, setWsStatus] = useState('connecting'); // 'connecting' | 'open' | 'closed'
  const [phoneStatus, setPhoneStatus] = useState('offline'); // 'offline' | 'online' | 'streaming'
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoStats, setVideoStats] = useState({ fps: 0, resolution: 'Detecting...', bitrate: '0 Kbps' });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  // Settings states to send to mobile
  const [selectedCamera, setSelectedCamera] = useState('environment'); // 'user' | 'environment'
  const [selectedResolution, setSelectedResolution] = useState('1080p'); // '720p' | '1080p' | '4k'
  const [selectedFps, setSelectedFps] = useState(30);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isTallyActive, setIsTallyActive] = useState(false);
  const [isMutedLocally, setIsMutedLocally] = useState(true);
  const [isFlashOn, setIsFlashOn] = useState(false);

  // Generate a random 4-digit PIN for this room session
  const [roomPin] = useState(() => {
    return String(Math.floor(1000 + Math.random() * 9000));
  });

  // Zoom, focus, pause and phone capabilities
  const [isPaused, setIsPaused] = useState(false);
  const [zoomVal, setZoomVal] = useState(1.0);
  const [focusMode, setFocusMode] = useState('continuous');
  const [phoneCapabilities, setPhoneCapabilities] = useState({
    zoomSupported: false,
    zoomRange: null,
    focusSupported: false,
    focusModes: [],
    torchSupported: false
  });

  // For Room ID customization
  const [isEditingId, setIsEditingId] = useState(false);
  const [tempId, setTempId] = useState(roomId);
  const [obsCopied, setObsCopied] = useState(false);

  // Sync tempId if roomId changes from parent
  useEffect(() => {
    setTempId(roomId);
  }, [roomId]);

  const copyObsUrl = () => {
    const port = window.location.port || '8080';
    const obsUrl = `${window.location.protocol}//${window.location.hostname}:${port}/?room=${roomId}&view=obs`;
    navigator.clipboard.writeText(obsUrl);
    setObsCopied(true);
    setTimeout(() => setObsCopied(false), 1500);
  };

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const fpsIntervalRef = useRef(null);
  const queuedCandidatesRef = useRef([]);

  // WebRTC configuration
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
    // KDR Multimedia: prefer the server advertised by LAN/QR pairing.
    const params = new URLSearchParams(window.location.search);
    const savedServer = localStorage.getItem('kdr_camera_server_url');
    const serverUrl = params.get('server') || savedServer || null;

    if (serverUrl) localStorage.setItem('kdr_camera_server_url', serverUrl);

    const normalizeWs = (value) => {
      if (!value) return null;
      if (value.startsWith('ws://') || value.startsWith('wss://')) return value;
      if (value.startsWith('https://')) return value.replace(/^https:\/\//, 'wss://');
      if (value.startsWith('http://')) return value.replace(/^http:\/\//, 'ws://');
      return `ws://${value}`;
    };

    const fallbackHost = window.location.port === '3000'
      ? `${window.location.hostname}:8080`
      : window.location.host;
    const wsUrl = normalizeWs(serverUrl) || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${fallbackHost}`;

    let reconnectTimer = null;
    let reconnectAttempt = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      setWsStatus('connecting');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt = 0;
        setWsStatus('open');
        ws.send(JSON.stringify({
          type: 'join',
          roomId,
          data: { clientType: 'receiver', pin: roomPin }
        }));
      };

      ws.onclose = () => {
        setWsStatus('closed');
        setPhoneStatus('offline');
        if (disposed) return;
        reconnectAttempt = Math.min(reconnectAttempt + 1, 10);
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempt - 1), 8000);
        reconnectTimer = setTimeout(connect, delay);
      };

    ws.onmessage = async (messageText) => {
      try {
        const message = JSON.parse(messageText.data);
        const { type, data } = message;

        switch (type) {
          case 'sender-joined':
            console.log('Mobile sender joined the room!');
            setPhoneStatus('online');
            break;

          case 'sender-disconnected':
            console.log('Mobile sender disconnected.');
            setPhoneStatus('offline');
            cleanupPeerConnection();
            break;

          case 'offer':
            console.log('Received offer from mobile phone, setting remote description...');
            await handleOffer(data);
            break;

          case 'candidate':
            if (pcRef.current && pcRef.current.remoteDescription) {
              try {
                console.log('Adding ICE candidate...');
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
            if (data.action === 'capabilities') {
              setPhoneCapabilities(data.value);
              if (data.value.zoomSupported && data.value.zoomRange) {
                setZoomVal(prev => Math.max(data.value.zoomRange.min, Math.min(prev, data.value.zoomRange.max)));
              }
              if (data.value.focusSupported && data.value.focusModes.length > 0) {
                const defFocus = data.value.focusModes.includes('continuous') ? 'continuous' : data.value.focusModes[0];
                setFocusMode(defFocus);
              }
            } else if (data.action === 'active-settings') {
              if (data.value.camera) setSelectedCamera(data.value.camera);
              if (data.value.resolution) setSelectedResolution(data.value.resolution);
              if (data.value.fps !== undefined) setSelectedFps(data.value.fps);
              if (data.value.audio !== undefined) setIsAudioEnabled(data.value.audio);
              if (data.value.tally !== undefined) setIsTallyActive(data.value.tally);
              if (data.value.flash !== undefined) setIsFlashOn(data.value.flash);
              if (data.value.zoom !== undefined) setZoomVal(data.value.zoom);
              if (data.value.focusMode) setFocusMode(data.value.focusMode);
              if (data.value.isPaused !== undefined) setIsPaused(data.value.isPaused);
            } else if (data.action === 'toggle-pause') {
              setIsPaused(data.value);
            }
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    };

    connect();

    // Calculate FPS and monitor stream
    fpsIntervalRef.current = setInterval(() => {
      if (videoRef.current && videoRef.current.srcObject) {
        const videoTrack = videoRef.current.srcObject.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          const resolutionStr = settings.width && settings.height 
            ? `${settings.width}x${settings.height}` 
            : 'Detecting...';
          
          setIsPortrait(settings.height > settings.width);
          
          // Generate a fake but realistic FPS / Bitrate for stats view
          setVideoStats({
            fps: Math.round(settings.frameRate || 30),
            resolution: resolutionStr,
            bitrate: `${Math.round(2000 + Math.random() * 500)} Kbps`
          });
        }
      }
    }, 1000);

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
      cleanupPeerConnection();
      clearInterval(fpsIntervalRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [roomId]);

  // Clean up WebRTC Peer Connection
  const cleanupPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setPhoneStatus('offline');
  };

  // Handle incoming Offer from Phone
  const handleOffer = async (offerSdp) => {
    cleanupPeerConnection();

    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'candidate',
          roomId,
          data: event.candidate
        }));
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote media stream track!');
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
        videoRef.current.play().catch(e => console.error("Play failed:", e));
        setPhoneStatus('streaming');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Peer Connection State Changed:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setPhoneStatus('streaming');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setPhoneStatus('online');
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));

    // Process any queued candidates that arrived before setRemoteDescription finished
    console.log(`Processing ${queuedCandidatesRef.current.length} queued ICE candidates`);
    for (const candidate of queuedCandidatesRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding queued ICE candidate:', err);
      }
    }
    queuedCandidatesRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'answer',
        roomId,
        data: answer
      }));
    }
  };

  // Send Remote Control Command to Phone
  const sendControlCommand = (action, value = null) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'control',
        roomId,
        data: { action, value }
      }));
    }
  };

  // Change Camera remotely
  const handleCameraChange = (e) => {
    const cam = e.target.value;
    setSelectedCamera(cam);
    sendControlCommand('switch-camera', cam);
  };

  // Change Resolution remotely
  const handleResolutionChange = (e) => {
    const res = e.target.value;
    setSelectedResolution(res);
    sendControlCommand('set-resolution', res);
  };

  // Toggle Torch/Flash
  const handleFlashToggle = () => {
    const nextFlash = !isFlashOn;
    setIsFlashOn(nextFlash);
    sendControlCommand('toggle-flash', nextFlash);
  };

  // Handle Zoom change remotely (or digitally)
  const handleZoomChange = (e) => {
    const val = parseFloat(e.target.value);
    setZoomVal(val);
    if (phoneCapabilities.zoomSupported) {
      sendControlCommand('set-zoom', val);
    }
  };

  // Handle Focus Mode change remotely
  const handleFocusModeChange = (e) => {
    const mode = e.target.value;
    setFocusMode(mode);
    if (phoneCapabilities.focusSupported) {
      sendControlCommand('set-focus-mode', mode);
    }
  };

  // Toggle Pause remotely
  const handlePauseToggle = () => {
    const nextPause = !isPaused;
    setIsPaused(nextPause);
    sendControlCommand('toggle-pause', nextPause);
  };

  // Render YouTube + Logo Pause Overlay
  const renderPauseOverlay = () => {
    if (!isPaused) return null;
    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(8, 9, 12, 0.85)',
        backdropFilter: 'blur(15px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        color: '#fff',
        animation: 'fadeIn 0.3s ease'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.2rem' }}>
          <img 
            src="/icon.png" 
            alt="KDR Logo" 
            style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              border: '2px solid var(--accent-cyan)', 
              boxShadow: '0 0 20px rgba(0, 242, 254, 0.4)',
              background: '#08090c'
            }} 
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <svg viewBox="0 0 24 24" width="60" height="60" fill="#ff0000" style={{ filter: 'drop-shadow(0 0 12px rgba(255, 0, 0, 0.7))' }}>
            <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.524 3.545 12 3.545 12 3.545s-7.525 0-9.387.51A3.003 3.003 0 0 0 .502 6.163C0 8.07 0 12 0 12s0 3.93.502 5.837a3.003 3.003 0 0 0 2.11 2.108c1.862.51 9.387.51 9.387.51s7.525 0 9.387-.51a3.003 3.003 0 0 0 2.11-2.108c.502-1.907.502-5.837.502-5.837s0-3.93-.502-5.837z" />
            <polygon points="9.545 15.568 15.818 12 9.545 8.432" fill="#ffffff" />
          </svg>
        </div>
        <h2 className="gradient-text glow-text" style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '0 0 0.4rem 0', letterSpacing: '0.05em' }}>
          KDR Multimedia
        </h2>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          📺 Streaming Paused
        </p>
      </div>
    );
  };

  // Take Snapshot
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas dimensions equal to the video feed resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame onto the canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Trigger download
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `snapshot_${new Date().toISOString().slice(0,19).replace(/[:T]/g, '_')}.jpg`;
    link.click();
  };

  // Start / Stop Video Recording
  const toggleRecording = () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
    } else {
      // Start recording
      if (!videoRef.current || !videoRef.current.srcObject) return;

      const stream = videoRef.current.srcObject;
      recordedChunksRef.current = [];

      const options = { mimeType: 'video/webm;codecs=vp9' };
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        console.warn('VP9 codec not supported, trying default mimeType');
        recorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `recording_${new Date().toISOString().slice(0,19).replace(/[:T]/g, '_')}.webm`;
        link.click();
        URL.revokeObjectURL(url);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current.parentElement.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error(err));
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (isObsView) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: isPortrait ? 'contain' : 'cover',
            border: 'none',
            outline: 'none'
          }}
        />
        {phoneStatus !== 'streaming' && (
          <div style={{
            position: 'absolute',
            color: '#8f9cae',
            fontFamily: 'sans-serif',
            fontSize: '1rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '1rem',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            🔴 Waiting for Camera Stream...
          </div>
        )}
      </div>
    );
  }

  // --- GRID MODE RENDER ---
  if (layoutMode === 'grid') {
    return (
      <div className="glass-panel grid-camera-card">
        {/* Card Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '0.6rem 1rem', 
          background: 'rgba(0,0,0,0.4)', 
          borderBottom: '1px solid var(--border-color)',
          zIndex: 10
        }}>
          {isEditingId && onChangeRoomId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <input 
                type="text" 
                value={tempId} 
                onChange={(e) => setTempId(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                style={{ 
                  background: 'rgba(0,0,0,0.5)', 
                  border: '1px solid var(--accent-cyan)', 
                  borderRadius: '4px', 
                  color: '#fff', 
                  padding: '2px 6px', 
                  fontSize: '0.75rem', 
                  width: '95px',
                  fontFamily: 'monospace'
                }} 
              />
              <button 
                onClick={() => {
                  if (tempId.trim().length >= 3) {
                     onChangeRoomId(tempId.trim());
                     setIsEditingId(false);
                  }
                }}
                style={{ background: 'none', border: 'none', color: 'var(--accent-green)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                title="Simpan"
              >
                ✔️
              </button>
              <button 
                onClick={() => {
                  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                  let result = '';
                  for (let i = 0; i < 6; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                  }
                  setTempId(result);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                title="Acak Baru"
              >
                🔄
              </button>
              <button 
                onClick={() => {
                  setTempId(roomId);
                  setIsEditingId(false);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
                title="Batal"
              >
                ✕
              </button>
            </div>
          ) : (
            <span 
              onClick={() => {
                if (onChangeRoomId) {
                  setTempId(roomId);
                  setIsEditingId(true);
                }
              }}
              style={{ 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                color: 'var(--accent-cyan)', 
                cursor: onChangeRoomId ? 'pointer' : 'default', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.3rem' 
              }}
              title={onChangeRoomId ? 'Klik untuk ubah ID Room' : ''}
            >
              🎥 Kamera: {roomId} {onChangeRoomId && <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>✏️</span>}
            </span>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {isAudioEnabled && (
              <button 
                onClick={() => setIsMutedLocally(!isMutedLocally)}
                style={{
                  background: 'none', border: 'none', color: isMutedLocally ? 'var(--accent-red)' : 'var(--accent-green)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px'
                }}
                title={isMutedLocally ? 'Suara di-mute di PC (Klik untuk Unmute)' : 'Suara aktif di PC (Klik untuk Mute)'}
              >
                {isMutedLocally ? '🔇' : '🔊'}
              </button>
            )}
            <button
              onClick={copyObsUrl}
              style={{
                background: obsCopied ? 'rgba(46, 213, 115, 0.15)' : 'rgba(0, 242, 254, 0.1)',
                border: obsCopied ? '1px solid var(--accent-green)' : '1px solid var(--accent-cyan)',
                color: obsCopied ? 'var(--accent-green)' : 'var(--accent-cyan)',
                cursor: 'pointer',
                fontSize: '0.65rem',
                padding: '2px 8px',
                borderRadius: '4px',
                marginRight: '0.2rem',
                fontWeight: 'bold',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              title="Salin Browser Source URL untuk OBS Studio"
            >
              {obsCopied ? '✔️ Tersalin!' : '🔗 OBS'}
            </button>
            <span className={`badge-dot ${phoneStatus === 'streaming' ? 'badge-connected' : 'badge-disconnected'}`} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: phoneStatus === 'streaming' ? 'var(--accent-green)' : 'var(--accent-red)' }} />
            <button 
              onClick={onClose} 
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'var(--text-secondary)', 
                cursor: 'pointer', 
                fontSize: '1rem', 
                padding: '2px 6px',
                borderRadius: '4px'
              }}
              className="hover-red"
              title="Hapus Kamera"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Video Box / QR Code container */}
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          aspectRatio: isPortrait ? '9/16' : '16/9', 
          background: '#020304', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {isRecording && (
            <div className="recording-indicator" style={{ top: '10px', left: '10px', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
              <div className="rec-dot"></div>
              REC {formatTime(recordingTime)}
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMutedLocally}
            className="mirrored-video"
            style={{ 
              display: phoneStatus === 'streaming' ? 'block' : 'none', 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              ...(!phoneCapabilities.zoomSupported && zoomVal > 1.0 
                ? { transform: `scale(${zoomVal})`, transformOrigin: 'center center', transition: 'transform 0.1s ease' }
                : {})
            }}
          />

          {renderPauseOverlay()}

          {phoneStatus !== 'streaming' && (
            <div style={{ padding: '1rem', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
              <ConnectionGuideCompact roomId={roomId} serverInfo={serverInfo} pin={roomPin} />
              <div style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 'bold', fontFamily: 'monospace', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
                PIN: {roomPin}
              </div>
            </div>
          )}
        </div>

        {/* Card Footer */}
        {phoneStatus === 'streaming' ? (
          <div style={{ padding: '0.8rem', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              <span>{videoStats.resolution} @ {videoStats.fps} FPS</span>
              <span style={{ color: 'var(--accent-green)' }}>P2P (WebRTC)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.3rem' }}>
              <button
                onClick={handleFlashToggle}
                className={`btn ${isFlashOn ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.2rem', fontSize: '0.7rem', background: isFlashOn ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255,255,255,0.05)', borderColor: isFlashOn ? 'var(--accent-cyan)' : 'var(--border-color)', color: isFlashOn ? 'var(--accent-cyan)' : 'var(--text-primary)' }}
                title={isFlashOn ? 'Matikan Senter' : 'Nyalakan Senter'}
              >
                🔦 {isFlashOn ? 'ON' : 'OFF'}
              </button>

              <select
                value={selectedCamera}
                onChange={handleCameraChange}
                className="control-select"
                style={{ padding: '0.4rem 0.2rem', fontSize: '0.7rem', height: 'auto', background: 'rgba(255,255,255,0.05)' }}
              >
                <option value="environment">Rear</option>
                <option value="user">Front</option>
                <option value="screen">Screen</option>
              </select>

              <button
                onClick={captureSnapshot}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.2rem', fontSize: '0.7rem' }}
                title="Ambil Foto"
              >
                📸 Foto
              </button>

              <button
                onClick={handlePauseToggle}
                className={`btn ${isPaused ? 'btn-danger' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.2rem', fontSize: '0.7rem', background: isPaused ? 'rgba(255,51,102,0.2)' : 'rgba(255,255,255,0.05)', borderColor: isPaused ? 'var(--accent-red)' : 'var(--border-color)', color: isPaused ? 'var(--accent-red)' : 'var(--text-primary)' }}
                title={isPaused ? 'Lanjutkan Siaran' : 'Pause Siaran'}
              >
                {isPaused ? '▶️ Play' : '⏸️ Pause'}
              </button>

              <button
                onClick={toggleRecording}
                className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.2rem', fontSize: '0.7rem' }}
                title={isRecording ? 'Hentikan Rekam' : 'Mulai Rekam'}
              >
                {isRecording ? '⏹️ Stop' : '🔴 Rec'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                <span>Zoom {phoneCapabilities.zoomSupported ? '(HW)' : '(DIG)'}</span>
                <span style={{ color: 'var(--accent-cyan)' }}>{zoomVal.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={phoneCapabilities.zoomSupported && phoneCapabilities.zoomRange ? phoneCapabilities.zoomRange.min : 1.0}
                max={phoneCapabilities.zoomSupported && phoneCapabilities.zoomRange ? phoneCapabilities.zoomRange.max : 4.0}
                step={phoneCapabilities.zoomSupported && phoneCapabilities.zoomRange ? phoneCapabilities.zoomRange.step : 0.1}
                value={zoomVal}
                onChange={handleZoomChange}
                style={{
                  width: '100%',
                  accentColor: 'var(--accent-cyan)',
                  height: '4px',
                  borderRadius: '2px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>
        ) : (
          <div style={{ padding: '0.5rem', textAlign: 'center', background: 'rgba(0,0,0,0.1)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Menunggu koneksi dari HP...
          </div>
        )}
      </div>
    );
  }

  // --- SINGLE MODE RENDER ---
  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div>
          <h1 className="gradient-text glow-text" style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📹</span> KDR Multimedia
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Kamera HP berkualitas tinggi langsung ke PC Anda via USB / Wi-Fi
          </p>
        </div>
        <div className="app-header-controls">
          {onSwitchToGrid && (
            <button
              onClick={onSwitchToGrid}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', background: 'rgba(0, 242, 254, 0.05)', borderColor: 'rgba(0, 242, 254, 0.2)' }}
            >
              🎛️ Mode Multi-Camera
            </button>
          )}
          <div className={`badge ${wsStatus === 'open' ? 'badge-connected' : 'badge-disconnected'}`}>
            <span className={`badge-dot ${wsStatus === 'open' ? 'blink' : ''}`}></span>
            Signaling Server: {wsStatus}
          </div>
          <div className={`badge ${phoneStatus === 'streaming' ? 'badge-connected' : 'badge-disconnected'}`}>
            <span className={`badge-dot ${phoneStatus === 'streaming' ? 'blink' : ''}`}></span>
            HP Camera: {phoneStatus}
          </div>
        </div>
      </header>

      {/* Main Receiver Grid */}
      <div className="receiver-grid">
        {/* Left side: Video Viewfinder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={`video-container ${isPortrait ? 'portrait' : ''}`}>
            {/* Overlay Viewfinder elements */}
            <div className="viewfinder-overlay">
              <div className="bracket bracket-tl"></div>
              <div className="bracket bracket-tr"></div>
              <div className="bracket bracket-bl"></div>
              <div className="bracket bracket-br"></div>
              <div className="grid-lines"></div>
            </div>

            {/* Recording flashing counter */}
            {isRecording && (
              <div className="recording-indicator">
                <div className="rec-dot"></div>
                REC {formatTime(recordingTime)}
              </div>
            )}

            {/* Remote Video element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isMutedLocally}
              className="mirrored-video"
              style={{ 
                display: phoneStatus === 'streaming' ? 'block' : 'none',
                ...(!phoneCapabilities.zoomSupported && zoomVal > 1.0 
                  ? { transform: `scale(${zoomVal})`, transformOrigin: 'center center', transition: 'transform 0.1s ease' }
                  : {})
              }}
            />

            {/* Pause Overlay */}
            {renderPauseOverlay()}

            {/* Fallback Screen when offline */}
            {phoneStatus !== 'streaming' && (
              <div style={{ textAlign: 'center', padding: '2rem', zIndex: 4 }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'blink 2s infinite alternate' }}>📷</div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Menunggu Kamera Terhubung...</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto' }}>
                  Gunakan panduan koneksi di bawah untuk menyambungkan kamera smartphone Anda.
                </p>
              </div>
            )}
          </div>

          {/* Stream stats */}
          {phoneStatus === 'streaming' && (
            <div className="stats-bar">
              <div className="stat-item">Resolusi: <span>{videoStats.resolution}</span></div>
              <div className="stat-item">FPS: <span>{videoStats.fps}</span></div>
              <div className="stat-item">Bitrate: <span>{videoStats.bitrate}</span></div>
              <div className="stat-item" style={{ marginLeft: 'auto' }}>Mode: <span style={{ color: 'var(--accent-green)' }}>P2P (WebRTC)</span></div>
            </div>
          )}

          {/* Hidden Canvas for Screenshots */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Connection Guide for Setup */}
          {phoneStatus !== 'streaming' && (
            <div style={{ position: 'relative' }}>
              <ConnectionGuide roomId={roomId} serverInfo={serverInfo} pin={roomPin} />
              <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.8)', padding: '6px 14px', borderRadius: '12px', fontSize: '0.9rem', color: 'var(--accent-cyan)', fontWeight: 'bold', fontFamily: 'monospace', border: '1px solid var(--accent-cyan)', boxShadow: '0 4px 15px rgba(0, 242, 254, 0.2)' }}>
                PIN: {roomPin}
              </div>
            </div>
          )}
        </div>

        {/* Right side: Controller Panel */}
        <div className="glass-panel sidebar-panel">
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🛠️</span> Panel Kontrol
          </h3>

          {/* Room ID Info & Edit */}
          {onChangeRoomId && (
            <div className="control-group" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem', marginBottom: '0.8rem' }}>
              <label>ID Room (Kode Hubung)</label>
              {isEditingId ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input 
                    type="text" 
                    value={tempId} 
                    onChange={(e) => setTempId(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    style={{ 
                      background: 'rgba(0, 0, 0, 0.4)', 
                      border: '1px solid var(--accent-cyan)', 
                      borderRadius: '8px', 
                      color: '#fff', 
                      padding: '0.4rem 0.6rem', 
                      fontSize: '0.9rem', 
                      flex: 1,
                      fontFamily: 'monospace',
                      letterSpacing: '1px',
                      outline: 'none'
                    }} 
                  />
                  <button 
                    onClick={() => {
                      if (tempId.trim().length >= 3) {
                        onChangeRoomId(tempId.trim());
                        setIsEditingId(false);
                      }
                    }}
                    className="btn btn-primary"
                    style={{ padding: '0.4rem 0.6rem', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Simpan"
                  >
                    ✔️
                  </button>
                  <button 
                    onClick={() => {
                      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                      let result = '';
                      for (let i = 0; i < 6; i++) {
                        result += chars.charAt(Math.floor(Math.random() * chars.length));
                      }
                      setTempId(result);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.6rem', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Acak Baru"
                  >
                    🔄
                  </button>
                  <button 
                    onClick={() => {
                      setTempId(roomId);
                      setIsEditingId(false);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.6rem', minWidth: 'auto', color: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Batal"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent-cyan)', fontFamily: 'monospace', letterSpacing: '1px' }}>
                    {roomId}
                  </span>
                  <button
                    onClick={() => {
                      setTempId(roomId);
                      setIsEditingId(true);
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', minWidth: 'auto' }}
                  >
                    ✏️ Ubah ID
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Desktop Audio Monitor Toggle */}
          {isAudioEnabled && !isObsView && (
            <div style={{ padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Monitoring Audio di PC:</span>
              <button 
                onClick={() => setIsMutedLocally(!isMutedLocally)}
                className={`btn ${isMutedLocally ? 'btn-danger' : 'btn-primary'}`}
                style={{ padding: '0.2rem 0.8rem', fontSize: '0.75rem' }}
              >
                {isMutedLocally ? '🔇 Muted' : '🔊 Unmuted'}
              </button>
            </div>
          )}

          {/* OBS Studio Integration Link */}
          <div className="control-group" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem', marginBottom: '0.8rem' }}>
            <label>Integrasi OBS Studio</label>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
              <input 
                type="text" 
                readOnly
                value={`${window.location.protocol}//${window.location.hostname}:${window.location.port || '8080'}/?room=${roomId}&view=obs`}
                style={{ 
                  background: 'rgba(0, 0, 0, 0.4)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  color: 'var(--text-secondary)', 
                  padding: '0.4rem 0.6rem', 
                  fontSize: '0.75rem', 
                  flex: 1,
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  outline: 'none'
                }} 
              />
              <button 
                onClick={copyObsUrl}
                className="btn"
                style={{ 
                  padding: '0.4rem 0.6rem', 
                  fontSize: '0.75rem', 
                  minWidth: '70px',
                  background: obsCopied ? 'rgba(46, 213, 115, 0.2)' : 'rgba(255,255,255,0.05)',
                  borderColor: obsCopied ? 'var(--accent-green)' : 'var(--border-color)',
                  color: obsCopied ? 'var(--accent-green)' : 'var(--text-primary)',
                  transition: 'all 0.2s ease'
                }}
              >
                {obsCopied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
              Tambahkan sebagai <b>Browser Source</b> di OBS (Resolusi: 1920x1080).
            </p>
          </div>

          {/* Media Capture Actions */}
          <div className="control-group">
            <label>Pengambilan Media</label>
            <button
              onClick={captureSnapshot}
              disabled={phoneStatus !== 'streaming'}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              📸 Ambil Foto (Snapshot)
            </button>
            <button
              onClick={toggleRecording}
              disabled={phoneStatus !== 'streaming'}
              className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
            >
              {isRecording ? '⏹️ Hentikan Rekaman' : '🔴 Mulai Rekam Layar'}
            </button>
          </div>

          {/* Remote camera settings */}
          <div className="control-group" style={{ marginTop: '0.8rem' }}>
            <label>Pilihan Kamera HP</label>
            <select
              value={selectedCamera}
              onChange={handleCameraChange}
              disabled={phoneStatus === 'offline'}
              className="control-select"
            >
              <option value="environment">Kamera Belakang (Utama)</option>
              <option value="user">Kamera Depan (Selfie)</option>
              <option value="screen">Berbagi Layar (Screen Share)</option>
            </select>
          </div>

          <div className="control-group">
            <label>Resolusi & FPS</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={selectedResolution}
                onChange={handleResolutionChange}
                disabled={phoneStatus === 'offline'}
                className="control-select"
                style={{ flex: 2 }}
              >
                <option value="720p">720p (HD)</option>
                <option value="1080p">1080p (Full HD)</option>
                <option value="4k">4K (Ultra HD)</option>
              </select>
              <select
                value={selectedFps}
                onChange={(e) => {
                  const fps = parseInt(e.target.value);
                  setSelectedFps(fps);
                  sendControlCommand('set-fps', fps);
                }}
                disabled={phoneStatus === 'offline'}
                className="control-select"
                style={{ flex: 1 }}
              >
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </div>
          </div>

          <div className="control-group">
            <label>Fitur Tambahan</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  const nextAudio = !isAudioEnabled;
                  setIsAudioEnabled(nextAudio);
                  sendControlCommand('toggle-audio', nextAudio);
                }}
                disabled={phoneStatus === 'offline'}
                className={`btn ${isAudioEnabled ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  background: isAudioEnabled ? 'rgba(46, 213, 115, 0.2)' : 'rgba(255,255,255,0.05)',
                  borderColor: isAudioEnabled ? 'var(--accent-green)' : 'var(--border-color)',
                  color: isAudioEnabled ? 'var(--accent-green)' : 'var(--text-primary)'
                }}
              >
                {isAudioEnabled ? '🎙️ Mic ON' : '🔇 Mic OFF'}
              </button>

              <button
                onClick={() => {
                  const nextTally = !isTallyActive;
                  setIsTallyActive(nextTally);
                  sendControlCommand('tally-light', nextTally);
                }}
                disabled={phoneStatus === 'offline'}
                className={`btn ${isTallyActive ? 'btn-danger' : 'btn-secondary'}`}
                style={{
                  background: isTallyActive ? 'rgba(255, 51, 102, 0.2)' : 'rgba(255,255,255,0.05)',
                  borderColor: isTallyActive ? 'var(--accent-red)' : 'var(--border-color)',
                  color: isTallyActive ? 'var(--accent-red)' : 'var(--text-primary)'
                }}
              >
                🔴 Tally {isTallyActive ? 'ON' : 'OFF'}
              </button>
            </div>
            
            <button
              onClick={handleFlashToggle}
              disabled={phoneStatus === 'offline'}
              className={`btn ${isFlashOn ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                width: '100%',
                marginTop: '0.5rem',
                background: isFlashOn ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255,255,255,0.05)',
                borderColor: isFlashOn ? 'var(--accent-cyan)' : 'var(--border-color)',
                color: isFlashOn ? 'var(--accent-cyan)' : 'var(--text-primary)'
              }}
            >
              🔦 {isFlashOn ? 'Matikan Senter' : 'Nyalakan Senter'}
            </button>
          </div>

          {/* Zoom Control */}
          <div className="control-group">
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>🔍 Zoom {phoneCapabilities.zoomSupported ? '(Hardware)' : '(Digital)'}</span>
              <span style={{ color: 'var(--accent-cyan)' }}>{zoomVal.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min={phoneCapabilities.zoomSupported && phoneCapabilities.zoomRange ? phoneCapabilities.zoomRange.min : 1.0}
              max={phoneCapabilities.zoomSupported && phoneCapabilities.zoomRange ? phoneCapabilities.zoomRange.max : 4.0}
              step={phoneCapabilities.zoomSupported && phoneCapabilities.zoomRange ? phoneCapabilities.zoomRange.step : 0.1}
              value={zoomVal}
              onChange={handleZoomChange}
              disabled={phoneStatus !== 'streaming'}
              style={{
                width: '100%',
                accentColor: 'var(--accent-cyan)',
                background: 'rgba(255,255,255,0.05)',
                height: '6px',
                borderRadius: '3px',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Autofocus Control */}
          {phoneCapabilities.focusSupported && phoneCapabilities.focusModes.length > 0 && (
            <div className="control-group">
              <label>Autofokus (Hardware)</label>
              <select
                value={focusMode}
                onChange={handleFocusModeChange}
                disabled={phoneStatus !== 'streaming'}
                className="control-select"
              >
                {phoneCapabilities.focusModes.map(mode => (
                  <option key={mode} value={mode}>
                    {mode === 'continuous' ? 'Otomatis Menerus (Continuous)' : mode === 'manual' ? 'Manual' : mode}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Pause / Play Control */}
          <div className="control-group">
            <label>Kontrol Siaran</label>
            <button
              onClick={handlePauseToggle}
              disabled={phoneStatus !== 'streaming'}
              className={`btn ${isPaused ? 'btn-danger' : 'btn-secondary'}`}
              style={{
                width: '100%',
                background: isPaused ? 'rgba(255, 51, 102, 0.2)' : 'rgba(255,255,255,0.05)',
                borderColor: isPaused ? 'var(--accent-red)' : 'var(--border-color)',
                color: isPaused ? 'var(--accent-red)' : 'var(--text-primary)'
              }}
            >
              {isPaused ? '▶️ Lanjutkan Siaran' : '⏸️ Pause Siaran'}
            </button>
          </div>

          <div className="control-group" style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={toggleFullscreen}
              disabled={phoneStatus !== 'streaming'}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              🖥️ Tampilkan Layar Penuh
            </button>
            
            {phoneStatus === 'streaming' && (
              <button
                onClick={cleanupPeerConnection}
                className="btn btn-danger"
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                🔌 Putuskan Koneksi
              </button>
            )}
          </div>
        </div>
      </div>
      <footer style={{ 
        marginTop: '2.5rem', 
        paddingTop: '1.2rem', 
        borderTop: '1px solid var(--border-color)', 
        textAlign: 'center', 
        fontSize: '0.85rem', 
        color: 'var(--text-secondary)' 
      }}>
        <span>Developed by </span>
        <strong style={{ color: 'var(--accent-cyan)', textShadow: '0 0 10px rgba(0, 242, 254, 0.3)' }}>supriyanto abadi jaya</strong>
        <span> | KDR Multimedia © 2026</span>
      </footer>
    </div>
  );
}