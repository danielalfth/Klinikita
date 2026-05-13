const { sql } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { getTodayWIB, getTodayDayNameWIB, getCurrentTimeWIB } = require('../utils/timeHelper');

// POST /api/public/queue/take
async function takeTicket(req, res) {
  try {
    const { poli } = req.body;
    if (!poli || !['umum', 'gigi'].includes(poli))
      return res.status(400).json({ success: false, message: 'Poli tidak valid.' });

    const today = getTodayWIB();
    const prefix = poli === 'umum' ? 'U' : 'G';
    const countResult = await sql`SELECT COUNT(*)::int AS cnt FROM "Queue" WHERE poli = ${poli} AND tanggal_kunjungan = ${today}`;
    const nextNum = countResult[0].cnt + 1;
    const nomor_tiket = `${prefix}-${nextNum}`;
    const access_token = uuidv4();
    const id = uuidv4();

    await sql`
      INSERT INTO "Queue" (id, nomor_tiket, poli, access_token, status, tanggal_kunjungan, created_at)
      VALUES (${id}, ${nomor_tiket}, ${poli}, ${access_token}, 'menunggu', ${today}, NOW())
    `;

    return res.json({ success: true, data: { nomor_tiket, access_token, poli, status: 'menunggu' } });
  } catch (err) {
    console.error('takeTicket error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// GET /api/public/queue/status
async function getQueueStatus(req, res) {
  try {
    const access_token = req.headers['x-access-token'];
    if (!access_token) return res.status(400).json({ success: false, message: 'Access token diperlukan.' });

    const rows = await sql`
      SELECT q.id, q.nomor_tiket, q.poli, q.status, d.nama_dokter
      FROM "Queue" q LEFT JOIN "Doctor" d ON d.id = q.doctor_id
      WHERE q.access_token = ${access_token} LIMIT 1
    `;
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
    const q = rows[0];
    return res.json({ success: true, data: { id: q.id, nomor_tiket: q.nomor_tiket, poli: q.poli, status: q.status, doctor_name: q.nama_dokter || null } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// GET /api/admin/queues
async function getAdminQueues(req, res) {
  try {
    const { poli, date } = req.query;
    const today = date || getTodayWIB();
    const rows = poli
      ? await sql`SELECT q.id, q.nomor_tiket, q.poli, q.status, q.keluhan_awal, q.created_at, q.patient_id, q.doctor_id, p.nama_lengkap, p.nik, p.usia, p.jenis_kelamin, p.alamat, p.nomor_telepon, d.nama_dokter FROM "Queue" q LEFT JOIN "Patient" p ON p.id = q.patient_id LEFT JOIN "Doctor" d ON d.id = q.doctor_id WHERE q.poli = ${poli} AND q.tanggal_kunjungan = ${today} AND q.status != 'selesai' ORDER BY q.created_at ASC`
      : await sql`SELECT q.id, q.nomor_tiket, q.poli, q.status, q.keluhan_awal, q.created_at, q.patient_id, q.doctor_id, p.nama_lengkap, p.nik, p.usia, p.jenis_kelamin, p.alamat, p.nomor_telepon, d.nama_dokter FROM "Queue" q LEFT JOIN "Patient" p ON p.id = q.patient_id LEFT JOIN "Doctor" d ON d.id = q.doctor_id WHERE q.tanggal_kunjungan = ${today} AND q.status != 'selesai' ORDER BY q.created_at ASC`;

    return res.json({ success: true, data: rows.map(r => ({ id: r.id, nomor_tiket: r.nomor_tiket, poli: r.poli, status: r.status, keluhan_awal: r.keluhan_awal, created_at: r.created_at, patient: r.patient_id ? { id: r.patient_id, nama_lengkap: r.nama_lengkap, nik: r.nik, usia: r.usia, jenis_kelamin: r.jenis_kelamin, alamat: r.alamat, nomor_telepon: r.nomor_telepon } : null, doctor: r.doctor_id ? { id: r.doctor_id, nama_dokter: r.nama_dokter } : null })) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// POST /api/admin/queues/:id/call
async function callQueue(req, res) {
  const io = req.app.get('io');
  try {
    const { id } = req.params;
    const rows = await sql`SELECT * FROM "Queue" WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Antrean tidak ditemukan.' });
    if (rows[0].status !== 'menunggu') return res.status(400).json({ success: false, message: 'Status tidak valid.' });
    await sql`UPDATE "Queue" SET status = 'dipanggil_admin' WHERE id = ${id}`;
    io.emit('queue:status_changed', { queue_id: id, nomor_tiket: rows[0].nomor_tiket, poli: rows[0].poli, status: 'dipanggil_admin', doctor_name: null });
    return res.json({ success: true, data: { ...rows[0], status: 'dipanggil_admin' } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// POST /api/admin/queues/:id/skip
async function skipQueue(req, res) {
  const io = req.app.get('io');
  try {
    const { id } = req.params;
    const rows = await sql`SELECT * FROM "Queue" WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Antrean tidak ditemukan.' });
    if (!['menunggu', 'dipanggil_admin'].includes(rows[0].status)) return res.status(400).json({ success: false, message: 'Tidak bisa di-skip.' });
    await sql`UPDATE "Queue" SET status = 'skip' WHERE id = ${id}`;
    io.emit('queue:status_changed', { queue_id: id, nomor_tiket: rows[0].nomor_tiket, poli: rows[0].poli, status: 'skip', doctor_name: null });
    return res.json({ success: true, data: { ...rows[0], status: 'skip' } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// POST /api/admin/queues/:id/recall
async function recallQueue(req, res) {
  const io = req.app.get('io');
  try {
    const { id } = req.params;
    const rows = await sql`SELECT * FROM "Queue" WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Antrean tidak ditemukan.' });
    if (rows[0].status !== 'skip') return res.status(400).json({ success: false, message: 'Hanya skip yang bisa di-recall.' });
    await sql`UPDATE "Queue" SET status = 'menunggu', created_at = NOW() WHERE id = ${id}`;
    io.emit('queue:status_changed', { queue_id: id, nomor_tiket: rows[0].nomor_tiket, poli: rows[0].poli, status: 'menunggu', doctor_name: null });
    return res.json({ success: true, data: { ...rows[0], status: 'menunggu' } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// POST /api/admin/queues/:id/assign
async function assignQueue(req, res) {
  const io = req.app.get('io');
  try {
    const { id } = req.params;
    const { doctor_id, keluhan_awal, patient_id } = req.body;
    if (!doctor_id || !keluhan_awal) return res.status(400).json({ success: false, message: 'doctor_id dan keluhan_awal wajib.' });
    const rows = await sql`SELECT * FROM "Queue" WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Antrean tidak ditemukan.' });
    if (rows[0].status !== 'dipanggil_admin') return res.status(400).json({ success: false, message: 'Status harus dipanggil_admin.' });

    const todayDay = getTodayDayNameWIB();
    const nowTime = getCurrentTimeWIB();
    const doctors = await sql`SELECT d.id, d.nama_dokter FROM "Doctor" d JOIN "Schedule" s ON s.doctor_id = d.id WHERE d.id = ${doctor_id} AND s.hari = ${todayDay} AND s.jam_mulai <= ${nowTime} AND s.jam_selesai > ${nowTime} LIMIT 1`;
    if (doctors.length === 0) return res.status(400).json({ success: false, message: 'Dokter tidak sedang bertugas saat ini.' });

    const pid = patient_id || rows[0].patient_id;
    await sql`UPDATE "Queue" SET status = 'menunggu_dokter', doctor_id = ${doctor_id}, keluhan_awal = ${keluhan_awal}, patient_id = ${pid} WHERE id = ${id}`;
    io.emit('queue:status_changed', { queue_id: id, nomor_tiket: rows[0].nomor_tiket, poli: rows[0].poli, status: 'menunggu_dokter', doctor_name: doctors[0].nama_dokter });
    return res.json({ success: true, data: { ...rows[0], status: 'menunggu_dokter', doctor_id, keluhan_awal, patient_id: pid } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// GET /api/doctor/queues
async function getDoctorQueues(req, res) {
  try {
    const doctorId = req.user.doctorId;
    const today = getTodayWIB();
    const rows = await sql`
      SELECT q.id, q.nomor_tiket, q.poli, q.status, q.keluhan_awal, q.created_at, q.patient_id,
             p.nama_lengkap, p.nik, p.usia, p.jenis_kelamin, p.alamat, p.nomor_telepon, p.tanggal_lahir
      FROM "Queue" q LEFT JOIN "Patient" p ON p.id = q.patient_id
      WHERE q.doctor_id = ${doctorId} AND q.tanggal_kunjungan = ${today} AND q.status IN ('menunggu_dokter', 'diperiksa')
      ORDER BY q.created_at ASC
    `;
    return res.json({ success: true, data: rows.map(r => ({ id: r.id, nomor_tiket: r.nomor_tiket, poli: r.poli, status: r.status, keluhan_awal: r.keluhan_awal, created_at: r.created_at, patient: r.patient_id ? { id: r.patient_id, nama_lengkap: r.nama_lengkap, nik: r.nik, usia: r.usia, jenis_kelamin: r.jenis_kelamin, alamat: r.alamat, nomor_telepon: r.nomor_telepon, tanggal_lahir: r.tanggal_lahir } : null })) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// POST /api/doctor/queues/:id/call-in
async function callInQueue(req, res) {
  const io = req.app.get('io');
  try {
    const { id } = req.params;
    const doctorId = req.user.doctorId;
    const rows = await sql`SELECT * FROM "Queue" WHERE id = ${id} AND doctor_id = ${doctorId} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Antrean tidak ditemukan.' });
    if (rows[0].status !== 'menunggu_dokter') return res.status(400).json({ success: false, message: 'Status harus menunggu_dokter.' });
    await sql`UPDATE "Queue" SET status = 'diperiksa' WHERE id = ${id}`;
    io.emit('queue:status_changed', { queue_id: id, nomor_tiket: rows[0].nomor_tiket, poli: rows[0].poli, status: 'diperiksa', doctor_name: null });
    return res.json({ success: true, data: { ...rows[0], status: 'diperiksa' } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// POST /api/doctor/queues/:id/complete
async function completeQueue(req, res) {
  const io = req.app.get('io');
  try {
    const { id } = req.params;
    const doctorId = req.user.doctorId;
    const { hasil_konsultasi, diagnosis, prescriptions = [] } = req.body;
    if (!hasil_konsultasi || !diagnosis) return res.status(400).json({ success: false, message: 'Hasil konsultasi dan diagnosis wajib.' });

    const rows = await sql`SELECT * FROM "Queue" WHERE id = ${id} AND doctor_id = ${doctorId} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Antrean tidak ditemukan.' });
    if (rows[0].status !== 'diperiksa') return res.status(400).json({ success: false, message: 'Pasien harus berstatus diperiksa.' });
    if (!rows[0].patient_id) return res.status(400).json({ success: false, message: 'Pasien belum diidentifikasi.' });

    const mrId = uuidv4();
    await sql`INSERT INTO "MedicalRecord" (id, queue_id, patient_id, doctor_id, hasil_konsultasi, diagnosis, created_at, updated_at) VALUES (${mrId}, ${id}, ${rows[0].patient_id}, ${doctorId}, ${hasil_konsultasi}, ${diagnosis}, NOW(), NOW())`;
    for (const p of prescriptions) {
      await sql`INSERT INTO "Prescription" (id, medical_record_id, nama_obat, dosis_aturan) VALUES (${uuidv4()}, ${mrId}, ${p.nama_obat}, ${p.dosis_aturan})`;
    }
    await sql`UPDATE "Queue" SET status = 'selesai' WHERE id = ${id}`;
    
    // Emit to patient with medical_record_id
    io.emit('queue:status_changed', { 
      queue_id: id, 
      nomor_tiket: rows[0].nomor_tiket, 
      poli: rows[0].poli, 
      status: 'selesai', 
      doctor_name: null,
      medical_record_id: mrId 
    });
    
    return res.json({ success: true, data: { medical_record_id: mrId } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// POST /api/admin/queues/:id/link-patient
async function linkPatient(req, res) {
  try {
    const { id } = req.params;
    const { patient_id } = req.body;
    if (!patient_id) return res.status(400).json({ success: false, message: 'patient_id wajib.' });
    await sql`UPDATE "Queue" SET patient_id = ${patient_id} WHERE id = ${id}`;
    return res.json({ success: true, data: { id, patient_id } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// GET /api/admin/doctors/active
async function getActiveDoctors(req, res) {
  try {
    const { poli } = req.query;
    const todayDay = getTodayDayNameWIB();
    const nowTime = getCurrentTimeWIB();
    const rows = poli
      ? await sql`SELECT d.id, d.nama_dokter, d.poli, s.jam_mulai, s.jam_selesai FROM "Doctor" d JOIN "Schedule" s ON s.doctor_id = d.id WHERE d.poli = ${poli} AND s.hari = ${todayDay} AND s.jam_mulai <= ${nowTime} AND s.jam_selesai > ${nowTime}`
      : await sql`SELECT d.id, d.nama_dokter, d.poli, s.jam_mulai, s.jam_selesai FROM "Doctor" d JOIN "Schedule" s ON s.doctor_id = d.id WHERE s.hari = ${todayDay} AND s.jam_mulai <= ${nowTime} AND s.jam_selesai > ${nowTime}`;
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { takeTicket, getQueueStatus, getAdminQueues, callQueue, skipQueue, recallQueue, assignQueue, getDoctorQueues, callInQueue, completeQueue, linkPatient, getActiveDoctors };
