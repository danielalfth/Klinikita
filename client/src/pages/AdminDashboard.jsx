import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import {
  getAdminQueues, callQueue, skipQueue, recallQueue, assignQueue,
  searchPatients, createPatient, getActiveDoctors,
  getAllMedicalRecords, getAdminPDFUrl,
} from '../services/api';
import toast from 'react-hot-toast';

const S_LABEL = { menunggu:'Menunggu', dipanggil_admin:'Dipanggil', menunggu_dokter:'Antri Dokter', diperiksa:'Diperiksa', selesai:'Selesai', skip:'Dilewati' };
const S_CLASS = { menunggu:'badge-menunggu', dipanggil_admin:'badge-dipanggil_admin', menunggu_dokter:'badge-menunggu_dokter', diperiksa:'badge-diperiksa', selesai:'badge-selesai', skip:'badge-skip' };
const labelS = { fontSize:12, fontWeight:600, color:'#71717a', textTransform:'uppercase', letterSpacing:'0.04em', display:'block', marginBottom:6 };
const sep = { borderTop:'1px solid rgba(255,255,255,0.06)', margin:'0' };

/* ── Rekam Medis Panel (Admin — read-only) ─────────────────────── */
function RecordsPanel() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [query, setQuery]     = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    getAllMedicalRecords(query)
      .then(r => setRecords(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <input className="input-field" placeholder="🔍 Cari nama pasien, NIK, atau diagnosis…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#52525b' }}>
          <div style={{ width:32, height:32, border:'2px solid #3f3f46', borderTopColor:'#fafafa', borderRadius:'50%', animation:'spin 0.9s linear infinite', margin:'0 auto 12px' }} />
          Memuat rekam medis…
        </div>
      ) : records.length === 0 ? (
        <div className="glass" style={{ padding:48, textAlign:'center', color:'#52525b' }}>
          <div style={{ fontSize:36, marginBottom:10 }}>🗂</div>
          <p>{query ? `Tidak ada hasil untuk "${query}"` : 'Belum ada rekam medis.'}</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {records.map(r => {
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="glass" style={{ padding:'16px 20px', transition:'all 0.2s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <div style={{ fontWeight:600, fontSize:14, color:'#fafafa' }}>{r.nama_lengkap}</div>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:r.poli==='umum'?'rgba(59,130,246,0.1)':'rgba(168,85,247,0.1)', color:r.poli==='umum'?'#60a5fa':'#c084fc', border:`1px solid ${r.poli==='umum'?'rgba(59,130,246,0.2)':'rgba(168,85,247,0.2)'}`, fontWeight:600 }}>
                        {r.poli === 'umum' ? '🏥 Umum' : '🦷 Gigi'}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:'#71717a', marginTop:3 }}>
                      NIK: {r.nik} · {r.usia} thn · {r.jenis_kelamin === 'laki_laki' ? 'L' : 'P'}
                    </div>
                    <div style={{ fontSize:12, color:'#a1a1aa', marginTop:4 }}>
                      dr. {r.nama_dokter} · Tiket {r.nomor_tiket}
                    </div>
                    <div style={{ fontSize:12, color:'#52525b', marginTop:2 }}>
                      📅 {new Date(r.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
                    <a href={getAdminPDFUrl(r.id)} target="_blank" rel="noreferrer"
                      style={{ fontSize:12, padding:'6px 14px', borderRadius:6, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#a1a1aa', textDecoration:'none', fontWeight:500, transition:'all 0.15s' }}
                      onMouseEnter={e => { e.target.style.background='rgba(255,255,255,0.1)'; e.target.style.color='#fafafa'; }}
                      onMouseLeave={e => { e.target.style.background='rgba(255,255,255,0.06)'; e.target.style.color='#a1a1aa'; }}>
                      📄 PDF
                    </a>
                    <button onClick={() => setExpandedId(isExpanded ? null : r.id)} 
                      style={{ fontSize:12, padding:'6px 14px', borderRadius:6, background:'transparent', border:'1px solid rgba(255,255,255,0.1)', color:'#a1a1aa', cursor:'pointer', fontWeight:500, transition:'all 0.15s' }}
                      onMouseEnter={e => { e.target.style.background='rgba(255,255,255,0.05)'; e.target.style.color='#fafafa'; }}
                      onMouseLeave={e => { e.target.style.background='transparent'; e.target.style.color='#a1a1aa'; }}>
                      {isExpanded ? '▲ Tutup' : '▼ Detail'}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <>
                    <hr style={{ borderTop:'1px solid rgba(255,255,255,0.06)', margin:'12px 0' }} />
                    <div style={{ fontSize:13, color:'#a1a1aa', display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ background:'rgba(255,255,255,0.02)', padding:'10px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color:'#71717a', fontWeight:600, display:'block', marginBottom:4 }}>📋 Diagnosis</span>
                        <span>{r.diagnosis}</span>
                      </div>
                      <div style={{ background:'rgba(255,255,255,0.02)', padding:'10px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color:'#71717a', fontWeight:600, display:'block', marginBottom:4 }}>💬 Hasil Konsultasi</span>
                        <span>{r.hasil_konsultasi}</span>
                      </div>
                      {r.prescriptions?.length > 0 && (
                        <div style={{ background:'rgba(255,255,255,0.02)', padding:'10px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ color:'#71717a', fontWeight:600, display:'block', marginBottom:6 }}>💊 Resep Obat</span>
                          <ul style={{ paddingLeft:18, display:'flex', flexDirection:'column', gap:3 }}>
                            {r.prescriptions.map((p,i) => (
                              <li key={i} style={{ fontSize:12 }}>
                                <span style={{ fontWeight:600, color:'#e4e4e7' }}>{p.nama_obat}</span> — {p.dosis_aturan}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Patient Modal ─────────────────────────────────────────────── */
function PatientModal({ queue, onClose, onAssigned }) {
  const [step, setStep]                   = useState('search');
  const [searchQ, setSearchQ]             = useState('');
  const [searching, setSearching]         = useState(false);
  const [foundPatients, setFoundPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [newForm, setNewForm]             = useState({ nik:'', nama_lengkap:'', tanggal_lahir:'', usia:'', jenis_kelamin:'laki_laki', alamat:'', nomor_telepon:'' });
  const [keluhan, setKeluhan]             = useState('');
  const [doctors, setDoctors]             = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [submitting, setSubmitting]       = useState(false);

  useEffect(() => {
    getActiveDoctors(queue.poli).then(r => setDoctors(r.data.data)).catch(() => {});
  }, [queue.poli]);

  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const r = await searchPatients(searchQ);
      const list = r.data.data;
      if (list.length === 0) setStep('newForm');
      else { setFoundPatients(list); setStep('found'); }
    } catch { toast.error('Gagal mencari pasien.'); }
    finally { setSearching(false); }
  };

  const handleCreatePatient = async () => {
    if (!newForm.nik || !newForm.nama_lengkap || !newForm.tanggal_lahir || !newForm.usia)
      return toast.error('Lengkapi data pasien.');
    setSubmitting(true);
    try {
      const r = await createPatient({ ...newForm, usia: parseInt(newForm.usia) });
      setSelectedPatient(r.data.data); setStep('keluhan');
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal membuat pasien.'); }
    finally { setSubmitting(false); }
  };

  const handleAssign = async () => {
    if (!keluhan.trim()) return toast.error('Keluhan awal wajib diisi.');
    if (!selectedDoctor)  return toast.error('Pilih dokter terlebih dahulu.');
    setSubmitting(true);
    try {
      await assignQueue(queue.id, { doctor_id: selectedDoctor, keluhan_awal: keluhan, patient_id: selectedPatient?.id });
      toast.success('Pasien berhasil di-assign ke dokter!');
      onAssigned();
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal assign.'); }
    finally { setSubmitting(false); }
  };

  const fields = [
    { key:'nama_lengkap', label:'Nama Lengkap *', type:'text', full:true },
    { key:'nik',          label:'NIK (16 digit) *', type:'text' },
    { key:'usia',         label:'Usia *', type:'number' },
    { key:'tanggal_lahir',label:'Tanggal Lahir *', type:'date' },
    { key:'nomor_telepon',label:'No. Telepon', type:'text' },
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass" style={{ width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto', borderRadius:14, padding:28 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:16, fontWeight:700 }}>Identifikasi Pasien</h2>
            <p style={{ fontSize:12, color:'#71717a', marginTop:2 }}>Tiket {queue.nomor_tiket} · {queue.poli === 'umum' ? 'Poli Umum' : 'Poli Gigi'}</p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ width:32, height:32, padding:0, fontSize:18 }}>×</button>
        </div>

        {step === 'search' && (
          <div>
            <label style={labelS}>Cari Pasien (NIK atau Nama)</label>
            <div style={{ display:'flex', gap:8 }}>
              <input className="input-field" placeholder="Masukkan NIK atau nama…" value={searchQ}
                onChange={e => setSearchQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
              <button className="btn-primary" onClick={handleSearch} disabled={searching} style={{ whiteSpace:'nowrap', padding:'9px 18px' }}>
                {searching ? '…' : 'Cari'}
              </button>
            </div>
            <button onClick={() => setStep('newForm')} className="btn-ghost" style={{ marginTop:12, fontSize:13 }}>+ Daftarkan pasien baru</button>
          </div>
        )}

        {step === 'found' && (
          <div>
            <p style={{ fontSize:13, color:'#71717a', marginBottom:12 }}>Ditemukan {foundPatients.length} pasien:</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:260, overflowY:'auto' }}>
              {foundPatients.map(p => (
                <button key={p.id} onClick={() => { setSelectedPatient(p); setStep('keluhan'); }}
                  style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px', textAlign:'left', cursor:'pointer' }}>
                  <div style={{ fontWeight:600, color:'#fafafa', fontSize:14 }}>{p.nama_lengkap}</div>
                  <div style={{ fontSize:12, color:'#71717a', marginTop:2 }}>NIK: {p.nik} · {p.usia} thn</div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep('search')} className="btn-ghost" style={{ marginTop:12, fontSize:13 }}>← Cari lagi</button>
          </div>
        )}

        {step === 'newForm' && (
          <div>
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14, color:'#a1a1aa' }}>Form Pasien Baru</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {fields.map(f => (
                <div key={f.key} style={f.full ? { gridColumn:'1/-1' } : {}}>
                  <label style={labelS}>{f.label}</label>
                  <input className="input-field" type={f.type} value={newForm[f.key]} onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={labelS}>Jenis Kelamin *</label>
                <select className="input-field" value={newForm.jenis_kelamin} onChange={e => setNewForm(p => ({ ...p, jenis_kelamin: e.target.value }))}>
                  <option value="laki_laki">Laki-laki</option>
                  <option value="perempuan">Perempuan</option>
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={labelS}>Alamat</label>
                <textarea className="input-field" style={{ resize:'vertical', minHeight:56 }} value={newForm.alamat} onChange={e => setNewForm(p => ({ ...p, alamat: e.target.value }))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={() => setStep('search')} className="btn-secondary" style={{ flex:1 }}>Kembali</button>
              <button onClick={handleCreatePatient} disabled={submitting} className="btn-primary" style={{ flex:2 }}>
                {submitting ? 'Menyimpan…' : 'Simpan & Lanjut'}
              </button>
            </div>
          </div>
        )}

        {step === 'keluhan' && (
          <div>
            {selectedPatient && (
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'12px 14px', marginBottom:16 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>✓ {selectedPatient.nama_lengkap}</div>
                <div style={{ fontSize:12, color:'#71717a', marginTop:2 }}>NIK: {selectedPatient.nik} · {selectedPatient.usia} thn</div>
              </div>
            )}
            <div style={{ marginBottom:16 }}>
              <label style={labelS}>Keluhan Awal *</label>
              <textarea className="input-field" style={{ resize:'vertical', minHeight:72 }} placeholder="Tuliskan keluhan pasien…" value={keluhan} onChange={e => setKeluhan(e.target.value)} />
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={labelS}>Assign ke Dokter *</label>
              {doctors.length === 0 ? (
                <div style={{ padding:'10px 14px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, fontSize:13, color:'#71717a' }}>
                  Tidak ada dokter yang sedang bertugas.
                </div>
              ) : (
                <select className="input-field" value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}>
                  <option value="">-- Pilih Dokter --</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>dr. {d.nama_dokter} ({d.jam_mulai}–{d.jam_selesai})</option>)}
                </select>
              )}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setStep('search')} className="btn-secondary" style={{ flex:1 }}>Kembali</button>
              <button onClick={handleAssign} disabled={submitting || doctors.length === 0} className="btn-primary" style={{ flex:2 }}>
                {submitting ? 'Mengirim…' : 'Assign & Kirim ke Dokter'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Queue Card ────────────────────────────────────────────────── */
function QueueCard({ q, onAction }) {
  const [confirming, setConfirming] = useState(null);
  const doAction = async (action) => {
    if (confirming !== action) { setConfirming(action); return; }
    setConfirming(null);
    await onAction(action, q.id);
  };
  return (
    <div className="glass" style={{ padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <div style={{ fontSize:22, fontWeight:800, color:'#fafafa', minWidth:56, letterSpacing:-1 }}>{q.nomor_tiket}</div>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:'#e4e4e7' }}>{q.patient?.nama_lengkap || <span style={{ color:'#52525b', fontStyle:'italic' }}>Belum Diidentifikasi</span>}</div>
          {q.patient?.nik  && <div style={{ fontSize:12, color:'#52525b', marginTop:2 }}>NIK: {q.patient.nik}</div>}
          {q.doctor        && <div style={{ fontSize:12, color:'#a1a1aa', marginTop:2 }}>→ dr. {q.doctor.nama_dokter}</div>}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <span className={S_CLASS[q.status]} style={{ fontSize:12, fontWeight:500, padding:'3px 10px', borderRadius:100 }}>
          {S_LABEL[q.status]}
        </span>
        {q.status === 'menunggu' && (
          <>
            <button className="btn-primary"  style={{ padding:'6px 14px', fontSize:12 }} onClick={() => onAction('call', q.id)}>Panggil</button>
            <button className={`btn-${confirming === 'skip' ? 'danger' : 'warning'}`} style={{ padding:'6px 14px', fontSize:12 }} onClick={() => doAction('skip')}>
              {confirming === 'skip' ? 'Yakin?' : 'Skip'}
            </button>
          </>
        )}
        {q.status === 'dipanggil_admin' && (
          <button className={`btn-${confirming === 'skip' ? 'danger' : 'warning'}`} style={{ padding:'6px 14px', fontSize:12 }} onClick={() => doAction('skip')}>
            {confirming === 'skip' ? 'Yakin?' : 'Skip'}
          </button>
        )}
        {q.status === 'skip' && (
          <button className="btn-blue" style={{ padding:'6px 14px', fontSize:12 }} onClick={() => onAction('recall', q.id)}>↩ Recall</button>
        )}
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────── */
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [mainTab, setMainTab]     = useState('antrean');
  const [activeTab, setActiveTab] = useState('umum');
  const [queues, setQueues]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modalQueue, setModalQueue] = useState(null);

  const fetchQueues = useCallback(async () => {
    try {
      const r = await getAdminQueues(activeTab);
      setQueues(r.data.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { setLoading(true); fetchQueues(); }, [fetchQueues]);
  useSocket(() => fetchQueues(), () => fetchQueues());

  const handleAction = async (action, id) => {
    try {
      if (action === 'call') {
        await callQueue(id);
        toast.success('Pasien dipanggil!');
        const q = queues.find(q => q.id === id);
        if (q) setModalQueue({ ...q, status: 'dipanggil_admin' });
      } else if (action === 'skip') {
        await skipQueue(id); toast('Antrean di-skip.', { icon: '⏭' });
      } else if (action === 'recall') {
        await recallQueue(id); toast.success('Pasien di-recall.');
      }
      fetchQueues();
    } catch (e) { toast.error(e.response?.data?.message || 'Gagal melakukan aksi.'); }
  };

  const waiting  = queues.filter(q => q.status === 'menunggu').length;
  const called   = queues.filter(q => q.status === 'dipanggil_admin').length;
  const atDoctor = queues.filter(q => ['menunggu_dokter','diperiksa'].includes(q.status)).length;
  const skipped  = queues.filter(q => q.status === 'skip').length;

  const navStyle = { padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,15,30,0.95)', position:'sticky', top:0, zIndex:40, backdropFilter:'blur(10px)' };

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg, #0a0f1e 0%, #0d1f30 100%)' }}>
      {/* Navbar */}
      <nav style={navStyle}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'#18181b', border:'1px solid #3f3f46', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🏥</div>
          <span style={{ fontSize:15, fontWeight:700, color:'#fafafa' }}>Klinikita</span>
          <span style={{ fontSize:12, color:'#52525b' }}>/ Admin</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:12, color:'#71717a', background:'#18181b', border:'1px solid #3f3f46', borderRadius:6, padding:'4px 10px' }}>{user?.email}</span>
          <button onClick={logout} className="btn-danger" style={{ padding:'6px 14px', fontSize:12 }}>Logout</button>
        </div>
      </nav>

      <div style={{ maxWidth:960, margin:'0 auto', padding:'20px 16px' }}>
        {/* Main tab */}
        <div style={{ display:'flex', gap:6, marginBottom:20, borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:12 }}>
          {[['antrean','Manajemen Antrean'],['rekam_medis','Rekam Medis']].map(([k,l]) => (
            <button key={k} onClick={() => setMainTab(k)} className={`tab-btn ${mainTab === k ? 'active' : ''}`}>{l}</button>
          ))}
        </div>

        {mainTab === 'rekam_medis' && <RecordsPanel />}

        {mainTab === 'antrean' && (
          <>
            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
              {[
                { label:'Menunggu',  value:waiting,  color:'#71717a' },
                { label:'Dipanggil', value:called,   color:'#d4d4d8' },
                { label:'Di Dokter', value:atDoctor, color:'#a1a1aa' },
                { label:'Dilewati',  value:skipped,  color:'#52525b' },
              ].map(s => (
                <div key={s.label} className="glass" style={{ padding:'14px 18px' }}>
                  <div style={{ fontSize:26, fontWeight:800, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:'#52525b', marginTop:2, textTransform:'uppercase', letterSpacing:'0.04em' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Poli tabs */}
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {[{key:'umum',label:'Poli Umum'},{key:'gigi',label:'Poli Gigi'}].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}>{t.label}</button>
              ))}
              <button onClick={fetchQueues} className="btn-ghost" style={{ marginLeft:'auto' }}>↺ Refresh</button>
            </div>

            {/* Queue list */}
            {loading ? (
              <div style={{ textAlign:'center', padding:60, color:'#52525b' }}>
                <div style={{ width:32, height:32, border:'2px solid #3f3f46', borderTopColor:'#fafafa', borderRadius:'50%', animation:'spin 0.9s linear infinite', margin:'0 auto 12px' }} />
                Memuat antrean…
              </div>
            ) : queues.length === 0 ? (
              <div className="glass" style={{ padding:56, textAlign:'center', color:'#52525b' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
                <p>Belum ada antrean hari ini.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {queues.map(q => (
                  <div key={q.id}>
                    <QueueCard q={q} onAction={handleAction} />
                    {q.status === 'dipanggil_admin' && (
                      <div style={{ padding:'8px 4px 0' }}>
                        <button className="btn-primary" style={{ fontSize:13, padding:'7px 16px' }} onClick={() => setModalQueue(q)}>
                          Identifikasi Pasien & Assign Dokter
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {modalQueue && (
        <PatientModal queue={modalQueue} onClose={() => setModalQueue(null)}
          onAssigned={() => { setModalQueue(null); fetchQueues(); }} />
      )}
    </div>
  );
}
