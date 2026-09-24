import React, { useEffect, useRef, useState } from 'react';
import { KdrSrt } from '../native/SrtSender';

export default function SenderView({ roomId, roomPin, connectionMode = 'network' }) {
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

  // New features
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [activeFps, setActiveFps] = useState(() => Number(localStorage.getItem('kdr_camera_fps') || 30));
  const [qualityPreset, setQualityPreset] = useState(() => localStorage.getItem('kdr_camera_quality') || 'balanced');
  const [isTallyActive, setIsTallyActive] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [batteryCharging, setBatteryCharging] = useState(false);
  const [networkType, setNetworkType] = useState('NET');
  const [networkQuality, setNetworkQuality] = useState('');
  const [srtRunning, setSrtRunning] = useState(false);
  const [srtReconnecting, setSrtReconnecting] = useState(false);
  const [srtError, setSrtError] = useState(null);
  const [srtReconnectAttempt, setSrtReconnectAttempt] = useState(0);
  const [srtStartedAt, setSrtStartedAt] = useState(0);
  const [srtRuntime, setSrtRuntime] = useState(0);
  const [showSrtPanel, setShowSrtPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [srtEndpoint, setSrtEndpoint] = useState(() => localStorage.getItem('kdr_srt_endpoint') || 'srt://192.168.1.100:9000');
  const [srtStreamId, setSrtStreamId] = useState(() => localStorage.getItem('kdr_srt_stream_id') || `kdr-${roomId}`);
  const [srtLatency, setSrtLatency] = useState(() => Number(localStorage.getItem('kdr_srt_latency') || 120));
  const [srtBitrate, setSrtBitrate] = useState(() => Number(localStorage.getItem('kdr_srt_bitrate') || 4000000));
  const [srtPassphrase, setSrtPassphrase] = useState(() => localStorage.getItem('kdr_srt_passphrase') || '');
  const [srtHost, setSrtHost] = useState(() => {
    const endpoint = localStorage.getItem('kdr_srt_endpoint') || '';
    const match = endpoint.match(/^srt:\/\/([^:/?]+)(?::\d+)?/i);
    return localStorage.getItem('kdr_srt_host') || match?.[1] || '';
  });
  const [srtPort, setSrtPort] = useState(() => {
    const endpoint = localStorage.getItem('kdr_srt_endpoint') || '';
    const match = endpoint.match(/^srt:\/\/[^:]+:(\d+)/i);
    return localStorage.getItem('kdr_srt_port') || match?.[1] || '9000';
  });
  const [srtQrScanning, setSrtQrScanning] = useState(false);
  const [srtTestState, setSrtTestState] = useState('');
  const [srtProfiles, setSrtProfiles] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('kdr_srt_profiles') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (_) {
      return [];
    }
  });
  const [activeSrtProfile, setActiveSrtProfile] = useState(() => localStorage.getItem('kdr_srt_active_profile') || '');
  const [newSrtProfileName, setNewSrtProfileName] = useState('');

  useEffect(() => {
    let battery = null;
    const updateBattery = () => {
      if (!battery) return;
      setBatteryLevel(Math.round(battery.level * 100));
      setBatteryCharging(Boolean(battery.charging));
    };
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        battery = b;
        updateBattery();
        b.addEventListener('levelchange', updateBattery);
        b.addEventListener('chargingchange', updateBattery);
      }).catch(() => {});
    }
    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', updateBattery);
        battery.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  const batteryIcon = batteryCharging ? '⚡' : batteryLevel === null ? '🔋' : batteryLevel <= 15 ? '🪫' : batteryLevel <= 35 ? '🔋' : '🔋';

  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return;
    const updateNetwork = () => {
      const type = connection.effectiveType || connection.type || 'NET';
      const label = String(type).toUpperCase();
      setNetworkType(label === '4G' ? '4G' : label === '5G' ? '5G' : label);
      setNetworkQuality(connection.downlink ? connection.downlink + ' Mbps' : '');
    };
    updateNetwork();
    connection.addEventListener?.('change', updateNetwork);
    return () => connection.removeEventListener?.('change', updateNetwork);
  }, []);



  const localVideoRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const queuedCandidatesRef = useRef([]);
  const wakeLockRef = useRef(null);

  const formatSrtDuration = (ms) => {
    const total = Math.floor(Math.max(0, ms) / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return [hours, minutes, seconds].map((value, index) => index === 0 ? String(value).padStart(2, '0') : String(value).padStart(2, '0')).join(':');
  };

  const qualityPresets = {
    performance: { label: 'HEMAT DATA', resolution: '720p', fps: 24, bitrate: 2000000 },
    balanced: { label: 'SEIMBANG', resolution: '1080p', fps: 30, bitrate: 4000000 },
    quality: { label: 'KUALITAS', resolution: '1080p', fps: 60, bitrate: 6000000 },
    ultra: { label: 'ULTRA', resolution: '4k', fps: 30, bitrate: 8000000 }
  };

  const applyQualityPreset = (key) => {
    const preset = qualityPresets[key] || qualityPresets.balanced;
    setQualityPreset(key);
    setActiveResolution(preset.resolution);
    setActiveFps(preset.fps);
    setSrtBitrate(preset.bitrate);
    localStorage.setItem('kdr_camera_quality', key);
    localStorage.setItem('kdr_camera_fps', String(preset.fps));
    localStorage.setItem('kdr_srt_bitrate', String(preset.bitrate));
  };

  const srtDimensions = activeResolution === '720p'
    ? { width: 1280, height: 720 }
    : activeResolution === '4k'
      ? { width: 3840, height: 2160 }
      : { width: 1920, height: 1080 };

  const persistSrtProfiles = (profiles) => {
    setSrtProfiles(profiles);
    localStorage.setItem('kdr_srt_profiles', JSON.stringify(profiles));
  };

  const applySrtProfile = (profile) => {
    if (!profile) return;
    setActiveSrtProfile(profile.name);
    localStorage.setItem('kdr_srt_active_profile', profile.name);
    setSrtEndpoint(profile.endpoint || '');
    setSrtStreamId(profile.streamId || '');
    setSrtLatency(Number(profile.latencyMs || 120));
    setSrtBitrate(Number(profile.bitrate || 4000000));
    setSrtPassphrase(profile.passphrase || '');
    setSrtError(null);
  };

  const saveSrtProfile = () => {
    const name = newSrtProfileName.trim();
    const endpoint = srtEndpoint.trim();
    if (!name) {
      setSrtError('Nama profil SRT wajib diisi.');
      return;
    }
    if (!/^srt:\/\//i.test(endpoint)) {
      setSrtError('Endpoint harus diawali srt://');
      return;
    }
    const profile = {
      name,
      endpoint,
      streamId: srtStreamId.trim() || 'kdr-' + roomId,
      latencyMs: Number(srtLatency) || 120,
      bitrate: Number(srtBitrate) || 4000000,
      passphrase: srtPassphrase
    };
    const next = [...srtProfiles.filter((item) => item.name !== name), profile];
    persistSrtProfiles(next);
    setActiveSrtProfile(name);
    localStorage.setItem('kdr_srt_active_profile', name);
    setNewSrtProfileName('');
    setSrtError(null);
  };

  const deleteSrtProfile = (name) => {
    const next = srtProfiles.filter((item) => item.name !== name);
    persistSrtProfiles(next);
    if (activeSrtProfile === name) {
      setActiveSrtProfile('');
      localStorage.removeItem('kdr_srt_active_profile');
    }
  };

  const buildSrtEndpoint = (host, port) => {
    const cleanHost = String(host || '').trim().replace(/^srt:\/\//i, '').replace(/\/.*$/, '');
    const cleanPort = String(port || '9000').trim();
    if (!cleanHost || !/^\d{1,5}$/.test(cleanPort)) return '';
    return `srt://${cleanHost}:${cleanPort}`;
  };

  const applySrtEndpoint = (host, port) => {
    const endpoint = buildSrtEndpoint(host, port);
    if (!endpoint) return false;
    setSrtHost(host);
    setSrtPort(String(port));
    setSrtEndpoint(endpoint);
    localStorage.setItem('kdr_srt_host', host);
    localStorage.setItem('kdr_srt_port', String(port));
    localStorage.setItem('kdr_srt_endpoint', endpoint);
    return true;
  };

  const parseSrtQr = (raw) => {
    const value = String(raw || '').trim();
    try {
      const parsed = JSON.parse(value);
      const host = parsed.host || parsed.ip || parsed.pcIp;
      const port = parsed.port || 9000;
      if (host && applySrtEndpoint(host, port)) return true;
    } catch (_) {}
    try {
      const url = new URL(value);
      if (url.protocol === 'srt:' || url.protocol === 'kdr-srt:') {
        const host = url.hostname;
        const port = url.port || '9000';
        if (host && applySrtEndpoint(host, port)) return true;
      }
    } catch (_) {}
    const match = value.match(/(?:srt:\/\/)?([\w.-]+)(?::(\d{1,5}))?/i);
    if (match && applySrtEndpoint(match[1], match[2] || '9000')) return true;
    return false;
  };

  const scanSrtQr = async () => {
    if (!('BarcodeDetector' in window)) {
      setSrtError('Scanner QR belum tersedia di perangkat/browser ini. Masukkan IP PC secara manual.');
      return;
    }
    setSrtQrScanning(true);
    setSrtError(null);
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const started = Date.now();
      while (Date.now() - started < 20000) {
        if (!localVideoRef.current || localVideoRef.current.readyState < 2) {
          await new Promise(r => setTimeout(r, 250));
          continue;
        }
        const codes = await detector.detect(localVideoRef.current);
        if (codes?.length) {
          if (!parseSrtQr(codes[0].rawValue)) throw new Error('QR bukan konfigurasi KDR SRT yang valid.');
          setSrtQrScanning(false);
          setSrtError(null);
          return;
        }
        await new Promise(r => setTimeout(r, 250));
      }
      throw new Error('QR tidak terdeteksi dalam 20 detik.');
    } catch (err) {
      setSrtQrScanning(false);
      setSrtError(err?.message || 'Gagal membaca QR OBS.');
    }
  };

  const testSrtConnection = async () => {
    const endpoint = srtEndpoint.trim();
    if (!/^srt:\/\/[^\s:]+:\d{1,5}$/i.test(endpoint)) {
      setSrtTestState('FORMAT SALAH');
      setSrtError('Isi IP PC dan port SRT terlebih dahulu.');
      return;
    }
    setSrtTestState('MENGETES...');
    setSrtError(null);
    try {
      const result = await KdrSrt.start({
        endpoint,
        streamId: srtStreamId.trim() || 'kdr-' + roomId,
        passphrase: srtPassphrase.trim() || undefined,
        latencyMs: Number(srtLatency),
        width: srtDimensions.width,
        height: srtDimensions.height,
        fps: Number(activeFps),
        bitrate: Number(srtBitrate),
        audio: Boolean(isAudioEnabled)
      });
      const ok = Boolean(result?.running);
      setSrtTestState(ok ? 'SRT SIAP' : 'GAGAL');
      if (ok) {
        await new Promise(r => setTimeout(r, 1800));
        try { await KdrSrt.stop(); } catch (_) {}
        setStatus('Tes SRT selesai. Kamera siap.');
      } else {
        setSrtError(result?.error || 'Native SRT tidak berhasil dimulai.');
      }
    } catch (err) {
      setSrtTestState('GAGAL');
      setSrtError(err?.message || 'Tes SRT gagal.');
    } finally {
      setTimeout(() => setSrtTestState(''), 2500);
    }
  };

  const startNativeSrt = async () => {
    const endpoint = srtEndpoint.trim();
    if (!/^srt:\/\//i.test(endpoint)) {
      setSrtError('Endpoint harus diawali srt://');
      return;
    }
    try {
      setSrtError(null);
      localStorage.setItem('kdr_srt_endpoint', endpoint);
      localStorage.setItem('kdr_srt_stream_id', srtStreamId.trim() || 'kdr-' + roomId);
      localStorage.setItem('kdr_srt_latency', String(srtLatency));
      localStorage.setItem('kdr_srt_bitrate', String(srtBitrate));
      localStorage.setItem('kdr_srt_passphrase', srtPassphrase);
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      stopAllMedia();
      setStatus('Memulai SRT native...');
      const result = await KdrSrt.start({
        endpoint,
        streamId: srtStreamId.trim() || 'kdr-' + roomId,
        passphrase: srtPassphrase.trim() || undefined,
        latencyMs: Number(srtLatency),
        width: srtDimensions.width,
        height: srtDimensions.height,
        fps: Number(activeFps),
        bitrate: Number(srtBitrate),
        audio: Boolean(isAudioEnabled)
      });
      setSrtRunning(Boolean(result?.running));
      setSrtReconnecting(Boolean(result?.reconnecting));
      setSrtReconnectAttempt(Number(result?.reconnectAttempt || 0));
      setSrtStartedAt(Number(result?.startedAt || 0));
      setSrtRuntime(result?.startedAt ? Math.max(0, Date.now() - Number(result.startedAt)) : 0);
      setSrtError(result?.error || null);
      setStatus(result?.reconnecting ? 'SRT reconnecting...' : 'SRT LIVE');
    } catch (err) {
      setSrtRunning(false);
      setSrtError(err?.message || 'Gagal memulai SRT');
      setStatus('SRT gagal: ' + (err?.message || 'error'));
    }
  };

  const stopNativeSrt = async () => {
    try { await KdrSrt.stop(); } catch (err) { setSrtError(err?.message || 'Gagal menghentikan SRT'); }
    setSrtRunning(false);
    setSrtReconnecting(false);
    setSrtReconnectAttempt(0);
    setSrtStartedAt(0);
    setSrtRuntime(0);
    setStatus('SRT berhenti. Membuka kembali kamera...');
    await setupCamera(activeCamera, activeResolution, activeFps, isAudioEnabled);
  };

  useEffect(() => {
    if (!srtRunning) return;
    const timer = setInterval(async () => {
      try {
        const result = await KdrSrt.status();
        setSrtRunning(Boolean(result?.running));
        setSrtReconnecting(Boolean(result?.reconnecting));
        setSrtReconnectAttempt(Number(result?.reconnectAttempt || 0));
        setSrtStartedAt(Number(result?.startedAt || 0));
        setSrtRuntime(result?.startedAt ? Math.max(0, Date.now() - Number(result.startedAt)) : 0);
        setSrtError(result?.error || null);
        if (result?.running) setStatus(result?.reconnecting ? 'SRT RECONNECTING' : 'SRT LIVE');
      } catch (_) {}
    }, 1500);
    return () => clearInterval(timer);
  }, [srtRunning]);

  useEffect(() => {
    if (!srtRunning || !srtStartedAt) {
      setSrtRuntime(0);
      return;
    }
    const timer = setInterval(() => {
      setSrtRuntime(Math.max(0, Date.now() - srtStartedAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [srtRunning, srtStartedAt]);

  // Screen Wake Lock API
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('[WakeLock] Screen Wake Lock is active');
          
          wakeLockRef.current.addEventListener('release', () => {
            console.log('[WakeLock] Screen Wake Lock was released');
          });
        }
      } catch (err) {
        console.warn(`[WakeLock] Failed: ${err.name}, ${err.message}`);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLockRef.current !== null) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
    // KDR Camera connection: prefer explicit server from pairing QR,
    // then local LAN, and only use the current host as a final fallback.
    const params = new URLSearchParams(window.location.search);
    const savedServer = localStorage.getItem('kdr_camera_server_url');
    const serverUrl = params.get('server') || savedServer || null;

    if (serverUrl) {
      localStorage.setItem('kdr_camera_server_url', serverUrl);
    }

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
      setStatus(reconnectAttempt > 0 ? `Menyambungkan kembali (${reconnectAttempt})...` : 'Menghubungkan ke server...');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt = 0;
        setConnected(true);
        setStatus('Terhubung ke Server. Menunggu PC...');
        ws.send(JSON.stringify({
          type: 'join',
          roomId,
          data: { clientType: 'sender', pin: roomPin }
        }));
      };

      ws.onclose = () => {
        setConnected(false);
        if (disposed) return;
        setStatus('Koneksi terputus. Mencoba kembali...');
        reconnectAttempt = Math.min(reconnectAttempt + 1, 10);
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempt - 1), 8000);
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onmessage = async (messageText) => {
      try {
        const message = JSON.parse(messageText.data);
        const { type, data, message: errorMsg } = message;

        switch (type) {
          case 'error':
            setStatus(`Koneksi Ditolak: ${errorMsg}`);
            setMediaErrorType('permission'); // Reusing permission error screen to show the error
            if (wsRef.current) wsRef.current.close();
            break;

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
              // Send active settings to PC so it updates its controls to match
              sendActiveSettings();
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

    };

    // SRT mode does not use the legacy Room/WebRTC connection.
    setupCamera(activeCamera, activeResolution);
    if (connectionMode === 'srt') {
      return () => {
        disposed = true;
        stopAllMedia();
        if (pcRef.current) pcRef.current.close();
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopAllMedia();
      if (wsRef.current) wsRef.current.close();
      if (pcRef.current) pcRef.current.close();
    };
  }, [roomId, connectionMode]);

  // Clean up media tracks
  const stopAllMedia = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Get constraints based on camera and resolution selection
  const getCameraConstraints = (camera, resolution, fps, audio) => {
    const constraints = {
      audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
      video: {
        facingMode: camera === 'user' ? 'user' : { ideal: 'environment' },
        frameRate: { ideal: fps, max: 60 }
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

  // Send current active settings to PC
  const sendActiveSettings = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'control',
        roomId,
        data: {
          action: 'active-settings',
          value: {
            camera: activeCamera,
            resolution: activeResolution,
            fps: activeFps,
            audio: isAudioEnabled,
            tally: isTallyActive,
            flash: torchOn,
            zoom: zoomValue,
            focusMode: currentFocusMode,
            isPaused: isPaused
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
  const applyPause = async (shouldPause) => {
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

    // Always renegotiate WebRTC when resuming to recover from potential network drops or TURN server timeouts
    if (!shouldPause && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      await initiateWebRTCConnection();
    }
  };

  // Setup Mobile Camera
  const setupCamera = async (camera, resolution, fps = activeFps, audio = isAudioEnabled) => {
    if (!navigator.mediaDevices) {
      setMediaErrorType('insecure');
      setStatus('Gagal: Browser memblokir akses media (SSL/HTTPS diperlukan).');
      return;
    }
    try {
      setStatus(camera === 'screen' ? 'Memulai berbagi layar...' : 'Membuka kamera...');
      stopAllMedia();

      let stream;
      if (camera === 'screen') {
        if (!navigator.mediaDevices.getDisplayMedia) {
          throw new Error('Screen sharing tidak didukung di browser ini.');
        }
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: audio });
        // Handle if user stops screen sharing via browser UI
        stream.getVideoTracks()[0].onended = () => {
          setupCamera('environment', activeResolution, activeFps, isAudioEnabled);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'control',
              roomId,
              data: { action: 'camera-switched-local', value: 'environment' }
            }));
          }
        };
      } else {
        if (!navigator.mediaDevices.getUserMedia) throw new Error('getUserMedia not supported');
        const constraints = getCameraConstraints(camera, resolution, fps, audio);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }
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
      setActiveFps(fps);
      setIsAudioEnabled(audio);
      setStatus('Kamera siap. Memulai streaming...');

      // Reset pause state on new camera initialization
      setIsPaused(false);

      // Report active settings to receiver
      sendActiveSettings();

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
        if (track.kind === 'video') {
          track.contentHint = 'motion';
        }
        const sender = pc.addTrack(track, streamRef.current);

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
          await setupCamera(value, activeResolution, activeFps, isAudioEnabled);
        }
        break;

      case 'set-resolution':
        if (value !== activeResolution) {
          await setupCamera(activeCamera, value, activeFps, isAudioEnabled);
        }
        break;

      case 'set-fps':
        if (value !== activeFps) {
          await setupCamera(activeCamera, activeResolution, value, isAudioEnabled);
        }
        break;

      case 'toggle-audio':
        if (value !== isAudioEnabled) {
          await setupCamera(activeCamera, activeResolution, activeFps, value);
        }
        break;

      case 'tally-light':
        setIsTallyActive(value);
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
        const targetFps = value.fps || activeFps;
        const targetAudio = value.audio !== undefined ? value.audio : isAudioEnabled;
        
        if (targetCam !== activeCamera || targetRes !== activeResolution || targetFps !== activeFps || targetAudio !== isAudioEnabled || !streamRef.current) {
          await setupCamera(targetCam, targetRes, targetFps, targetAudio);
        }
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
    <div className="mobile-view" style={isTallyActive ? { border: '6px solid red', boxSizing: 'border-box' } : {}}>
      {isTallyActive && (
        <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'red', color: 'white', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', zIndex: 999, animation: 'blink 1s infinite alternate', boxShadow: '0 0 10px rgba(255,0,0,0.8)' }}>
          🔴 LIVE
        </div>
      )}
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
        <div 
          onClick={() => applyPause(false)}
          style={{
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
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'blink 1.2s infinite alternate' }}>▶️</span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--accent-cyan)', margin: 0 }}>SIARAN DI-PAUSE</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Ketuk layar HP Anda untuk melanjutkan siaran</p>
        </div>
      )}

      {/* Floating UI Overlays */}
      <div className="mobile-overlay">
        {/* Top Header */}
        <div className="mobile-header">
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              📹 KDR Multimedia
            </span>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.72)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              {connectionMode === 'srt' ? 'SRT → OBS' : `Room: ${roomId}`} • {activeResolution.toUpperCase()} • {activeFps} FPS
            </span>
          </div>
          <div className={`badge ${connectionMode === 'srt' ? (srtRunning ? 'badge-connected' : 'badge-disconnected') : (connected ? 'badge-connected' : 'badge-disconnected')}`} style={{ backdropFilter: 'blur(10px)' }}>
            <span className={`badge-dot ${(connectionMode === 'srt' ? srtRunning : connected) ? 'blink' : ''}`}></span>
            {connectionMode === 'srt' ? (srtReconnecting ? 'SRT RETRY' : (srtRunning ? 'SRT LIVE' : 'SRT READY')) : (connected ? 'ONLINE' : 'OFFLINE')}
            <span style={{marginLeft:'0.6rem',fontSize:'0.72rem',fontWeight:700,color:batteryLevel !== null && batteryLevel <= 15 ? '#ff6b6b' : 'inherit'}}>{batteryIcon} {batteryLevel === null ? '--' : batteryLevel + '%'}{batteryCharging ? ' CHG' : ''}</span>
          </div>
          <div style={{position:'absolute',top:'3.65rem',right:'1rem',display:'flex',gap:'0.45rem',alignItems:'center',padding:'0.35rem 0.55rem',borderRadius:'10px',background:'rgba(0,0,0,0.52)',backdropFilter:'blur(8px)',fontSize:'0.68rem',fontFamily:'monospace',color:'rgba(255,255,255,0.82)'}}>
            <span>📶 {networkType}</span>
            {networkQuality && <span>↓ {networkQuality}</span>}
            <span>• {Math.round(Number(srtBitrate)/1000000)} Mbps</span>
          </div>
        </div>

        {/* Native SRT controls */}
        <div style={{ position: 'absolute', top: '5.05rem', left: '0.8rem', right: '0.8rem', zIndex: 20 }}>
          <button onClick={() => setShowSrtPanel(v => !v)} style={{ width: '100%', minHeight: '42px', padding: '0.55rem 0.8rem', borderRadius: '14px', border: srtRunning ? '1px solid rgba(255,70,70,0.45)' : '1px solid rgba(0,242,254,0.25)', background: srtRunning ? 'rgba(90,12,16,0.72)' : 'rgba(0,0,0,0.58)', color: '#fff', backdropFilter: 'blur(14px)', boxShadow: '0 8px 24px rgba(0,0,0,0.22)', fontWeight: 800, letterSpacing: '0.02em' }}>
            {srtRunning ? (srtReconnecting ? '🟠 SRT RECONNECTING' : '🔴 SRT LIVE') : '📡 SRT STREAM'} {showSrtPanel ? '▲' : '▼'}
          </button>
          {showSrtPanel && (
            <div className="glass-panel kdr-settings-sheet" style={{ position:'absolute', top:'3.15rem', left:0, right:0, maxHeight:'min(62vh, 560px)', overflowY:'auto', marginTop:0, padding:'1rem', borderRadius:'20px', background:'rgba(7,9,13,0.97)', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 20px 60px rgba(0,0,0,0.55)', backdropFilter:'blur(22px)' }}>
              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingBottom:'0.15rem'}}>
                  <div><div style={{fontSize:'0.82rem',fontWeight:900,color:'#fff'}}>📡 SRT OUTPUT</div><div style={{fontSize:'0.62rem',color:'rgba(255,255,255,0.48)',marginTop:'0.12rem'}}>Koneksi kamera → OBS • pengaturan tersimpan</div></div>
                  <div style={{display:'inline-flex',alignItems:'center',gap:'0.35rem',padding:'0.28rem 0.5rem',borderRadius:'999px',background:srtRunning?'rgba(255,55,55,0.14)':'rgba(0,242,254,0.08)',border:srtRunning?'1px solid rgba(255,70,70,0.28)':'1px solid rgba(0,242,254,0.18)',fontSize:'0.6rem',fontWeight:800,color:'#fff'}}><span style={{width:6,height:6,borderRadius:'50%',background:srtRunning?'#ff4545':'#00f2fe',boxShadow:srtRunning?'0 0 8px #ff4545':'none'}} />{srtRunning ? (srtReconnecting ? 'RETRY' : 'LIVE') : 'READY'}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.45rem' }}>
                  <select
                    className="control-select"
                    value={activeSrtProfile}
                    onChange={e => {
                      const profile = srtProfiles.find((item) => item.name === e.target.value);
                      if (profile) applySrtProfile(profile);
                    }}
                    disabled={srtRunning}
                  >
                    <option value="">Profil SRT manual</option>
                    {srtProfiles.map((profile) => <option key={profile.name} value={profile.name}>{profile.name}</option>)}
                  </select>
                  {activeSrtProfile && !srtRunning && (
                    <button
                      type="button"
                      onClick={() => deleteSrtProfile(activeSrtProfile)}
                      title="Hapus profil"
                      style={{ borderRadius: '10px', border: '1px solid rgba(255,80,100,0.35)', background: 'rgba(255,60,80,0.12)', color: '#fff', padding: '0 0.7rem' }}
                    >🗑️</button>
                  )}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 100px', gap:'0.45rem' }}>
                  <input className="control-input" value={srtHost} onChange={e => { setSrtHost(e.target.value); applySrtEndpoint(e.target.value, srtPort); }} placeholder="IP PC / Host OBS" disabled={srtRunning} />
                  <input className="control-input" value={srtPort} onChange={e => { setSrtPort(e.target.value); applySrtEndpoint(srtHost, e.target.value); }} inputMode="numeric" placeholder="9000" disabled={srtRunning} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'0.45rem' }}>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-secondary)', alignSelf:'center' }}>{srtEndpoint || 'srt://IP-PC:9000'}</div>
                  <button type="button" onClick={scanSrtQr} disabled={srtRunning || srtQrScanning} style={{ borderRadius:'10px', border:'1px solid rgba(0,242,254,0.35)', background:'rgba(0,242,254,0.10)', color:'#fff', padding:'0.55rem 0.7rem', fontWeight:700 }}>{srtQrScanning ? '📷 MENCARI QR...' : '📷 SCAN QR OBS'}</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.45rem'}}><div style={{padding:'0.55rem 0.65rem',borderRadius:'12px',background:'rgba(255,255,255,0.045)',border:'1px solid rgba(255,255,255,0.08)'}}><div style={{fontSize:'0.58rem',color:'rgba(255,255,255,0.42)',letterSpacing:'0.05em'}}>ENDPOINT</div><div style={{fontSize:'0.66rem',fontFamily:'monospace',color:'#fff',marginTop:'0.15rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{srtEndpoint || 'srt://IP-PC:9000'}</div></div><div style={{padding:'0.55rem 0.65rem',borderRadius:'12px',background:'rgba(255,255,255,0.045)',border:'1px solid rgba(255,255,255,0.08)'}}><div style={{fontSize:'0.58rem',color:'rgba(255,255,255,0.42)',letterSpacing:'0.05em'}}>TARGET</div><div style={{fontSize:'0.66rem',color:'#fff',marginTop:'0.15rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{srtStreamId || 'kdr-stream'}</div></div></div><input className="control-input" value={srtStreamId} onChange={e => setSrtStreamId(e.target.value)} placeholder="Stream ID" disabled={srtRunning} />
                <input className="control-input" type="password" value={srtPassphrase} onChange={e => setSrtPassphrase(e.target.value)} placeholder="Passphrase (opsional)" disabled={srtRunning} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                  <input className="control-input" type="number" min="20" max="1000" value={srtLatency} onChange={e => setSrtLatency(Number(e.target.value))} placeholder="Latency ms" disabled={srtRunning} />
                  <select className="control-select" value={srtBitrate} onChange={e => setSrtBitrate(Number(e.target.value))} disabled={srtRunning}>
                    <option value={2000000}>2 Mbps</option><option value={4000000}>4 Mbps</option><option value={6000000}>6 Mbps</option><option value={8000000}>8 Mbps</option>
                  </select>
                </div>
                {!srtRunning && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.45rem' }}>
                    <input
                      className="control-input"
                      value={newSrtProfileName}
                      onChange={e => setNewSrtProfileName(e.target.value)}
                      placeholder="Nama profil, contoh: OBS Aula"
                    />
                    <button
                      type="button"
                      onClick={saveSrtProfile}
                      style={{ borderRadius: '10px', border: '1px solid rgba(0,242,254,0.3)', background: 'rgba(0,242,254,0.1)', color: '#fff', padding: '0 0.8rem', fontWeight: 700 }}
                    >💾 SIMPAN</button>
                  </div>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.45rem' }}>
                  <div>
                    <div style={{fontSize:'0.68rem',color:'var(--text-secondary)',marginBottom:'0.25rem'}}>PRESET KUALITAS</div>
                    <select className="control-select" value={qualityPreset} onChange={e=>applyQualityPreset(e.target.value)} disabled={srtRunning}>
                      {Object.entries(qualityPresets).map(([key,p])=><option key={key} value={key}>{p.label} • {p.resolution.toUpperCase()} {p.fps}FPS</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{fontSize:'0.68rem',color:'var(--text-secondary)',marginBottom:'0.25rem'}}>AUDIO</div>
                    <button type="button" className={`btn ${isAudioEnabled ? 'btn-primary' : 'btn-secondary'}`} style={{width:'100%',padding:'0.7rem'}} onClick={async()=>{const next=!isAudioEnabled;setIsAudioEnabled(next);if(!srtRunning){try{await setupCamera(activeCamera,activeResolution,activeFps,next);}catch(_){} }}} disabled={srtRunning}>{isAudioEnabled?'🎙️ AUDIO ON':'🔇 AUDIO OFF'}</button>
                  </div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{activeResolution.toUpperCase()} • {activeFps} FPS • {Math.round(Number(srtBitrate) / 1000000)} Mbps • Audio {isAudioEnabled ? 'ON' : 'OFF'}</div>
                {srtRunning && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', fontSize: '0.72rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.82)' }}>
                    <div>STATUS: {srtReconnecting ? 'RECONNECTING' : 'CONNECTED'}</div>
                    <div>RETRY: {srtReconnectAttempt}</div>
                    <div>DURASI: {formatSrtDuration(srtRuntime)}</div>
                    <div>LATENCY: {srtLatency} ms</div>
                  </div>
                )}
                {srtError && <div style={{ color: 'var(--accent-red)', fontSize: '0.75rem' }}>⚠️ {srtError}</div>}
                {!srtRunning && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1.2fr',gap:'0.45rem'}}>
                    <button className="btn btn-secondary" onClick={testSrtConnection}>🔎 TES KONEKSI</button>
                    <button className="btn btn-primary" onClick={startNativeSrt}>🔴 MULAI SRT</button>
                  </div>
                )}
                {srtRunning && <button className="btn btn-danger" onClick={stopNativeSrt}>⏹ STOP SRT</button>}
                {srtTestState && <div style={{fontSize:'0.72rem',color:srtTestState==='SRT SIAP'?'var(--accent-green)':'var(--accent-cyan)',fontWeight:700}}>● {srtTestState}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Camera quick controls */}
        {(zoomSupported || focusSupported) && (
          <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',bottom:'8.9rem',zIndex:18,display:'flex',alignItems:'center',gap:'0.45rem',padding:'0.4rem 0.55rem',borderRadius:'14px',background:'rgba(0,0,0,0.58)',backdropFilter:'blur(10px)',border:'1px solid rgba(255,255,255,0.12)'}}>
            {zoomSupported && (
              <>
                <button type="button" onClick={()=>applyZoom(Math.max(zoomRange.min, zoomValue-zoomRange.step))} style={{width:32,height:32,border:0,borderRadius:10,background:'rgba(255,255,255,0.12)',color:'#fff',fontSize:'1.1rem'}}>−</button>
                <div style={{minWidth:44,textAlign:'center',fontSize:'0.72rem',fontWeight:800,color:'#fff'}}>{zoomValue.toFixed(1)}×</div>
                <button type="button" onClick={()=>applyZoom(Math.min(zoomRange.max, zoomValue+zoomRange.step))} style={{width:32,height:32,border:0,borderRadius:10,background:'rgba(255,255,255,0.12)',color:'#fff',fontSize:'1.1rem'}}>+</button>
              </>
            )}
            {focusSupported && (
              <select value={currentFocusMode} onChange={e=>applyFocusMode(e.target.value)} style={{height:32,maxWidth:115,borderRadius:10,border:'1px solid rgba(255,255,255,0.14)',background:'rgba(0,0,0,0.45)',color:'#fff',padding:'0 0.4rem',fontSize:'0.68rem'}}>
                {focusModes.map(mode=><option key={mode} value={mode}>{mode}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Center status message */}
        <div style={{ alignSelf: 'center', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div className="mobile-status-toast">
            {status}
          </div>
        </div>

        {/* Live / Tally status strip */}
        <div style={{position:'absolute',top:'5.9rem',left:'1rem',right:'1rem',zIndex:19,display:'flex',justifyContent:'space-between',alignItems:'center',pointerEvents:'none'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:'0.45rem',padding:'0.32rem 0.58rem',borderRadius:'10px',background:'rgba(0,0,0,0.52)',backdropFilter:'blur(8px)',fontSize:'0.66rem',fontWeight:800,color:'#fff',letterSpacing:'0.04em'}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:srtRunning?'#ff3b3b':'rgba(255,255,255,0.35)',boxShadow:srtRunning?'0 0 12px #ff3b3b':'none',animation:srtRunning?'kdrPulse 1.2s infinite':'none'}} />
            {srtRunning ? (srtReconnecting ? 'RECONNECTING' : 'LIVE') : 'STANDBY'}
          </div>
          {srtError && (
            <div style={{maxWidth:'62%',padding:'0.32rem 0.58rem',borderRadius:'10px',background:'rgba(120,0,0,0.72)',fontSize:'0.62rem',fontWeight:700,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              ⚠ {srtError}
            </div>
          )}
        </div>

        <style>{`
          @keyframes kdrPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.45; transform:scale(.82); } }
          @keyframes kdrSheetIn { from { opacity:0; transform:translateY(12px) scale(.985); } to { opacity:1; transform:translateY(0) scale(1); } }
          .kdr-settings-sheet { animation:kdrSheetIn .18s ease-out; }
          .kdr-tap { transition:transform .12s ease, opacity .12s ease; }
          .kdr-tap:active { transform:scale(.96); opacity:.88; }
        `}</style>

        {/* Camera settings bottom sheet */}
        {showSettings && (
          <div className="kdr-settings-sheet" style={{position:'absolute',left:'0.7rem',right:'0.7rem',bottom:'7.15rem',zIndex:30,maxHeight:'60vh',overflowY:'auto',padding:'1rem',borderRadius:'22px',background:'rgba(7,9,13,0.97)',border:'1px solid rgba(255,255,255,0.13)',backdropFilter:'blur(22px)',boxShadow:'0 22px 60px rgba(0,0,0,0.58)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.7rem'}}>
              <div><div style={{fontWeight:900,color:'#fff',fontSize:'0.86rem'}}>⚙️ PENGATURAN KAMERA</div><div style={{fontSize:'0.62rem',color:'rgba(255,255,255,0.48)',marginTop:'0.18rem'}}>Kontrol gambar, frame rate, audio & zoom</div></div>
              <button type="button" onClick={()=>setShowSettings(false)} style={{width:34,height:34,border:0,borderRadius:12,background:'rgba(255,255,255,0.1)',color:'#fff',fontSize:'1rem'}}>✕</button>
            </div>
            <div style={{display:'grid',gap:'0.65rem'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                <div><div style={{fontSize:'0.65rem',color:'rgba(255,255,255,0.5)',marginBottom:'0.25rem'}}>KAMERA</div><select className="control-select" value={activeCamera} onChange={e=>{setActiveCamera(e.target.value);setupCamera(e.target.value,activeResolution,activeFps,isAudioEnabled)}} disabled={srtRunning}><option value="environment">BELAKANG</option><option value="user">DEPAN</option>{connectionMode!=='srt'&&<option value="screen">LAYAR</option>}</select></div>
                <div><div style={{fontSize:'0.65rem',color:'rgba(255,255,255,0.5)',marginBottom:'0.25rem'}}>RESOLUSI</div><select className="control-select" value={activeResolution} onChange={e=>{setActiveResolution(e.target.value);setupCamera(activeCamera,e.target.value,activeFps,isAudioEnabled)}} disabled={srtRunning}><option value="720p">720p HD</option><option value="1080p">1080p FHD</option><option value="4k">4K UHD</option></select></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                <div><div style={{fontSize:'0.65rem',color:'rgba(255,255,255,0.5)',marginBottom:'0.25rem'}}>FRAME RATE</div><select className="control-select" value={activeFps} onChange={e=>{const v=Number(e.target.value);setActiveFps(v);localStorage.setItem('kdr_camera_fps',String(v));setupCamera(activeCamera,activeResolution,v,isAudioEnabled)}} disabled={srtRunning}><option value="24">24 FPS</option><option value="30">30 FPS</option><option value="60">60 FPS</option></select></div>
                <div><div style={{fontSize:'0.65rem',color:'rgba(255,255,255,0.5)',marginBottom:'0.25rem'}}>KUALITAS</div><select className="control-select" value={qualityPreset} onChange={e=>applyQualityPreset(e.target.value)} disabled={srtRunning}>{Object.entries(qualityPresets).map(([key,p])=><option key={key} value={key}>{p.label}</option>)}</select></div>
              </div>
              <button type="button" className={`btn ${isAudioEnabled?'btn-primary':'btn-secondary'}`} onClick={async()=>{const next=!isAudioEnabled;setIsAudioEnabled(next);if(!srtRunning){try{await setupCamera(activeCamera,activeResolution,activeFps,next)}catch(_){} }}} disabled={srtRunning}>{isAudioEnabled?'🎙️ AUDIO ON':'🔇 AUDIO OFF'}</button>
              {zoomSupported && <div><div style={{fontSize:'0.65rem',color:'rgba(255,255,255,0.5)',marginBottom:'0.25rem'}}>ZOOM • {zoomValue.toFixed(1)}×</div><input type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step} value={zoomValue} onChange={e=>applyZoom(e.target.value)} style={{width:'100%'}} /></div>}
            </div>
          </div>
        )}

        {/* Primary LIVE control */}
        {connectionMode === 'srt' && (
          <div style={{position:'absolute',bottom:'11.9rem',left:'50%',transform:'translateX(-50%)',zIndex:20}}>
            <button type="button" onClick={srtRunning ? stopNativeSrt : startNativeSrt} disabled={srtReconnecting}
              style={{minWidth:'150px',height:'48px',padding:'0 1.1rem',borderRadius:'24px',border:'2px solid rgba(255,255,255,0.22)',background:srtRunning ? 'rgba(190,35,35,0.92)' : 'rgba(18,18,22,0.88)',color:'#fff',fontWeight:900,fontSize:'0.86rem',letterSpacing:'0.04em',boxShadow:srtRunning ? '0 0 22px rgba(255,60,60,0.32)' : '0 8px 24px rgba(0,0,0,0.35)',backdropFilter:'blur(10px)',opacity:srtReconnecting?0.65:1}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:'0.45rem'}}>
                <span style={{width:10,height:10,borderRadius:'50%',background:srtRunning?'#ff4d4d':'#fff',boxShadow:srtRunning?'0 0 10px #ff4d4d':'none'}} />
                {srtRunning ? (srtReconnecting ? 'RECONNECTING' : 'STOP LIVE') : 'START LIVE'}
              </span>
            </button>
            <div style={{textAlign:'center',marginTop:'0.28rem',fontSize:'0.62rem',color:'rgba(255,255,255,0.68)',fontFamily:'monospace'}}>
              {srtRunning ? (String(Math.floor(srtRuntime/60000)).padStart(2,'0') + ':' + String(Math.floor((srtRuntime/1000)%60)).padStart(2,'0') + ' • ' + Math.round(Number(srtBitrate)/1000000) + ' Mbps') : 'SRT → OBS'}
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div className="mobile-footer">
          {/* Active stats */}
          <div style={{ display: 'flex', gap: '0.72rem', alignItems:'center', background: 'rgba(0, 0, 0, 0.56)', padding: '0.42rem 0.72rem', borderRadius: '14px', fontSize: '0.64rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.82)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter:'blur(12px)', maxWidth:'calc(100vw - 1.4rem)', overflow:'hidden' }}>
            <div>CAM: {activeCamera === 'screen' ? 'LAYAR' : (activeCamera === 'environment' ? 'BELAKANG' : 'DEPAN')}</div>
            <div>RES: {activeResolution}</div>
            <div>FPS: {activeFps}</div>
            <div>NET: {networkType}</div>
          </div>

          <div style={{display:'flex',gap:'0.55rem',alignItems:'center',justifyContent:'center',width:'100%',padding:'0.28rem 0.4rem',borderRadius:'22px',background:'rgba(0,0,0,0.34)',border:'1px solid rgba(255,255,255,0.08)',backdropFilter:'blur(10px)'}}>            <button type="button" onClick={()=>setShowSettings(v=>!v)} className="mobile-btn-circle kdr-tap" title="Pengaturan" style={{width:'48px',height:'48px',background:showSettings?'rgba(0,242,254,0.2)':'rgba(255,255,255,0.12)'}}><span style={{fontSize:'1.2rem'}}>⚙️</span></button>
            <button
              onClick={() => {
                const nextAudio = !isAudioEnabled;
                setupCamera(activeCamera, activeResolution, activeFps, nextAudio);
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'control',
                    roomId,
                    data: { action: 'audio-switched-local', value: nextAudio }
                  }));
                }
              }}
              className={`mobile-btn-circle kdr-tap ${isAudioEnabled ? 'active' : ''}`}
              title="Toggle Microphone"
              style={{ backgroundColor: isAudioEnabled ? 'var(--accent-green)' : 'rgba(255, 255, 255, 0.15)' }}
            >
              <span style={{ fontSize: '1.25rem' }}>{isAudioEnabled ? '🎙️' : '🔇'}</span>
            </button>

            {/* Screen Share / Torch toggle */}
            {activeCamera !== 'screen' && torchSupported ? (
              <button
                onClick={() => setFlashlight(!torchOn)}
                className={`mobile-btn-circle ${torchOn ? 'active' : ''}`}
                title="Toggle Flashlight"
              >
                <span style={{ fontSize: '1.25rem' }}>🔦</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  const nextCam = activeCamera === 'screen' ? 'environment' : 'screen';
                  setupCamera(nextCam, activeResolution);
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                      type: 'control',
                      roomId,
                      data: { action: 'camera-switched-local', value: nextCam }
                    }));
                  }
                }}
                className={`mobile-btn-circle kdr-tap ${activeCamera === 'screen' ? 'active' : ''}`}
                title="Screen Share"
                style={{ backgroundColor: activeCamera === 'screen' ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.15)' }}
              >
                <span style={{ fontSize: '1.4rem' }}>📱</span>
              </button>
            )}

            {/* Flip camera */}
            <button
              onClick={toggleCameraLocal}
              className="mobile-btn-circle kdr-tap"
              style={{ width: '58px', height: '58px', background: 'rgba(255, 255, 255, 0.18)', boxShadow:'0 4px 16px rgba(0,0,0,0.22)' }}
              title="Flip Camera"
            >
              <span style={{ fontSize: '1.45rem' }}>🔄</span>
            </button>

            {/* Pause toggle button */}
            <button
              onClick={() => applyPause(!isPaused)}
              className={`mobile-btn-circle kdr-tap ${isPaused ? 'active' : ''}`}
              style={{ backgroundColor: isPaused ? 'var(--accent-red)' : 'rgba(255, 255, 255, 0.15)' }}
              title={isPaused ? 'Mulai Streaming' : 'Tangguhkan Streaming'}
            >
              <span style={{ fontSize: '1.25rem' }}>{isPaused ? '▶️' : '⏸️'}</span>
            </button>
          </div>

          <span style={{ fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.28)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.15rem' }}>
            KDR MULTIMEDIA • CAMERA
          </span>
        </div>
      </div>
    </div>
  );
}
