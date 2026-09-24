import React, { useState, useEffect } from 'react';
import ReceiverView from './components/ReceiverView';
import SenderView from './components/SenderView';
import SettingsModal from './components/SettingsModal';

// Helper to detect mobile devices
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
    || (window.innerWidth <= 768);
};

export default function App() {
  const [role, setRole] = useState(null); // 'receiver' | 'sender'
  const [senderMode, setSenderMode] = useState(() => { const saved = localStorage.getItem('kdr_sender_mode'); return saved === 'network' || saved === 'srt' ? saved : null; }); // 'network' | 'srt'
  const [roomId, setRoomId] = useState('');
  const [roomPin, setRoomPin] = useState('');
  const [roomsList, setRoomsList] = useState([]); // Multiple rooms for dashboard
  const [viewMode, setViewMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlLayout = params.get('layout');
    if (urlLayout === 'grid') return 'grid';
    if (urlLayout === 'single') return 'single';

    const savedMode = localStorage.getItem('kdr_mirror_view_mode');
    if (savedMode === 'grid') return 'grid';
    return 'single';
  });
  const [inputRoomId, setInputRoomId] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [isObsView, setIsObsView] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);
  const [customAlert, setCustomAlert] = useState(null); // { message, type }
  const [showSettings, setShowSettings] = useState(false);

  const showAlert = (message, type = 'error') => {
    setCustomAlert({ message, type });
  };

  useEffect(() => {
    // 1. Parse URL Parameters
    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get('role'); // 'sender' or null (which defaults to receiver/PC)
    const urlRoom = params.get('room');
    const urlPin = params.get('pin');
    const urlView = params.get('view');

    setIsObsView(urlView === 'obs');

    const isMobile = isMobileDevice();

    // Determine Role & Room ID
    if (urlRole === 'sender' || isMobile) {
      setRole('sender');
      const urlMode = params.get('mode');
      if (urlMode === 'srt') setSenderMode('srt');
      else if (urlMode === 'network') setSenderMode('network');
      if (urlRoom) {
        setRoomId(urlRoom.toUpperCase());
      }
      if (urlPin) {
        setRoomPin(urlPin);
      }
    } else {
      setRole('receiver');
      let currentRoom = urlRoom;
      if (!currentRoom) {
        // Try localStorage first
        const savedRoom = localStorage.getItem('kdr_mirror_room_id');
        if (savedRoom) {
          currentRoom = savedRoom;
        } else {
          // Generate a persistent, random 6-character room code excluding confusing characters (I, L, 1, O, 0)
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let result = '';
          for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          currentRoom = result;
        }
      }
      setRoomId(currentRoom);
      
      // Load rooms list from localStorage if available
      const savedList = localStorage.getItem('kdr_mirror_rooms_list');
      if (savedList) {
        try {
          const parsed = JSON.parse(savedList);
          if (parsed && parsed.length > 0) {
            // Make sure currentRoom is included in the list
            if (!parsed.includes(currentRoom)) {
              parsed[0] = currentRoom;
            }
            setRoomsList(parsed);
          } else {
            setRoomsList([currentRoom]);
          }
        } catch (e) {
          setRoomsList([currentRoom]);
        }
      } else {
        setRoomsList([currentRoom]);
      }
      
      // Update URL on PC to persist the room code on reload (keep other parameters like view or layout)
      const queryParams = new URLSearchParams(window.location.search);
      queryParams.set('room', currentRoom);
      const newUrl = `${window.location.pathname}?${queryParams.toString()}`;
      window.history.replaceState(null, '', newUrl);
    }

    // 2. Fetch Server/Network Info for pairing
    let intervalId = null;
    const fetchServerInfo = async () => {
      try {
        const apiHost = window.location.port === '3000' 
          ? 'http://localhost:8080' 
          : ''; // Empty for unified production URL
        const response = await fetch(`${apiHost}/api/info`);
        const data = await response.json();
        setServerInfo(data);
        if (data && data.activeTunnelUrl && intervalId) {
          clearInterval(intervalId);
        }
      } catch (err) {
        console.warn('Could not fetch server network info. Using fallback IP config.', err);
      }
    };

    fetchServerInfo();
    
    // Poll every 3 seconds to check if the SSH tunnel becomes active
    intervalId = setInterval(fetchServerInfo, 3000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // Sync Room ID and Rooms List changes to localStorage
  useEffect(() => {
    if (role === 'receiver' && roomId) {
      localStorage.setItem('kdr_mirror_room_id', roomId);
    }
  }, [roomId, role]);

  useEffect(() => {
    if (role === 'receiver' && roomsList.length > 0) {
      localStorage.setItem('kdr_mirror_rooms_list', JSON.stringify(roomsList));
    }
  }, [roomsList, role]);

  useEffect(() => {
    if (role === 'receiver') {
      localStorage.setItem('kdr_mirror_view_mode', viewMode);

      // Update URL query parameters
      const params = new URLSearchParams(window.location.search);
      const currentLayout = params.get('layout');
      
      if (viewMode === 'grid' && currentLayout !== 'grid') {
        params.set('layout', 'grid');
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState(null, '', newUrl);
      } else if (viewMode === 'single' && currentLayout === 'grid') {
        params.delete('layout');
        let queryStr = params.toString();
        const newUrl = `${window.location.pathname}${queryStr ? `?${queryStr}` : ''}`;
        window.history.replaceState(null, '', newUrl);
      }
    }
  }, [viewMode, role]);

  // Handler to change room ID in single view
  const handleRoomIdChange = (newId) => {
    const cleanId = newId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanId.length >= 3) {
      setRoomId(cleanId);
      
      // Update roomsList
      if (roomsList.length > 0) {
        setRoomsList([cleanId, ...roomsList.slice(1)]);
      } else {
        setRoomsList([cleanId]);
      }

      // Update URL
      const params = new URLSearchParams(window.location.search);
      const urlView = params.get('view');
      const newUrl = `${window.location.pathname}?room=${cleanId}${urlView ? `&view=${urlView}` : ''}`;
      window.history.replaceState(null, '', newUrl);
    }
  };

  // Handler to change a specific room ID in grid view dashboard
  const handleGridRoomIdChange = (oldId, newId) => {
    const cleanId = newId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (cleanId.length >= 3) {
      // Prevent duplicates
      if (roomsList.includes(cleanId) && cleanId !== oldId) {
        showAlert('ID Room sudah digunakan di kamera lain!');
        return;
      }
      
      const newList = roomsList.map(rid => rid === oldId ? cleanId : rid);
      setRoomsList(newList);

      // If we edited the primary room (first in the list), update the main roomId state & URL
      if (oldId === roomId) {
        setRoomId(cleanId);
        const params = new URLSearchParams(window.location.search);
        const urlView = params.get('view');
        const newUrl = `${window.location.pathname}?room=${cleanId}${urlView ? `&view=${urlView}` : ''}`;
        window.history.replaceState(null, '', newUrl);
      }
    }
  };

  const handleJoinMobile = (e) => {
    e.preventDefault();
    if (inputRoomId.trim().length >= 3 && inputPin.trim().length >= 4) {
      setRoomId(inputRoomId.trim().toUpperCase());
      setRoomPin(inputPin.trim());
    }
  };

  if (!role) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#08090c', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', animation: 'blink 1s infinite alternate' }}>🌀</div>
          <p style={{ marginTop: '1rem', color: '#8f9cae' }}>Menyiapkan KDR Multimedia...</p>
        </div>
      </div>
    );
  }

  // Mobile sender: choose the transport before opening the camera.
  if (role === 'sender' && !senderMode) {
    return (
      <div style={{display:'flex',minHeight:'100vh',alignItems:'center',justifyContent:'center',backgroundColor:'#08090c',color:'#fff',padding:'1.2rem',boxSizing:'border-box'}}>
        <div className="glass-panel" style={{padding:'1.6rem',width:'100%',maxWidth:'430px',textAlign:'center',paddingTop:'calc(1.6rem + env(safe-area-inset-top))',paddingBottom:'calc(1.6rem + env(safe-area-inset-bottom))'}}>
          <div style={{fontSize:'3rem',marginBottom:'0.7rem'}}>📹</div>
          <h2 className="gradient-text glow-text" style={{fontSize:'1.65rem',marginBottom:'0.45rem'}}>KDR Multimedia</h2>
          <p style={{color:'var(--text-secondary)',fontSize:'0.85rem',margin:'0 0 1.25rem',lineHeight:1.5}}>Pilih cara menghubungkan kamera HP ke PC/OBS.</p>
          <button type="button" onClick={()=>{setSenderMode('network');localStorage.setItem('kdr_sender_mode','network')}} style={{width:'100%',textAlign:'left',padding:'1rem',marginBottom:'0.8rem',borderRadius:'14px',border:'1px solid rgba(0,242,254,0.22)',background:'rgba(0,242,254,0.06)',color:'#fff',cursor:'pointer'}}>
            <div style={{fontWeight:800,fontSize:'1rem'}}>🌐 KDR Network / WebRTC</div>
            <div style={{color:'var(--text-secondary)',fontSize:'0.78rem',marginTop:'0.3rem'}}>Hubungkan melalui Room dan PIN seperti sistem lama.</div>
          </button>
          <button type="button" onClick={()=>{setSenderMode('srt');localStorage.setItem('kdr_sender_mode','srt')}} style={{width:'100%',textAlign:'left',padding:'1rem',borderRadius:'14px',border:'1px solid rgba(0,242,254,0.45)',background:'linear-gradient(135deg,rgba(0,242,254,0.14),rgba(0,120,180,0.10))',color:'#fff',cursor:'pointer',boxShadow:'0 0 18px rgba(0,242,254,0.08)'}}>
            <div style={{fontWeight:800,fontSize:'1rem'}}>📡 SRT → OBS</div>
            <div style={{color:'var(--text-secondary)',fontSize:'0.78rem',marginTop:'0.3rem'}}>Streaming langsung ke OBS melalui jaringan lokal.</div>
          </button>
          <div style={{marginTop:'1.5rem',fontSize:'0.7rem',color:'var(--text-muted)',textTransform:'uppercase'}}>Dev: supriyanto abadi jaya</div>
        </div>
      </div>
    );
  }

  // Legacy KDR Network / WebRTC pairing.
  if (role === 'sender' && senderMode === 'network' && !roomId) {
    const handleBackFromPairing = () => {
      setSenderMode(null);
      localStorage.removeItem('kdr_sender_mode');
      const params = new URLSearchParams(window.location.search);
      params.delete('mode');
      params.delete('room');
      params.delete('pin');
      const query = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''));
    };
    return (
      <div style={{position:'relative',display:'flex',minHeight:'100vh',alignItems:'center',justifyContent:'center',backgroundColor:'#08090c',color:'#fff',padding:'1.5rem',boxSizing:'border-box'}}>
        <button
          type="button"
          onClick={handleBackFromPairing}
          aria-label="Kembali"
          title="Kembali"
          style={{
            position:'fixed',
            top:'calc(1rem + env(safe-area-inset-top))',
            left:'1rem',
            zIndex:20,
            width:'46px',
            height:'46px',
            borderRadius:'50%',
            border:'1px solid rgba(255,255,255,0.16)',
            background:'rgba(12,15,22,0.82)',
            color:'#fff',
            fontSize:'1.45rem',
            lineHeight:1,
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            boxShadow:'0 8px 24px rgba(0,0,0,0.35)',
            backdropFilter:'blur(12px)',
            WebkitBackdropFilter:'blur(12px)',
            cursor:'pointer'
          }}
        >
          ‹
        </button>
        <div className="glass-panel" style={{padding:'2rem',width:'100%',maxWidth:'400px',textAlign:'center'}}>
          <div style={{fontSize:'3rem',marginBottom:'1rem'}}>📹</div>
          <h2 className="gradient-text glow-text" style={{fontSize:'1.6rem',marginBottom:'0.5rem'}}>KDR Multimedia</h2>
          <p style={{color:'var(--text-secondary)',fontSize:'0.85rem',marginBottom:'2rem'}}>Hubungkan kamera HP Anda ke PC. Masukkan kode room yang tertera pada layar PC Anda.</p>
          <form onSubmit={handleJoinMobile} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',textAlign:'left'}}>
              <label style={{fontSize:'0.75rem',color:'var(--text-secondary)',textTransform:'uppercase',fontWeight:600}}>Kode Room PC</label>
              <input type="text" maxLength="8" placeholder="CONTOH: 3UETN9" value={inputRoomId} onChange={e=>setInputRoomId(e.target.value.toUpperCase())} style={{background:'rgba(0,0,0,0.4)',border:'1px solid var(--border-color)',borderRadius:'12px',padding:'1rem',fontSize:'1.3rem',color:'var(--accent-cyan)',textAlign:'center',fontFamily:'monospace',letterSpacing:'4px',outline:'none'}} />
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',textAlign:'left'}}>
              <label style={{fontSize:'0.75rem',color:'var(--text-secondary)',textTransform:'uppercase',fontWeight:600}}>PIN (4 Digit)</label>
              <input type="text" maxLength="4" placeholder="1234" value={inputPin} onChange={e=>setInputPin(e.target.value.replace(/[^0-9]/g,''))} style={{background:'rgba(0,0,0,0.4)',border:'1px solid var(--border-color)',borderRadius:'12px',padding:'1rem',fontSize:'1.3rem',color:'var(--accent-cyan)',textAlign:'center',fontFamily:'monospace',letterSpacing:'8px',outline:'none'}} />
            </div>
            <button type="submit" disabled={inputRoomId.trim().length<3 || inputPin.trim().length<4} className="btn btn-primary" style={{padding:'1rem',fontSize:'1rem',fontWeight:600,marginTop:'0.5rem',opacity:(inputRoomId.trim().length<3 || inputPin.trim().length<4)?0.5:1}}>🚀 Hubungkan Kamera</button>
          </form>
          <div style={{marginTop:'2rem',fontSize:'0.7rem',color:'var(--text-muted)',textTransform:'uppercase'}}>Dev: supriyanto abadi jaya</div>
        </div>
      </div>
    );
  }

  if (role === 'sender') {
    const senderRoom = senderMode === 'srt' ? (roomId || 'SRT') : roomId;
    const handleBackToModeSelector = () => {
      setSenderMode(null);
      localStorage.removeItem('kdr_sender_mode');
      const params = new URLSearchParams(window.location.search);
      params.delete('mode');
      const query = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''));
    };
    return <SenderView roomId={senderRoom} roomPin={roomPin} connectionMode={senderMode} onBackToModeSelector={handleBackToModeSelector} />;
  }

  // Receiver Mode: Multi-Camera Dashboard (Grid View)
  if (viewMode === 'grid' && !isObsView) {
    return (
      <>
        <div className="app-container">
        {/* Unified Dashboard Header */}
        <header className="app-header" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h1 className="gradient-text glow-text" style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📹</span> KDR Multi-Camera Dashboard
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
              Monitoring banyak kamera HP sekaligus dalam satu layar
            </p>
          </div>
          <div className="app-header-controls">
            <button 
              onClick={() => {
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                let result = '';
                for (let i = 0; i < 6; i++) {
                  result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                setRoomsList([...roomsList, result]);
              }}
              className="btn btn-primary"
              style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
            >
              ➕ Tambah Kamera
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="btn btn-secondary"
              style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
            >
              ⚙️ Pengaturan
            </button>
            <button 
              onClick={() => setViewMode('single')}
              className="btn btn-secondary"
              style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
            >
              📺 Mode Single
            </button>
          </div>
        </header>

        {/* Camera Grid */}
        <div className="camera-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', 
          gap: '1.5rem',
          flex: 1
        }}>
          {roomsList.map(id => (
            <ReceiverView 
              key={id} 
              roomId={id} 
              serverInfo={serverInfo} 
              layoutMode="grid" 
              onChangeRoomId={(newId) => handleGridRoomIdChange(id, newId)}
              onClose={() => {
                if (roomsList.length === 1) {
                  showAlert('Minimal harus ada 1 kamera di dashboard.');
                  return;
                }
                setRoomsList(roomsList.filter(rid => rid !== id));
              }}
            />
          ))}
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
      {customAlert && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 7, 12, 0.65)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '420px',
            padding: '2rem',
            textAlign: 'center',
            borderColor: customAlert.type === 'error' ? 'rgba(255, 51, 102, 0.4)' : 'rgba(0, 242, 254, 0.4)',
            boxShadow: customAlert.type === 'error' ? '0 8px 32px rgba(255, 51, 102, 0.2)' : '0 8px 32px rgba(0, 242, 254, 0.2)',
            transform: 'scale(1)',
            animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.2rem'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: customAlert.type === 'error' ? 'rgba(255, 51, 102, 0.1)' : 'rgba(0, 242, 254, 0.1)',
              border: `2px solid ${customAlert.type === 'error' ? 'var(--accent-red)' : 'var(--accent-cyan)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: `0 0 15px ${customAlert.type === 'error' ? 'rgba(255, 51, 102, 0.3)' : 'rgba(0, 242, 254, 0.3)'}`
            }}>
              {customAlert.type === 'error' ? '⚠️' : 'ℹ️'}
            </div>
            
            <div>
              <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fff', fontWeight: 600 }}>
                {customAlert.type === 'error' ? 'Pemberitahuan' : 'Informasi'}
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
                {customAlert.message}
              </p>
            </div>

            <button 
              onClick={() => setCustomAlert(null)}
              className="btn btn-primary"
              style={{
                background: customAlert.type === 'error' ? 'linear-gradient(135deg, #ff3366 0%, #ff6688 100%)' : undefined,
                boxShadow: customAlert.type === 'error' ? '0 4px 15px rgba(255, 51, 102, 0.3)' : undefined,
                padding: '0.6rem 2rem',
                fontSize: '0.9rem',
                minWidth: '120px',
                borderRadius: '8px',
                marginTop: '0.5rem',
                border: 'none',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          showAlert={showAlert} 
        />
      )}
      </>
    );
  }

  // Single Camera View (Default)
  return (
    <>
      <ReceiverView 
        roomId={roomId} 
        serverInfo={serverInfo} 
        isObsView={isObsView} 
        onChangeRoomId={handleRoomIdChange}
        onSwitchToGrid={() => setViewMode('grid')}
      />
      
      {!isObsView && (
        <button
          onClick={() => setShowSettings(true)}
          className="btn btn-secondary"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            padding: '0.8rem',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            zIndex: 9998
          }}
          title="Pengaturan"
        >
          ⚙️
        </button>
      )}

      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          showAlert={showAlert} 
        />
      )}

      {customAlert && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 7, 12, 0.65)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '420px',
            padding: '2rem',
            textAlign: 'center',
            borderColor: customAlert.type === 'error' ? 'rgba(255, 51, 102, 0.4)' : 'rgba(0, 242, 254, 0.4)',
            boxShadow: customAlert.type === 'error' ? '0 8px 32px rgba(255, 51, 102, 0.2)' : '0 8px 32px rgba(0, 242, 254, 0.2)',
            transform: 'scale(1)',
            animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.2rem'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: customAlert.type === 'error' ? 'rgba(255, 51, 102, 0.1)' : 'rgba(0, 242, 254, 0.1)',
              border: `2px solid ${customAlert.type === 'error' ? 'var(--accent-red)' : 'var(--accent-cyan)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: `0 0 15px ${customAlert.type === 'error' ? 'rgba(255, 51, 102, 0.3)' : 'rgba(0, 242, 254, 0.3)'}`
            }}>
              {customAlert.type === 'error' ? '⚠️' : 'ℹ️'}
            </div>
            
            <div>
              <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#fff', fontWeight: 600 }}>
                {customAlert.type === 'error' ? 'Pemberitahuan' : 'Informasi'}
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
                {customAlert.message}
              </p>
            </div>

            <button 
              onClick={() => setCustomAlert(null)}
              className="btn btn-primary"
              style={{
                background: customAlert.type === 'error' ? 'linear-gradient(135deg, #ff3366 0%, #ff6688 100%)' : undefined,
                boxShadow: customAlert.type === 'error' ? '0 4px 15px rgba(255, 51, 102, 0.3)' : undefined,
                padding: '0.6rem 2rem',
                fontSize: '0.9rem',
                minWidth: '120px',
                borderRadius: '8px',
                marginTop: '0.5rem',
                border: 'none',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}


