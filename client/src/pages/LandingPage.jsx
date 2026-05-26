import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPublicInfo, getPublicSchedule, takeTicket } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

const DAYS_ORDER = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
const DAYS_LABEL = { senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu', minggu: 'Minggu' };
const POLI_LABEL = { umum: 'Poli Umum', gigi: 'Poli Gigi' };

// Hitung status buka/tutup klinik dan per-poli dari data jadwal
function getClinicStatus(schedule, now) {
  const dayNames = ['minggu','senin','selasa','rabu','kamis','jumat','sabtu'];
  const todayKey = dayNames[now.getDay()];
  const nowTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).replace('.', ':');

  const todaySchedule = schedule[todayKey] || [];

  const activeAll  = todaySchedule.filter(d => d.isActiveNow);
  const activeUmum = activeAll.filter(d => d.poli === 'umum');
  const activeGigi = activeAll.filter(d => d.poli === 'gigi');

  // Cari shift berikutnya hari ini (belum mulai)
  const upcomingToday = todaySchedule
    .filter(d => d.jam_mulai > nowTime)
    .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));

  const isKlinikOpen = activeAll.length > 0;
  const isUmumOpen   = activeUmum.length > 0;
  const isGigiOpen   = activeGigi.length > 0;

  // Jam buka pertama hari ini
  const firstShiftToday = todaySchedule.length > 0
    ? [...todaySchedule].sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai))[0]
    : null;

  // Jam tutup terakhir hari ini
  const lastShiftToday = todaySchedule.length > 0
    ? [...todaySchedule].sort((a, b) => b.jam_selesai.localeCompare(a.jam_selesai))[0]
    : null;

  const isBeforeOpen  = firstShiftToday && nowTime < firstShiftToday.jam_mulai;
  const isAfterClose  = lastShiftToday  && nowTime >= lastShiftToday.jam_selesai;
  const noScheduleToday = todaySchedule.length === 0;

  return {
    todayKey,
    isKlinikOpen,
    isUmumOpen,
    isGigiOpen,
    isBeforeOpen,
    isAfterClose,
    noScheduleToday,
    firstShiftToday,
    lastShiftToday,
    upcomingToday,
    activeUmum,
    activeGigi,
  };
}

export default function LandingPage() {
  const [info, setInfo] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(true);
  const [takingTicket, setTakingTicket] = useState(null);
  const [hasTicket, setHasTicket] = useState(false);
  const [activeTab, setActiveTab] = useState('semua');
  const [now, setNow] = useState(new Date());
  const [typedText, setTypedText] = useState('');
  const navigate = useNavigate();

  const fullText = 'Tanpa Ribet';

  // Typing animation effect
  useEffect(() => {
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setTypedText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 150); // Speed of typing (150ms per character)

    return () => clearInterval(typingInterval);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [infoRes, schedRes] = await Promise.all([getPublicInfo(), getPublicSchedule()]);
      setInfo(infoRes.data.data);
      setSchedule(schedRes.data.data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    const clockInterval = setInterval(() => setNow(new Date()), 30000);
    return () => { clearInterval(interval); clearInterval(clockInterval); };
  }, [fetchData]);

  useEffect(() => {
    const token = localStorage.getItem('klinikita_token');
    setHasTicket(!!token);
  }, []);

  useSocket(() => fetchData(), () => fetchData());

  const handleTakeTicket = async (poli) => {
    const existing = localStorage.getItem('klinikita_token');
    if (existing) { navigate('/ticket'); return; }
    setTakingTicket(poli);
    try {
      const res = await takeTicket(poli);
      const { access_token } = res.data.data;
      localStorage.setItem('klinikita_token', access_token);
      toast.success(`Tiket ${POLI_LABEL[poli]} berhasil diambil!`);
      navigate('/ticket');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal mengambil tiket.');
    } finally {
      setTakingTicket(null);
    }
  };

  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  const dayStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

  const filteredDays = activeTab === 'semua' ? DAYS_ORDER : [activeTab];

  // Hitung status klinik saat ini
  const clinicStatus = !loading ? getClinicStatus(schedule, now) : null;
  const isUmumOpen = clinicStatus?.isUmumOpen ?? true;
  const isGigiOpen = clinicStatus?.isGigiOpen ?? true;
  const isKlinikOpen = clinicStatus?.isKlinikOpen ?? true;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1f30 100%)' }}>
      {/* Navbar */}
      <nav style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 40, background: 'rgba(10,15,30,0.8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #0d9488, #0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏥</div>
          <div>
            <span style={{ fontSize: 20, fontWeight: 800, background: 'linear-gradient(135deg, #0d9488, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Klinikita</span>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: -2 }}>Sistem Antrean Digital</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 100,
            background: isKlinikOpen ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: isKlinikOpen ? '#4ade80' : '#f87171',
            border: `1px solid ${isKlinikOpen ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isKlinikOpen ? '#4ade80' : '#f87171', animation: isKlinikOpen ? 'pulse-ring 2s infinite' : 'none' }} />
            {loading ? '...' : isKlinikOpen ? 'Buka' : 'Tutup'}
          </div>
          <a href="/login" style={{ background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.3)', color: '#2dd4bf', borderRadius: 8, padding: '8px 16px', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>Login Staf</a>
        </div>
      </nav>

      {/* Clinic Status Banner */}
      {!loading && clinicStatus && (
        <div style={{
          background: isKlinikOpen
            ? 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.08))'
            : 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(220,38,38,0.08))',
          borderBottom: `1px solid ${isKlinikOpen ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          padding: '14px 24px',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            {/* Status utama */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: isKlinikOpen ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                border: `1px solid ${isKlinikOpen ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>
                {isKlinikOpen ? '🟢' : '🔴'}
              </div> */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 15, fontWeight: 800,
                    color: isKlinikOpen ? '#4ade80' : '#f87171',
                  }}>
                    {isKlinikOpen ? 'Klinik Sedang Buka' : 'Klinik Sedang Tutup'}
                  </span>
                  {isKlinikOpen && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'pulse-ring 2s infinite' }} />
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {clinicStatus.noScheduleToday
                    ? 'Tidak ada jadwal dokter hari ini.'
                    : clinicStatus.isAfterClose
                    ? `Layanan hari ini telah selesai pukul ${clinicStatus.lastShiftToday?.jam_selesai} WIB.`
                    : clinicStatus.isBeforeOpen
                    ? `Klinik akan buka pukul ${clinicStatus.firstShiftToday?.jam_mulai} WIB hari ini.`
                    : `Hari ini: ${DAYS_LABEL[clinicStatus.todayKey]} · ${timeStr} WIB`}
                </div>
              </div>
            </div>

            {/* Status per poli */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { poli: 'umum', label: 'Poli Umum', icon: '🩺', isOpen: isUmumOpen, active: clinicStatus.activeUmum },
                { poli: 'gigi', label: 'Poli Gigi',  icon: '🦷', isOpen: isGigiOpen, active: clinicStatus.activeGigi },
              ].map(({ poli, label, icon, isOpen, active }) => (
                <div key={poli} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 10,
                  background: isOpen ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${isOpen ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isOpen ? '#4ade80' : '#f87171' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {isOpen
                        ? `dr. ${active[0]?.nama_dokter} · s/d ${active[0]?.jam_selesai}`
                        : 'Tidak ada dokter aktif'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
                    background: isOpen ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)',
                    color: isOpen ? '#4ade80' : '#f87171',
                  }}>
                    {isOpen ? 'BUKA' : 'TUTUP'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section style={{ padding: '60px 24px 40px', maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 60px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
          Antrean Klinik
          <br />
          <span style={{ background: 'linear-gradient(135deg, #0d9488, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', position: 'relative' }}>
            {typedText}
            <span style={{ 
              display: 'inline-block',
              width: '3px',
              height: '1em',
              background: 'linear-gradient(135deg, #0d9488, #6366f1)',
              marginLeft: '4px',
              animation: 'blink 1s infinite',
              verticalAlign: 'middle'
            }} />
          </span>
        </h1>
        <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: 520, margin: '0 auto 40px', lineHeight: 1.7 }}>
          Ambil tiket antrean digital dari HP Anda. Pantau posisi antrean secara real-time 
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          {/* Tombol Poli Umum */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <button
              id="btn-tiket-umum"
              onClick={() => handleTakeTicket('umum')}
              disabled={!!takingTicket || (!hasTicket && !isUmumOpen)}
              style={{
                padding: '18px 36px',
                fontSize: 16,
                fontWeight: 700,
                borderRadius: 16,
                cursor: (!hasTicket && !isUmumOpen) ? 'not-allowed' : 'pointer',
                background: hasTicket
                  ? 'rgba(13,148,136,0.15)'
                  : !isUmumOpen
                  ? 'rgba(100,116,139,0.15)'
                  : 'linear-gradient(135deg, #0d9488, #0f766e)',
                color: hasTicket ? '#2dd4bf' : !isUmumOpen ? '#64748b' : 'white',
                border: hasTicket
                  ? '2px solid rgba(13,148,136,0.4)'
                  : !isUmumOpen
                  ? '2px solid rgba(100,116,139,0.3)'
                  : 'none',
                boxShadow: (!hasTicket && isUmumOpen) ? '0 8px 32px rgba(13,148,136,0.4)' : 'none',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 10,
                opacity: (!hasTicket && !isUmumOpen) ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 22 }}>🩺</span>
              {hasTicket
                ? 'Lihat Tiket Saya'
                : !isUmumOpen
                ? 'Poli Umum Tutup'
                : takingTicket === 'umum'
                ? 'Mengambil...'
                : 'Ambil Tiket Poli Umum'}
            </button>
            {!hasTicket && !isUmumOpen && clinicStatus && (
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                {clinicStatus.isBeforeOpen
                  ? `Buka pukul ${clinicStatus.firstShiftToday?.jam_mulai} WIB`
                  : 'Tidak ada dokter aktif saat ini'}
              </span>
            )}
          </div>

          {/* Tombol Poli Gigi */}
          {!hasTicket && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <button
                id="btn-tiket-gigi"
                onClick={() => handleTakeTicket('gigi')}
                disabled={!!takingTicket || !isGigiOpen}
                style={{
                  padding: '18px 36px',
                  fontSize: 16,
                  fontWeight: 700,
                  borderRadius: 16,
                  cursor: !isGigiOpen ? 'not-allowed' : 'pointer',
                  background: !isGigiOpen ? 'rgba(100,116,139,0.1)' : 'rgba(99,102,241,0.1)',
                  color: !isGigiOpen ? '#64748b' : '#a78bfa',
                  border: !isGigiOpen
                    ? '2px solid rgba(100,116,139,0.25)'
                    : '2px solid rgba(99,102,241,0.4)',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 10,
                  opacity: !isGigiOpen ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: 22 }}>🦷</span>
                {!isGigiOpen
                  ? 'Poli Gigi Tutup'
                  : takingTicket === 'gigi'
                  ? 'Mengambil...'
                  : 'Ambil Tiket Poli Gigi'}
              </button>
              {!isGigiOpen && clinicStatus && (
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                  {clinicStatus.isBeforeOpen
                    ? `Buka pukul ${clinicStatus.firstShiftToday?.jam_mulai} WIB`
                    : 'Tidak ada dokter aktif saat ini'}
                </span>
              )}
            </div>
          )}
        </div>

        {hasTicket && (
          <p style={{ fontSize: 13, color: '#94a3b8' }}>
            Anda sudah memiliki tiket aktif.{' '}
            <button onClick={() => navigate('/ticket')} style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Lihat tiket →</button>
          </p>
        )}
      </section>

      {/* Info Cards */}
      <section style={{ padding: '0 24px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { icon: '📍', label: 'Alamat', value: 'Jl. Prof. Soedarto, Tembalang, Jawa Tengah 50275' },
            { icon: '🕐', label: 'Senin – Sabtu', value: '08:00 – 21:00 WIB' },
            { icon: '🕐', label: 'Minggu', value: '08:00 – 16:30 WIB' },
            { icon: '📞', label: 'Kontak', value: '(024) 76480609' },
          ].map((item, i) => (
            <div key={i} className="glass" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginTop: 2 }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Doctor Schedule */}
      <section style={{ padding: '0 24px 60px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9' }}>Jadwal Dokter</h2>
            
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['semua', ...DAYS_ORDER].map(d => (
              <button
                key={d}
                onClick={() => setActiveTab(d)}
                className={`tab-btn ${activeTab === d ? 'active' : ''}`}
                style={{ fontSize: 12, padding: '6px 14px' }}
              >
                {d === 'semua' ? 'Semua Hari' : DAYS_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>
            <div style={{ width: 40, height: 40, border: '3px solid #0d9488', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            Memuat jadwal...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {filteredDays.map(day => (
              schedule[day] ? (
                <div key={day} className="glass" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(13,148,136,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>📅</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#2dd4bf' }}>{DAYS_LABEL[day]}</h3>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {['Dokter', 'Poli', 'Jam Mulai', 'Jam Selesai', 'Status'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {schedule[day].map((d, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>
                              dr. {d.nama_dokter}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 100, background: d.poli === 'umum' ? 'rgba(13,148,136,0.15)' : 'rgba(139,92,246,0.15)', color: d.poli === 'umum' ? '#2dd4bf' : '#c4b5fd', fontWeight: 600 }}>
                                {POLI_LABEL[d.poli]}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 14 }}>{d.jam_mulai}</td>
                            <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 14 }}>{d.jam_selesai}</td>
                            <td style={{ padding: '12px 16px' }}>
                              {d.isActiveNow ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 12px', borderRadius: 100, background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)', fontWeight: 600 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulse-ring 2s infinite' }} />
                                  Sedang Aktif
                                </span>
                              ) : (
                                <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, background: 'rgba(100,116,139,0.1)', color: '#64748b', fontWeight: 600 }}>
                                  Tidak Aktif
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px', textAlign: 'center', color: '#475569', fontSize: 13 }}>
        © 2026 Klinikita · Sistem Manajemen Klinik Digital
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(13,148,136,0.7); }
          70% { box-shadow: 0 0 0 8px rgba(13,148,136,0); }
          100% { box-shadow: 0 0 0 0 rgba(13,148,136,0); }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
