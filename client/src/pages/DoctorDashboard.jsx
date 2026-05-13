import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import {
  getDoctorQueues, callInQueue, completeQueue,
  getPatientRecords, updateMedicalRecord, getShiftStatus,
  getPDFUrl, getDoctorAllMedicalRecords,
} from '../services/api';
import toast from 'react-hot-toast';

const S_CLASS = { menunggu_dokter:'badge-menunggu_dokter', diperiksa:'badge-diperiksa' };
const S_LABEL = { menunggu_dokter:'Menunggu Masuk', diperiksa:'Sedang Diperiksa' };
const lS = { fontSize:12,fontWeight:600,color:'#71717a',textTransform:'uppercase',letterSpacing:'0.04em',display:'block',marginBottom:6 };

/* ── Edit Medical Record Modal ─────────────────────────── */
function EditModal({ record, doctorId, onClose, onSaved }) {
  const [form, setForm] = useState({
    hasil_konsultasi: record.hasil_konsultasi,
    diagnosis: record.diagnosis,
    prescriptions: record.prescriptions.length > 0 ? record.prescriptions : [{ nama_obat:'', dosis_aturan:'' }],
  });
  const [saving, setSaving] = useState(false);
  const addDrug    = () => setForm(f => ({ ...f, prescriptions: [...f.prescriptions, { nama_obat:'', dosis_aturan:'' }] }));
  const removeDrug = i => setForm(f => ({ ...f, prescriptions: f.prescriptions.filter((_,idx) => idx !== i) }));
  const updDrug    = (i,k,v) => setForm(f => { const p=[...f.prescriptions]; p[i]={...p[i],[k]:v}; return {...f,prescriptions:p}; });
  const save = async () => {
    if (!form.hasil_konsultasi.trim() || !form.diagnosis.trim()) return toast.error('Data wajib lengkap.');
    setSaving(true);
    try {
      await updateMedicalRecord(record.id, { ...form, prescriptions: form.prescriptions.filter(p => p.nama_obat.trim()) });
      toast.success('Rekam medis diperbarui!'); onSaved();
    } catch(e) { toast.error(e.response?.data?.message || 'Gagal update.'); }
    finally { setSaving(false); }
  };
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="glass" style={{ width:'100%',maxWidth:540,maxHeight:'90vh',overflowY:'auto',borderRadius:14,padding:28 }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18 }}>
          <div>
            <h2 style={{ fontSize:15,fontWeight:700 }}>Edit Rekam Medis</h2>
            <p style={{ fontSize:12,color:'#71717a',marginTop:2 }}>{record.nama_lengkap} · {record.nomor_tiket}</p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ width:32,height:32,padding:0,fontSize:18 }}>×</button>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          <div>
            <label style={lS}>Hasil Konsultasi *</label>
            <textarea className="input-field" style={{ resize:'vertical',minHeight:72 }} value={form.hasil_konsultasi}
              onChange={e => setForm(f=>({...f,hasil_konsultasi:e.target.value}))} />
          </div>
          <div>
            <label style={lS}>Diagnosis *</label>
            <input className="input-field" value={form.diagnosis} onChange={e => setForm(f=>({...f,diagnosis:e.target.value}))} />
          </div>
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
              <label style={{ ...lS,marginBottom:0 }}>Obat</label>
              <button onClick={addDrug} className="btn-ghost" style={{ fontSize:12 }}>+ Tambah Obat</button>
            </div>
            {form.prescriptions.map((p,i) => (
              <div key={i} style={{ display:'flex',gap:8,marginBottom:8 }}>
                <div style={{ flex:1,display:'flex',flexDirection:'column',gap:6 }}>
                  <input className="input-field" placeholder={`Nama Obat ${i+1}`} value={p.nama_obat} onChange={e=>updDrug(i,'nama_obat',e.target.value)} />
                  <input className="input-field" placeholder="Dosis & Aturan Pakai" value={p.dosis_aturan} onChange={e=>updDrug(i,'dosis_aturan',e.target.value)} />
                </div>
                {form.prescriptions.length > 1 && (
                  <button onClick={()=>removeDrug(i)} className="btn-danger" style={{ width:36,height:36,padding:0,fontSize:18,alignSelf:'flex-start' }}>×</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={onClose} className="btn-secondary" style={{ flex:1 }}>Batal</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ flex:2 }}>
              {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── All Records Panel (Doctor — editable) ─────────────── */
function AllRecordsPanel({ doctorId }) {
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [query, setQuery]       = useState('');
  const [editing, setEditing]   = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { const t=setTimeout(()=>setQuery(search),400); return ()=>clearTimeout(t); }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    getDoctorAllMedicalRecords(query).then(r=>setRecords(r.data.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, [query]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <input className="input-field" placeholder="🔍 Cari nama pasien, NIK, atau diagnosis…" value={search} onChange={e=>setSearch(e.target.value)} />
      </div>
      {loading ? (
        <div style={{ textAlign:'center',padding:56,color:'#52525b' }}>
          <div style={{ width:32,height:32,border:'2px solid #3f3f46',borderTopColor:'#fafafa',borderRadius:'50%',animation:'spin 0.9s linear infinite',margin:'0 auto 12px' }} />
          Memuat…
        </div>
      ) : records.length === 0 ? (
        <div className="glass" style={{ padding:48,textAlign:'center',color:'#52525b' }}>
          <div style={{ fontSize:36,marginBottom:10 }}>🗂</div>
          <p>{query ? `Tidak ada hasil untuk "${query}"` : 'Belum ada rekam medis.'}</p>
        </div>
      ) : (
        <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
          {records.map(r => {
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="glass" style={{ padding:'16px 20px', transition:'all 0.2s' }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <div style={{ fontWeight:600,fontSize:14,color:'#fafafa' }}>{r.nama_lengkap}</div>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:r.poli==='umum'?'rgba(59,130,246,0.1)':'rgba(168,85,247,0.1)', color:r.poli==='umum'?'#60a5fa':'#c084fc', border:`1px solid ${r.poli==='umum'?'rgba(59,130,246,0.2)':'rgba(168,85,247,0.2)'}`, fontWeight:600 }}>
                        {r.poli === 'umum' ? '🏥 Umum' : '🦷 Gigi'}
                      </span>
                    </div>
                    <div style={{ fontSize:12,color:'#71717a',marginTop:2 }}>NIK: {r.nik} · {r.usia} thn · {r.jenis_kelamin==='laki_laki'?'L':'P'}</div>
                    <div style={{ fontSize:12,color:'#a1a1aa',marginTop:3 }}>dr. {r.nama_dokter} · {r.nomor_tiket}</div>
                    <div style={{ fontSize:12,color:'#52525b',marginTop:2 }}>📅 {new Date(r.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</div>
                  </div>
                  <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                    <a href={getPDFUrl(r.id)} target="_blank" rel="noreferrer"
                      style={{ fontSize:12,padding:'6px 14px',borderRadius:6,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',color:'#a1a1aa',textDecoration:'none',fontWeight:500,transition:'all 0.15s' }}
                      onMouseEnter={e => { e.target.style.background='rgba(255,255,255,0.1)'; e.target.style.color='#fafafa'; }}
                      onMouseLeave={e => { e.target.style.background='rgba(255,255,255,0.06)'; e.target.style.color='#a1a1aa'; }}>
                      📄 PDF
                    </a>
                    {r.doctor_id === doctorId && (
                      <button onClick={()=>setEditing(r)} className="btn-secondary" style={{ fontSize:12,padding:'6px 14px' }}>✏️ Edit</button>
                    )}
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
                    <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)',margin:'10px 0' }} />
                    <div style={{ fontSize:13,color:'#a1a1aa',display:'flex',flexDirection:'column',gap:6 }}>
                      <div style={{ background:'rgba(255,255,255,0.02)', padding:'10px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color:'#71717a',fontWeight:600,display:'block',marginBottom:4 }}>📋 Diagnosis</span>
                        <span>{r.diagnosis}</span>
                      </div>
                      <div style={{ background:'rgba(255,255,255,0.02)', padding:'10px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color:'#71717a',fontWeight:600,display:'block',marginBottom:4 }}>💬 Hasil Konsultasi</span>
                        <span>{r.hasil_konsultasi}</span>
                      </div>
                      {r.prescriptions?.length > 0 && (
                        <div style={{ background:'rgba(255,255,255,0.02)', padding:'10px 12px', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }}>
                          <span style={{ color:'#71717a',fontWeight:600,display:'block',marginBottom:6 }}>💊 Resep Obat</span>
                          <ul style={{ paddingLeft:18,display:'flex',flexDirection:'column',gap:3 }}>
                            {r.prescriptions.map((p,i)=>(
                              <li key={i} style={{ fontSize:12 }}>
                                <span style={{ fontWeight:600,color:'#e4e4e7' }}>{p.nama_obat}</span> — {p.dosis_aturan}
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
      {editing && <EditModal record={editing} doctorId={doctorId} onClose={()=>setEditing(null)} onSaved={()=>{ setEditing(null); load(); }} />}
    </div>
  );
}

/* ── Patient Panel (queue examination modal) ───────────── */
function PatientPanel({ queue, doctorId, onClose, onComplete }) {
  const [records, setRecords]   = useState([]);
  const [loadingR, setLoadingR] = useState(true);
  const [section, setSection]   = useState('form');
  const [form, setForm]         = useState({ hasil_konsultasi:'', diagnosis:'', prescriptions:[{ nama_obat:'', dosis_aturan:'' }] });
  const [submitting, setSub]    = useState(false);
  const [editId, setEditId]     = useState(null);
  const isExam = queue.status === 'diperiksa';

  useEffect(() => {
    if (!queue.patient?.id) return;
    getPatientRecords(queue.patient.id).then(r=>setRecords(r.data.data)).catch(()=>{}).finally(()=>setLoadingR(false));
  }, [queue.patient?.id]);

  const addDrug    = () => setForm(f=>({...f,prescriptions:[...f.prescriptions,{nama_obat:'',dosis_aturan:''}]}));
  const removeDrug = i => setForm(f=>({...f,prescriptions:f.prescriptions.filter((_,idx)=>idx!==i)}));
  const updDrug    = (i,k,v) => setForm(f=>{ const p=[...f.prescriptions]; p[i]={...p[i],[k]:v}; return {...f,prescriptions:p}; });

  const handleComplete = async () => {
    if (!form.hasil_konsultasi.trim()||!form.diagnosis.trim()) return toast.error('Hasil konsultasi dan diagnosis wajib.');
    setSub(true);
    try {
      const r = await completeQueue(queue.id,{...form,prescriptions:form.prescriptions.filter(p=>p.nama_obat.trim())});
      window.open(getPDFUrl(r.data.data.medical_record_id),'_blank');
      toast.success('Pemeriksaan selesai!'); onComplete();
    } catch(e) { toast.error(e.response?.data?.message||'Gagal menyimpan.'); }
    finally { setSub(false); }
  };

  const startEdit = rec => {
    setEditId(rec.id);
    setForm({ hasil_konsultasi:rec.hasil_konsultasi, diagnosis:rec.diagnosis, prescriptions:rec.prescriptions.length>0?rec.prescriptions:[{nama_obat:'',dosis_aturan:''}] });
    setSection('form');
  };

  const handleUpdate = async () => {
    if (!form.hasil_konsultasi.trim()||!form.diagnosis.trim()) return toast.error('Data wajib lengkap.');
    setSub(true);
    try {
      await updateMedicalRecord(editId,{...form,prescriptions:form.prescriptions.filter(p=>p.nama_obat.trim())});
      toast.success('Rekam medis diperbarui!');
      setEditId(null); setForm({hasil_konsultasi:'',diagnosis:'',prescriptions:[{nama_obat:'',dosis_aturan:''}]});
      const r = await getPatientRecords(queue.patient.id); setRecords(r.data.data);
    } catch(e) { toast.error(e.response?.data?.message||'Gagal update.'); }
    finally { setSub(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="glass" style={{ width:'100%',maxWidth:620,maxHeight:'92vh',overflowY:'auto',borderRadius:14,padding:0,display:'flex',flexDirection:'column' }}>
        <div style={{ padding:'18px 22px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
          <div>
            <h2 style={{ fontSize:15,fontWeight:700 }}>{queue.patient?.nama_lengkap||'Pasien'}</h2>
            <div style={{ fontSize:12,color:'#71717a',marginTop:3,display:'flex',gap:10 }}>
              <span>Tiket: <b style={{ color:'#fafafa' }}>{queue.nomor_tiket}</b></span>
              <span>Usia: {queue.patient?.usia} thn</span>
              <span>{queue.patient?.jenis_kelamin==='laki_laki'?'L':'P'}</span>
            </div>
            {queue.keluhan_awal && <div style={{ marginTop:6,fontSize:12,color:'#a1a1aa',fontStyle:'italic' }}>💬 {queue.keluhan_awal}</div>}
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ width:32,height:32,padding:0,fontSize:18,flexShrink:0 }}>×</button>
        </div>
        <div style={{ display:'flex',borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          {[{k:'form',l:isExam?(editId?'Edit Rekam Medis':'Input Rekam Medis'):'Detail'},{k:'history',l:`Riwayat (${records.length})`}].map(s=>(
            <button key={s.k} onClick={()=>setSection(s.k)}
              style={{ flex:1,padding:'11px',background:'none',border:'none',borderBottom:section===s.k?'2px solid #fafafa':'2px solid transparent',color:section===s.k?'#fafafa':'#52525b',cursor:'pointer',fontSize:13,fontWeight:500,transition:'all 0.15s' }}>
              {s.l}
            </button>
          ))}
        </div>
        <div style={{ padding:22,flex:1 }}>
          {section==='form' && (
            !isExam && !editId ? (
              <div style={{ textAlign:'center',padding:'40px 0',color:'#52525b' }}>
                <div style={{ fontSize:36,marginBottom:10 }}>⏳</div><p>Pasien belum masuk ruang periksa.</p>
              </div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
                <div><label style={lS}>Hasil Konsultasi *</label>
                  <textarea className="input-field" style={{ resize:'vertical',minHeight:76 }} value={form.hasil_konsultasi} onChange={e=>setForm(f=>({...f,hasil_konsultasi:e.target.value}))} /></div>
                <div><label style={lS}>Diagnosis *</label>
                  <input className="input-field" value={form.diagnosis} onChange={e=>setForm(f=>({...f,diagnosis:e.target.value}))} /></div>
                <div>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:8 }}>
                    <label style={{ ...lS,marginBottom:0 }}>Daftar Obat</label>
                    <button onClick={addDrug} className="btn-ghost" style={{ fontSize:12 }}>+ Tambah Obat</button>
                  </div>
                  {form.prescriptions.map((p,i)=>(
                    <div key={i} style={{ display:'flex',gap:8,marginBottom:8 }}>
                      <div style={{ flex:1,display:'flex',flexDirection:'column',gap:6 }}>
                        <input className="input-field" placeholder={`Nama Obat ${i+1}`} value={p.nama_obat} onChange={e=>updDrug(i,'nama_obat',e.target.value)} />
                        <input className="input-field" placeholder="Dosis & Aturan" value={p.dosis_aturan} onChange={e=>updDrug(i,'dosis_aturan',e.target.value)} />
                      </div>
                      {form.prescriptions.length>1 && <button onClick={()=>removeDrug(i)} className="btn-danger" style={{ width:36,height:36,padding:0,fontSize:18,alignSelf:'flex-start' }}>×</button>}
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex',gap:8 }}>
                  {editId && <button onClick={()=>{ setEditId(null); setForm({hasil_konsultasi:'',diagnosis:'',prescriptions:[{nama_obat:'',dosis_aturan:''}]}); }} className="btn-secondary" style={{ flex:1 }}>Batal Edit</button>}
                  <button onClick={editId?handleUpdate:handleComplete} disabled={submitting} className="btn-primary" style={{ flex:2,padding:'11px',fontSize:14 }}>
                    {submitting?'Menyimpan…':editId?'Simpan Perubahan':'Selesai & Cetak Resep PDF'}
                  </button>
                </div>
              </div>
            )
          )}
          {section==='history' && (
            loadingR ? <div style={{ textAlign:'center',padding:40,color:'#52525b' }}>Memuat…</div>
            : records.length===0 ? (
              <div style={{ textAlign:'center',padding:40,color:'#52525b' }}>
                <div style={{ fontSize:32,marginBottom:8 }}>📂</div><p>Belum ada riwayat.</p>
              </div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                {records.map(rec=>(
                  <div key={rec.id} style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,overflow:'hidden' }}>
                    <div style={{ padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                      <div>
                        <div style={{ fontSize:13,fontWeight:600,color:'#e4e4e7' }}>{new Date(rec.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}</div>
                        <div style={{ fontSize:12,color:'#71717a',marginTop:1 }}>dr. {rec.nama_dokter} · {rec.nomor_tiket}</div>
                      </div>
                      <div style={{ display:'flex',gap:8 }}>
                        <a href={getPDFUrl(rec.id)} target="_blank" rel="noreferrer"
                          style={{ fontSize:11,padding:'4px 10px',borderRadius:6,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'#a1a1aa',textDecoration:'none',fontWeight:500 }}>PDF</a>
                        {rec.doctor_id===doctorId && <button onClick={()=>startEdit(rec)} className="btn-secondary" style={{ fontSize:11,padding:'4px 10px' }}>Edit</button>}
                      </div>
                    </div>
                    <div style={{ padding:'10px 14px',fontSize:13,color:'#a1a1aa',display:'flex',flexDirection:'column',gap:4 }}>
                      <span><span style={{ color:'#71717a',fontWeight:600 }}>Diagnosis: </span>{rec.diagnosis}</span>
                      <span><span style={{ color:'#71717a',fontWeight:600 }}>Konsultasi: </span>{rec.hasil_konsultasi}</span>
                      {rec.prescriptions?.length>0 && <span><span style={{ color:'#71717a',fontWeight:600 }}>Obat: </span>
                        <ul style={{ marginTop:3,paddingLeft:16 }}>{rec.prescriptions.map((p,i)=><li key={i} style={{ fontSize:12 }}>{p.nama_obat} – {p.dosis_aturan}</li>)}</ul></span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */
export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shiftStatus, setShiftStatus] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [mainTab, setMainTab] = useState('antrean'); // antrean | rekam_medis

  const fetchQueues = useCallback(async () => {
    try { const r = await getDoctorQueues(); setQueues(r.data.data); }
    catch { /* silent */ } finally { setLoading(false); }
  }, []);

  const fetchShift = useCallback(async () => {
    try { const r = await getShiftStatus(); setShiftStatus(r.data.data); }
    catch { /* silent */ }
  }, []);

  useEffect(() => { fetchQueues(); fetchShift(); }, [fetchQueues, fetchShift]);
  useSocket(() => fetchQueues(), null);

  const handleCallIn = async (id) => {
    try { await callInQueue(id); toast.success('Pasien dipanggil masuk!'); fetchQueues(); }
    catch(e) { toast.error(e.response?.data?.message||'Gagal memanggil.'); }
  };

  const waiting = queues.filter(q => q.status==='menunggu_dokter').length;
  const examining = queues.filter(q => q.status==='diperiksa').length;

  return (
    <div style={{ minHeight:'100vh',background:'linear-gradient(135deg, #0a0f1e 0%, #0d1f30 100%)' }}>
      {/* Navbar */}
      <nav style={{ padding:'0 20px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(10,15,30,0.95)',position:'sticky',top:0,zIndex:40,backdropFilter:'blur(10px)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:32,height:32,borderRadius:8,background:'#18181b',border:'1px solid #3f3f46',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>🏥</div>
          <span style={{ fontSize:15,fontWeight:700,color:'#fafafa' }}>Klinikita</span>
          <span style={{ fontSize:12,color:'#52525b' }}>/ Dokter</span>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          {shiftStatus && (
            <div style={{ display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:100,background:shiftStatus.isOnShift?'rgba(34,197,94,0.1)':'rgba(234,179,8,0.1)',color:shiftStatus.isOnShift?'#4ade80':'#fbbf24',border:`1px solid ${shiftStatus.isOnShift?'rgba(34,197,94,0.3)':'rgba(234,179,8,0.3)'}` }}>
              <span style={{ width:6,height:6,borderRadius:'50%',background:shiftStatus.isOnShift?'#4ade80':'#fbbf24' }} />
              {shiftStatus.isOnShift ? 'On Shift' : 'Off Shift'}
            </div>
          )}
          <span style={{ fontSize:12,color:'#71717a',background:'#18181b',border:'1px solid #3f3f46',borderRadius:6,padding:'4px 10px' }}>{user?.email}</span>
          <button onClick={logout} className="btn-danger" style={{ padding:'6px 14px',fontSize:12 }}>Logout</button>
        </div>
      </nav>

      <div style={{ maxWidth:960,margin:'0 auto',padding:'20px 16px' }}>
        {shiftStatus && !shiftStatus.isOnShift && (
          <div style={{ background:'rgba(234,179,8,0.08)',border:'1px solid rgba(234,179,8,0.25)',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',gap:10 }}>
            <span style={{ fontSize:18 }}>⚠️</span>
            <div>
              <div style={{ fontWeight:600,color:'#fbbf24',fontSize:13 }}>Luar Jam Kerja</div>
              <div style={{ fontSize:12,color:'#a1a1aa',marginTop:2 }}>Dashboard read-only. Tidak bisa memanggil pasien.</div>
            </div>
          </div>
        )}

        <div style={{ display:'flex',gap:6,marginBottom:20,borderBottom:'1px solid rgba(255,255,255,0.06)',paddingBottom:12 }}>
          {[['antrean','Antrean Pasien'],['rekam_medis','Semua Rekam Medis']].map(([k,l]) => (
            <button key={k} onClick={()=>setMainTab(k)} className={`tab-btn ${mainTab===k?'active':''}`}>{l}</button>
          ))}
        </div>

        {mainTab === 'rekam_medis' && <AllRecordsPanel doctorId={user?.doctorId} />}

        {mainTab === 'antrean' && (
          <>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20 }}>
              {[
                { label:'Menunggu Masuk', value:waiting, color:'#fafafa' },
                { label:'Sedang Diperiksa', value:examining, color:'#a1a1aa' },
              ].map(s => (
                <div key={s.label} className="glass" style={{ padding:'16px 20px' }}>
                  <div style={{ fontSize:32,fontWeight:800,color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:12,fontWeight:600,color:'#52525b',marginTop:2,textTransform:'uppercase',letterSpacing:'0.04em' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
              <h2 style={{ fontSize:16,fontWeight:600 }}>Jadwal Hari Ini</h2>
              <button onClick={fetchQueues} className="btn-ghost">↺ Refresh</button>
            </div>

            {loading ? (
              <div style={{ textAlign:'center',padding:60,color:'#52525b' }}>
                <div style={{ width:32,height:32,border:'2px solid #3f3f46',borderTopColor:'#fafafa',borderRadius:'50%',animation:'spin 0.9s linear infinite',margin:'0 auto 12px' }} />
                Memuat antrean…
              </div>
            ) : queues.length===0 ? (
              <div className="glass" style={{ padding:56,textAlign:'center',color:'#52525b' }}>
                <div style={{ fontSize:40,marginBottom:10 }}>🩺</div>
                <p>Belum ada pasien yang di-assign ke Anda hari ini.</p>
              </div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {queues.map(q => (
                  <div key={q.id} className="glass" style={{ padding:'16px 20px' }}>
                    <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12 }}>
                      <div style={{ display:'flex',gap:14 }}>
                        <div style={{ fontSize:24,fontWeight:900,color:'#fafafa',letterSpacing:-1,minWidth:48 }}>{q.nomor_tiket}</div>
                        <div>
                          <div style={{ fontWeight:600,fontSize:14,color:'#fafafa' }}>{q.patient?.nama_lengkap||'—'}</div>
                          <div style={{ fontSize:12,color:'#71717a',marginTop:2 }}>{q.patient?.usia} thn · {q.patient?.jenis_kelamin==='laki_laki'?'L':'P'}</div>
                          {q.keluhan_awal && <div style={{ fontSize:12,color:'#a1a1aa',marginTop:4,fontStyle:'italic' }}>💬 {q.keluhan_awal}</div>}
                        </div>
                      </div>
                      <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
                        <span className={S_CLASS[q.status]||'badge-menunggu'} style={{ fontSize:12,fontWeight:500,padding:'3px 10px',borderRadius:100 }}>
                          {S_LABEL[q.status]||q.status}
                        </span>
                        {q.status==='menunggu_dokter' && shiftStatus?.isOnShift && (
                          <button className="btn-primary" style={{ padding:'6px 14px',fontSize:12 }} onClick={()=>handleCallIn(q.id)}>Panggil Masuk</button>
                        )}
                        <button onClick={()=>setSelectedQueue(q)} className="btn-secondary" style={{ padding:'6px 14px',fontSize:12 }}>
                          {q.status==='diperiksa'&&shiftStatus?.isOnShift?'📝 Periksa':'📋 Detail'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedQueue && (
        <PatientPanel queue={selectedQueue} doctorId={user?.doctorId} onClose={()=>setSelectedQueue(null)} onComplete={()=>{setSelectedQueue(null);fetchQueues();}} />
      )}
    </div>
  );
}
