import React, { useState, useEffect } from 'react';

export default function SettingsModal({ onClose, showAlert }) {
  const [cfToken, setCfToken] = useState('');
  const [cfDomain, setCfDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const apiHost = window.location.port === '3000' 
          ? 'http://localhost:8080' 
          : '';
        const res = await fetch(`${apiHost}/api/settings/cloudflare`);
        const data = await res.json();
        if (data.token) {
          setCfToken(data.token);
        }
        if (data.domain) {
          setCfDomain(data.domain);
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      } finally {
        setIsFetching(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!cfToken.trim()) {
      showAlert('Token/ID Cloudflare tidak boleh kosong', 'error');
      return;
    }
    
    setIsLoading(true);
    try {
      const apiHost = window.location.port === '3000' 
        ? 'http://localhost:8080' 
        : '';
        
      const res = await fetch(`${apiHost}/api/settings/cloudflare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          token: cfToken.trim(),
          domain: cfDomain.trim()
        })
      });
      
      if (!res.ok) throw new Error('Gagal menyimpan');
      
      showAlert('Pengaturan berhasil disimpan! Tunnel sedang dimulai ulang...', 'info');
      onClose();
    } catch (err) {
      console.error(err);
      showAlert('Terjadi kesalahan saat menyimpan pengaturan', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 7, 12, 0.75)',
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
        maxWidth: '450px',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.2rem',
        animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1.2rem'
          }}
          className="hover-red"
        >
          ✕
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <span style={{ fontSize: '1.8rem' }}>⚙️</span>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>Pengaturan Server</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Konfigurasi Cloudflare Tunnel
            </p>
          </div>
        </div>

        {isFetching ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)' }}>
            Memuat...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                Cloudflare Tunnel ID / Token
              </label>
              <input
                type="text"
                value={cfToken}
                onChange={(e) => setCfToken(e.target.value)}
                placeholder="Masukkan Tunnel ID atau Token"
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.8rem',
                  fontSize: '0.9rem',
                  color: 'var(--accent-cyan)',
                  fontFamily: 'monospace',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-cyan)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
              />
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Tunnel ID (UUID) untuk login lokal, atau Cloudflare Token (eyJh...) untuk Zero Trust.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                Domain Cloudflare (Opsional)
              </label>
              <input
                type="text"
                value={cfDomain}
                onChange={(e) => setCfDomain(e.target.value)}
                placeholder="Misal: kamera.domainanda.com"
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.8rem',
                  fontSize: '0.9rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-cyan)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
              />
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Isi jika Anda menggunakan domain khusus agar link QR code sesuai.
              </p>
            </div>

            <button 
              onClick={handleSave}
              disabled={isLoading}
              className="btn btn-primary"
              style={{
                padding: '0.8rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                marginTop: '0.5rem',
                opacity: isLoading ? 0.7 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {isLoading ? 'Menyimpan...' : '💾 Simpan & Restart Tunnel'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
