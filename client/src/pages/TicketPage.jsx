import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQueueStatus, getPatientPDFUrl } from '../services/api';
import { useSocket } from '../hooks/useSocket';

const STATUS_CONFIG = {
  menunggu: {
    label: 'Silakan menunggu, nomor Anda belum dipanggil.',
    color: '#94a3b8',
    numberColor: '#cbd5e1', // Light gray for number
    bg: 'rgba(100,116,139,0.15)',
    border: 'rgba(100,116,139,0.3)',
    icon: '⏳',
    emoji: '🪑',
  },
  dipanggil_admin: {
    label: '⚠️ Nomor Anda dipanggil! Segera menuju meja pendaftaran.',
    color: '#fbbf24',
    numberColor: '#fcd34d', // Darker yellow for better contrast
    bg: 'rgba(234,179,8,0.15)',
    border: 'rgba(234,179,8,0.5)',
    icon: '📢',
    emoji: '🏃',
  },
  menunggu_dokter: {
    label: 'Pendaftaran selesai. Menunggu giliran masuk ruang periksa.',
    color: '#60a5fa',
    numberColor: '#93c5fd', // Light blue for number
    bg: 'rgba(59,130,246,0.15)',
    border: 'rgba(59,130,246,0.3)',
    icon: '🏥',
    emoji: '💼',
  },
  diperiksa: {
    label: 'Silakan masuk ke ruang periksa sekarang.',
    color: '#a78bfa',
    numberColor: '#c4b5fd', // Lighter purple for better contrast
    bg: 'rgba(139,92,246,0.15)',
    border: 'rgba(139,92,246,0.5)',
    icon: '🩺',
    emoji: '👨‍⚕️',
  },
  selesai: {
    label: 'Pemeriksaan selesai. Terima kasih telah berkunjung.',
    color: '#4ade80',
    numberColor: '#86efac', // Light green for number
    bg: 'rgba(34,197,94,0.15)',
    border: 'rgba(34,197,94,0.3)',
    icon: '✅',
    emoji: '🎉',
  },
  skip: {
    label: 'Nomor Anda dilewati sementara. Tunggu pemanggilan ulang dari admin.',
    color: '#f87171',
    numberColor: '#fca5a5', // Light red for number
    bg: 'rgba(239,68,68,0.15)',
    border: 'rgba(239,68,68,0.3)',
    icon: '⏭️',
    emoji: '⚠️',
  },
};

const POLI_LABEL = { umum: 'Poli Umum', gigi: 'Poli Gigi' };

export default function TicketPage() {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [medicalRecordId, setMedicalRecordId] = useState(null);
  const navigate = useNavigate();

  const fetchStatus = async () => {
    const token = localStorage.getItem('klinikita_token');
    if (!token) { navigate('/'); return; }
    try {
      const res = await getQueueStatus(token);
      setTicket(res.data.data);
      
      // Check if medical record ID is stored
      const storedMrId = localStorage.getItem('klinikita_medical_record_id');
      if (storedMrId) {
        setMedicalRecordId(storedMrId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Tiket tidak ditemukan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useSocket((data) => {
    // When our ticket status changes, refresh
    if (ticket && data.queue_id === ticket.id) {
      setTicket(prev => prev ? { ...prev, status: data.status, doctor_name: data.doctor_name } : prev);
      
      // If status changed to 'selesai' and medical_record_id is provided, store it
      if (data.status === 'selesai' && data.medical_record_id) {
        localStorage.setItem('klinikita_medical_record_id', data.medical_record_id);
        setMedicalRecordId(data.medical_record_id);
      }
    } else if (!ticket) {
      fetchStatus();
    }
  }, null);

  const handleBack = () => navigate('/');

  const handleNewTicket = () => {
    localStorage.removeItem('klinikita_token');
    localStorage.removeItem('klinikita_medical_record_id');
    navigate('/');
  };

  const handleDownloadPDF = () => {
    const token = localStorage.getItem('klinikita_token');
    if (medicalRecordId && token) {
      window.open(getPatientPDFUrl(medicalRecordId, token), '_blank');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1f30 100%)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, border: '3px solid #0d9488', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
          <p style={{ color: '#64748b', fontSize: 15 }}>Memuat tiket Anda...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1f30 100%)', padding: 24 }}>
        <div className="glass" style={{ padding: 48, textAlign: 'center', maxWidth: 400, width: '100%' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Tiket Tidak Ditemukan</h2>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>{error}</p>
          <button onClick={handleBack} className="btn-primary" style={{ width: '100%' }}>Kembali ke Beranda</button>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[ticket?.status] || STATUS_CONFIG.menunggu;
  const isFinished = ticket?.status === 'selesai';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1f30 100%)', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <nav style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,15,30,0.8)', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #0d9488, #0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏥</div>
          <span style={{ fontSize: 18, fontWeight: 800, background: 'linear-gradient(135deg, #0d9488, #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Klinikita</span>
        </div>
        <button onClick={handleBack} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 8, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          ← Beranda
        </button>
      </nav>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ width: '100%', maxWidth: 480, animation: 'fadeInUp 0.5s ease' }}>

          {/* Ticket Card */}
          <div className="glass" style={{ padding: '40px 32px', textAlign: 'center', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
            {/* Decorative background glow */}
            <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${cfg.bg}, transparent 70%)`, filter: 'blur(30px)', pointerEvents: 'none' }} />

            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Tiket Antrean Digital
            </div>

            {/* Ticket number */}
            <div style={{
              fontSize: 'clamp(72px, 20vw, 100px)',
              fontWeight: 900,
              lineHeight: 1,
              marginBottom: 8,
              color: '#ffffff',
              textShadow: `
                0 0 60px ${cfg.color}80,
                0 0 30px ${cfg.color}60,
                0 4px 20px rgba(0,0,0,0.5),
                0 2px 4px rgba(0,0,0,0.8)
              `,
              letterSpacing: '-2px',
              filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.3))',
            }}>
              {ticket?.nomor_tiket}
            </div>

            {/* Poli badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 100, background: ticket?.poli === 'umum' ? 'rgba(13,148,136,0.15)' : 'rgba(139,92,246,0.15)', color: ticket?.poli === 'umum' ? '#2dd4bf' : '#c4b5fd', border: `1px solid ${ticket?.poli === 'umum' ? 'rgba(13,148,136,0.3)' : 'rgba(139,92,246,0.3)'}`, fontSize: 14, fontWeight: 600, marginBottom: 32 }}>
              {ticket?.poli === 'umum' ? '🩺' : '🦷'} {POLI_LABEL[ticket?.poli]}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', marginBottom: 28 }} />

            {/* Status card */}
            <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{cfg.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: cfg.color, lineHeight: 1.5 }}>
                {cfg.label}
              </div>
              {ticket?.doctor_name && (
                <div style={{ marginTop: 10, fontSize: 13, color: '#94a3b8' }}>
                  Dokter: <span style={{ fontWeight: 600, color: '#f1f5f9' }}>dr. {ticket.doctor_name}</span>
                </div>
              )}
            </div>

            {/* Live indicator */}
            {!isFinished && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 12, color: '#4ade80' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'pulse-ring 2s infinite' }} />
                Tunggu sebentar nyak, orang sabar disayang Tuhan!
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isFinished && medicalRecordId && (
              <button onClick={handleDownloadPDF} className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>📄</span>
                Unduh Rekam Medis (PDF)
              </button>
            )}
            <button onClick={handleBack} className="btn-secondary" style={{ width: '100%', padding: '14px', fontSize: 14 }}>
              ← Kembali ke Beranda
            </button>
            {isFinished && (
              <button onClick={handleNewTicket} className="btn-ghost" style={{ width: '100%', padding: '14px', fontSize: 14 }}>
                Ambil Tiket Baru
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.7); }
          70% { box-shadow: 0 0 0 8px rgba(74,222,128,0); }
          100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
        }
      `}</style>
    </div>
  );
}
