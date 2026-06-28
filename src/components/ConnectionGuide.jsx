import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export default function ConnectionGuide({ roomId, serverInfo, pin }) {
  const [activeTab, setActiveTab] = useState('tunnel');
  const [qrUrl, setQrUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Get active protocol, hostname and port
  const activeProtocol = window.location.protocol;
  const activeHost = window.location.host;
  const activePort = window.location.port || (activeProtocol === 'https:' ? '443' : '80');
  
  const roomPin = pin || '1234';

  // Define connection URLs
  const tunnelUrl = serverInfo && serverInfo.activeTunnelUrl
    ? `${serverInfo.activeTunnelUrl}/?room=${roomId}&pin=${roomPin}&role=sender`
    : '';

  const localIp = serverInfo ? serverInfo.localIp : window.location.hostname;
  const wifiIpUrl = `http://${localIp}:${activePort === '3000' ? '3000' : '8080'}/?room=${roomId}&pin=${roomPin}&role=sender`;

  const usbAndroidUrl = `http://localhost:${activePort === '3000' ? '3000' : '8080'}/?room=${roomId}&pin=${roomPin}&role=sender`;

  // For iPhone USB connection, they must use the HTTPS tunnel address over the USB Hotspot network interface 
  // because iOS Safari prohibits camera stream access over non-secure http://172.x.x.x addresses.
  const usbIphoneUrl = tunnelUrl || wifiIpUrl;

  // OBS URLs (Always offline local connections for 0ms latency)
  const localObsUrl = `http://localhost:${activePort === '3000' ? '3000' : '8080'}/?room=${roomId}&view=obs`;
  const wifiObsUrl = serverInfo 
    ? `http://${serverInfo.localIp}:${activePort === '3000' ? '3000' : '8080'}/?room=${roomId}&view=obs` 
    : localObsUrl;

  // Select appropriate OBS URL depending on active tab
  const obsUrlToShow = activeTab.includes('usb') ? localObsUrl : wifiObsUrl;

  // Auto-switch default tab to tunnel if active, otherwise fallback to local IP
  useEffect(() => {
    if (serverInfo && serverInfo.activeTunnelUrl) {
      setActiveTab('tunnel');
    } else {
      setActiveTab('wifi-ip');
    }
  }, [serverInfo]);

  // Update QR Code whenever connection URL changes
  useEffect(() => {
    let currentUrl = '';
    if (activeTab === 'tunnel') {
      currentUrl = tunnelUrl;
    } else if (activeTab === 'wifi-ip') {
      currentUrl = wifiIpUrl;
    } else if (activeTab === 'usb-android') {
      currentUrl = usbAndroidUrl;
    } else if (activeTab === 'usb-iphone') {
      currentUrl = usbIphoneUrl;
    }

    if (currentUrl) {
      QRCode.toDataURL(currentUrl, {
        width: 250,
        margin: 1,
        color: {
          dark: '#08090c',
          light: '#ffffff'
        }
      })
        .then(url => setQrUrl(url))
        .catch(err => console.error('Error generating QR Code:', err));
    }
  }, [activeTab, tunnelUrl, wifiIpUrl, usbAndroidUrl, usbIphoneUrl]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const adbCommand = `adb reverse tcp:3000 tcp:3000; adb reverse tcp:8080 tcp:8080`;

  return (
    <div className="glass-panel" style={{ padding: '1.8rem', marginTop: '1rem' }}>
      <h2 style={{ marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span>🔗</span> Hubungkan Kamera HP Anda
      </h2>

      {/* Tabs Layout */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
        gap: '0.5rem', 
        marginBottom: '1.5rem', 
        background: 'rgba(0,0,0,0.2)', 
        padding: '5px', 
        borderRadius: '10px' 
      }}>
        <button
          onClick={() => setActiveTab('tunnel')}
          className={`btn ${activeTab === 'tunnel' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.6rem 0.4rem', fontSize: '0.75rem', fontWeight: 600 }}
        >
          🌐 Tunneling (Rekomendasi)
        </button>
        <button
          onClick={() => setActiveTab('wifi-ip')}
          className={`btn ${activeTab === 'wifi-ip' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.6rem 0.4rem', fontSize: '0.75rem', fontWeight: 600 }}
        >
          📶 Wi-Fi IP Lokal (Offline)
        </button>
        <button
          onClick={() => setActiveTab('usb-android')}
          className={`btn ${activeTab === 'usb-android' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.6rem 0.4rem', fontSize: '0.75rem', fontWeight: 600 }}
        >
          🤖 USB (Android)
        </button>
        <button
          onClick={() => setActiveTab('usb-iphone')}
          className={`btn ${activeTab === 'usb-iphone' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.6rem 0.4rem', fontSize: '0.75rem', fontWeight: 600 }}
        >
          🍎 USB (iPhone/iOS)
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'tunnel' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.2rem', lineHeight: '1.4' }}>
            Menghubungkan HP melalui internet tunnel publik yang aman (HTTPS). <b>Bisa untuk Android & iPhone (Safari)</b> lintas jaringan / paket data seluler tanpa ribet konfigurasi sertifikat SSL.
          </p>

          {tunnelUrl ? (
            <div className="qr-container">
              <img src={qrUrl} alt="Scan QR Code Tunnel" className="qr-code-img" />
              <div style={{ width: '100%', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--accent-cyan)' }}>
                  {tunnelUrl}
                </span>
                <button 
                  onClick={() => copyToClipboard(tunnelUrl)}
                  className="btn btn-secondary" 
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: '60px' }}
                >
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.5rem', animation: 'blink 1s infinite alternate', marginBottom: '0.5rem' }}>🌀</div>
              Menghubungkan ke localhost.run Tunnel... (Mohon tunggu)
            </div>
          )}
        </div>
      )}

      {activeTab === 'wifi-ip' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.2rem', lineHeight: '1.4' }}>
            Koneksi lokal tanpa kuota internet via jaringan Wi-Fi. HP dan PC Anda wajib berada di **Wi-Fi yang sama**.
          </p>

          <div className="qr-container">
            <img src={qrUrl} alt="Scan QR Code Local IP" className="qr-code-img" />
            <div style={{ width: '100%', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--accent-cyan)' }}>
                {wifiIpUrl}
              </span>
              <button 
                onClick={() => copyToClipboard(wifiIpUrl)}
                className="btn btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: '60px' }}
              >
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: '1.2rem', textAlign: 'left', background: 'rgba(255, 51, 102, 0.05)', padding: '1rem', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderLeft: '3px solid var(--accent-red)', lineHeight: '1.4' }}>
            <span style={{ fontWeight: 600, color: 'var(--accent-red)', display: 'block', marginBottom: '0.3rem' }}>🔒 Pembatasan Keamanan Kamera Browser (HTTP):</span>
            Karena koneksi ini menggunakan protokol HTTP biasa, browser HP akan memblokir akses kamera.
            <div style={{ marginTop: '0.5rem' }}>
              • <b>Android (Chrome):</b> Buka tab baru di Chrome HP, ketik <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>. Masukkan alamat IP berikut ke kotak input: <code style={{ color: 'var(--accent-cyan)' }}>{wifiIpUrl.split('/?')[0]}</code>, ubah status ke <b>Enabled</b>, lalu klik <b>Relaunch</b>.
            </div>
            <div style={{ marginTop: '0.4rem' }}>
              • <b>iPhone (Safari):</b> Safari iOS <b>melarang keras</b> kamera di HTTP biasa. Pengguna iPhone **wajib** menggunakan metode <b>Tunneling (HTTPS)</b> di atas.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'usb-android' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.2rem', lineHeight: '1.4' }}>
            Koneksi via kabel data USB Android. Latensi mendekati <b>0ms (Tanpa Delay)</b>. Kamera otomatis dianggap aman oleh Chrome tanpa perlu setelan SSL/HTTPS!
          </p>

          <ol style={{ paddingLeft: '1.2rem', margin: '0 0 1.2rem 0', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            <li>Aktifkan <b>Opsi Pengembang (Developer Options)</b> dan nyalakan <b>USB Debugging</b> di HP Android Anda.</li>
            <li>Hubungkan HP ke PC menggunakan kabel data USB berkualitas baik.</li>
            <li>Jalankan perintah adb berikut di PowerShell / Command Prompt PC Anda untuk mem-forward port:</li>
          </ol>

          <div style={{ background: 'rgba(0,0,0,0.5)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem' }}>
            <code style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-cyan)', flex: 1, whiteSpace: 'nowrap', overflowX: 'auto', paddingBottom: '3px' }}>
              {adbCommand}
            </code>
            <button 
              onClick={() => copyToClipboard(adbCommand)}
              className="btn btn-secondary" 
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
            >
              {copied ? 'Tersalin' : 'Salin'}
            </button>
          </div>

          <ol start="4" style={{ paddingLeft: '1.2rem', margin: '0 0 1rem 0', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            <li>Buka browser Google Chrome di HP Anda, scan QR Code di bawah atau buka alamat:</li>
          </ol>

          <div className="qr-container">
            <img src={qrUrl} alt="Scan QR Code USB Android" className="qr-code-img" />
            <div style={{ width: '100%', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--accent-cyan)' }}>
                {usbAndroidUrl}
              </span>
              <button 
                onClick={() => copyToClipboard(usbAndroidUrl)}
                className="btn btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: '60px' }}
              >
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'usb-iphone' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.2rem', lineHeight: '1.4' }}>
            Koneksi kabel USB untuk iPhone menggunakan <b>Personal Hotspot (USB Only)</b>. Solusi terbaik untuk menghindari delay video di perangkat Apple!
          </p>

          <ol style={{ paddingLeft: '1.2rem', margin: '0 0 1.2rem 0', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            <li>Hubungkan iPhone ke PC menggunakan kabel data Lightning / USB-C asli/berkualitas.</li>
            <li>Di iPhone, buka <b>Pengaturan &rarr; Personal Hotspot (Pencadangan Pribadi)</b>. Nyalakan <b>"Izinkan Orang Lain Bergabung"</b>. Jika muncul dialog di iPhone Anda, pilih <b>"Percayai Komputer Ini" (Trust)</b> dan masukkan PIN Anda.</li>
            <li>Di iPhone, scan QR Code di bawah atau buka URL berikut di Safari browser:</li>
          </ol>

          {tunnelUrl ? (
            <div className="qr-container">
              <img src={qrUrl} alt="Scan QR Code USB iPhone" className="qr-code-img" />
              <div style={{ width: '100%', display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--accent-cyan)' }}>
                  {tunnelUrl}
                </span>
                <button 
                  onClick={() => copyToClipboard(tunnelUrl)}
                  className="btn btn-secondary" 
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: '60px' }}
                >
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              </div>
              <div style={{ marginTop: '0.8rem', fontSize: '0.8rem', color: 'var(--accent-cyan)', background: 'rgba(0, 242, 254, 0.05)', padding: '0.8rem', borderRadius: '8px', border: '1px solid rgba(0, 242, 254, 0.1)', lineHeight: '1.4' }}>
                💡 <b>Catatan Teknis:</b> Dengan membuka alamat HTTPS Tunnel di atas saat Hotspot USB aktif, browser Safari iOS Anda akan meloloskan izin kamera dengan aman (karena HTTPS), sementara transmisi data video akan berjalan super cepat melalui media fisik kabel USB!
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.5rem', animation: 'blink 1s infinite alternate', marginBottom: '0.5rem' }}>🌀</div>
              Menghubungkan ke localhost.run Tunnel... (Safari iOS mewajibkan link HTTPS untuk kamera)
            </div>
          )}
        </div>
      )}

      {/* OBS Studio Integration Guide */}
      <div style={{ marginTop: '1.8rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🎥</span> Tampilkan Langsung di OBS Studio (Browser Source)
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.8rem', lineHeight: '1.4' }}>
          Gunakan URL ini sebagai sumber <b>Browser Source</b> di OBS untuk mendapatkan input video murni tanpa tombol/panel kontrol (clean feed):
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0, 0, 0, 0.4)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--accent-cyan)' }}>
            {obsUrlToShow}
          </span>
          <button 
            onClick={() => copyToClipboard(obsUrlToShow)}
            className="btn btn-secondary" 
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minWidth: '60px' }}
          >
            {copied ? 'Tersalin' : 'Salin'}
          </button>
        </div>

        <div style={{ marginTop: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div style={{ background: 'rgba(255,255,255,0.01)', padding: '0.6rem', borderRadius: '6px' }}>
            <b>Cara menambahkan ke OBS:</b><br />
            1. Klik ikon <b>+</b> di panel <i>Sources</i>.<br />
            2. Pilih <b>Browser</b>.<br />
            3. Tempelkan URL yang disalin di atas.
          </div>
          <div style={{ background: 'rgba(255,255,255,0.01)', padding: '0.6rem', borderRadius: '6px' }}>
            <b>Setelan Resolusi OBS:</b><br />
            Atur Width ke <b>1920</b> dan Height ke <b>1080</b> (atau 1080x1920 jika mode Portrait / vertikal) di dalam properti Browser Source OBS.
          </div>
        </div>
      </div>
    </div>
  );
}
