const { sql } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { generatePrescriptionPDF } = require('../services/pdf.service');
const { getTodayDayNameWIB, getCurrentTimeWIB } = require('../utils/timeHelper');

// GET /api/doctor/patients/:patient_id/records
async function getPatientRecords(req, res) {
  try {
    const { patient_id } = req.params;
    const records = await sql`
      SELECT mr.id, mr.diagnosis, mr.hasil_konsultasi, mr.created_at, mr.updated_at,
             d.nama_dokter, q.nomor_tiket, q.poli, q.tanggal_kunjungan
      FROM "MedicalRecord" mr
      JOIN "Doctor" d ON d.id = mr.doctor_id
      JOIN "Queue" q ON q.id = mr.queue_id
      WHERE mr.patient_id = ${patient_id}
      ORDER BY mr.created_at DESC
    `;
    const enriched = await Promise.all(records.map(async r => {
      const prescriptions = await sql`SELECT id, nama_obat, dosis_aturan FROM "Prescription" WHERE medical_record_id = ${r.id}`;
      return { ...r, prescriptions };
    }));
    return res.json({ success: true, data: enriched });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// PUT /api/doctor/medical-records/:id
async function updateMedicalRecord(req, res) {
  try {
    const { id } = req.params;
    const doctorId = req.user.doctorId;
    const { hasil_konsultasi, diagnosis, prescriptions = [] } = req.body;
    if (!hasil_konsultasi || !diagnosis)
      return res.status(400).json({ success: false, message: 'Hasil konsultasi dan diagnosis wajib.' });

    const rows = await sql`SELECT * FROM "MedicalRecord" WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Rekam medis tidak ditemukan.' });
    if (rows[0].doctor_id !== doctorId)
      return res.status(403).json({ success: false, message: 'Anda tidak berhak mengedit rekam medis ini.' });

    await sql`UPDATE "MedicalRecord" SET hasil_konsultasi = ${hasil_konsultasi}, diagnosis = ${diagnosis}, updated_at = NOW() WHERE id = ${id}`;
    await sql`DELETE FROM "Prescription" WHERE medical_record_id = ${id}`;
    for (const p of prescriptions) {
      await sql`INSERT INTO "Prescription" (id, medical_record_id, nama_obat, dosis_aturan) VALUES (${uuidv4()}, ${id}, ${p.nama_obat}, ${p.dosis_aturan})`;
    }
    const updated = (await sql`SELECT * FROM "MedicalRecord" WHERE id = ${id}`)[0];
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// GET /api/doctor/medical-records/:id/pdf
async function getPDF(req, res) {
  try {
    const { id } = req.params;
    const rows = await sql`
      SELECT mr.*, d.nama_dokter, p.nama_lengkap, p.usia, p.jenis_kelamin,
             q.nomor_tiket, q.poli, q.tanggal_kunjungan
      FROM "MedicalRecord" mr
      JOIN "Doctor" d ON d.id = mr.doctor_id
      JOIN "Patient" p ON p.id = mr.patient_id
      JOIN "Queue" q ON q.id = mr.queue_id
      WHERE mr.id = ${id} LIMIT 1
    `;
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Rekam medis tidak ditemukan.' });
    const record = rows[0];
    const prescriptions = await sql`SELECT nama_obat, dosis_aturan FROM "Prescription" WHERE medical_record_id = ${id}`;
    record.prescriptions = prescriptions;

    const pdfBuffer = await generatePrescriptionPDF(record);
    
    // Format tanggal untuk filename yang aman
    const dateStr = record.tanggal_kunjungan 
      ? new Date(record.tanggal_kunjungan).toISOString().split('T')[0]
      : 'no-date';
    const filename = `resep-${record.nomor_tiket}-${dateStr}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating PDF:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// GET /api/doctor/shift-status
async function getShiftStatus(req, res) {
  try {
    const doctorId = req.user.doctorId;
    const todayDay = getTodayDayNameWIB();
    const nowTime = getCurrentTimeWIB();
    const schedules = await sql`
      SELECT hari, jam_mulai, jam_selesai FROM "Schedule"
      WHERE doctor_id = ${doctorId} AND hari = ${todayDay}
      LIMIT 1
    `;
    if (schedules.length === 0)
      return res.json({ success: true, data: { isOnShift: false, schedule: null } });

    const s = schedules[0];
    const isOnShift = s.jam_mulai <= nowTime && nowTime < s.jam_selesai;
    return res.json({ success: true, data: { isOnShift, schedule: s } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// GET /api/admin/medical-records  OR  /api/doctor/medical-records
// Query param: ?q= (search by patient name, NIK, or diagnosis)
async function getAllMedicalRecords(req, res) {
  try {
    const { q = '' } = req.query;
    const search = `%${q}%`;
    const userRole = req.user.role;

    let records;

    // Admin dapat melihat semua rekam medis dari kedua poli
    if (userRole === 'admin') {
      records = q
        ? await sql`
            SELECT mr.id, mr.diagnosis, mr.hasil_konsultasi, mr.created_at, mr.updated_at, mr.doctor_id,
                   d.nama_dokter, d.poli,
                   p.id AS patient_id, p.nama_lengkap, p.nik, p.usia, p.jenis_kelamin,
                   qt.nomor_tiket, qt.poli AS queue_poli, qt.tanggal_kunjungan
            FROM "MedicalRecord" mr
            JOIN "Doctor" d  ON d.id  = mr.doctor_id
            JOIN "Patient" p ON p.id  = mr.patient_id
            JOIN "Queue"  qt ON qt.id = mr.queue_id
            WHERE p.nama_lengkap ILIKE ${search}
               OR p.nik          ILIKE ${search}
               OR mr.diagnosis   ILIKE ${search}
            ORDER BY mr.created_at DESC
            LIMIT 100
          `
        : await sql`
            SELECT mr.id, mr.diagnosis, mr.hasil_konsultasi, mr.created_at, mr.updated_at, mr.doctor_id,
                   d.nama_dokter, d.poli,
                   p.id AS patient_id, p.nama_lengkap, p.nik, p.usia, p.jenis_kelamin,
                   qt.nomor_tiket, qt.poli AS queue_poli, qt.tanggal_kunjungan
            FROM "MedicalRecord" mr
            JOIN "Doctor" d  ON d.id  = mr.doctor_id
            JOIN "Patient" p ON p.id  = mr.patient_id
            JOIN "Queue"  qt ON qt.id = mr.queue_id
            ORDER BY mr.created_at DESC
            LIMIT 100
          `;
    } 
    // Dokter hanya dapat melihat rekam medis dari poli mereka sendiri
    else if (userRole === 'dokter') {
      const doctorId = req.user.doctorId;
      
      // Dapatkan poli dokter
      const doctorRows = await sql`SELECT poli FROM "Doctor" WHERE id = ${doctorId} LIMIT 1`;
      if (doctorRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Data dokter tidak ditemukan.' });
      }
      const doctorPoli = doctorRows[0].poli;

      records = q
        ? await sql`
            SELECT mr.id, mr.diagnosis, mr.hasil_konsultasi, mr.created_at, mr.updated_at, mr.doctor_id,
                   d.nama_dokter, d.poli,
                   p.id AS patient_id, p.nama_lengkap, p.nik, p.usia, p.jenis_kelamin,
                   qt.nomor_tiket, qt.poli AS queue_poli, qt.tanggal_kunjungan
            FROM "MedicalRecord" mr
            JOIN "Doctor" d  ON d.id  = mr.doctor_id
            JOIN "Patient" p ON p.id  = mr.patient_id
            JOIN "Queue"  qt ON qt.id = mr.queue_id
            WHERE d.poli = ${doctorPoli}
              AND (p.nama_lengkap ILIKE ${search}
                OR p.nik          ILIKE ${search}
                OR mr.diagnosis   ILIKE ${search})
            ORDER BY mr.created_at DESC
            LIMIT 100
          `
        : await sql`
            SELECT mr.id, mr.diagnosis, mr.hasil_konsultasi, mr.created_at, mr.updated_at, mr.doctor_id,
                   d.nama_dokter, d.poli,
                   p.id AS patient_id, p.nama_lengkap, p.nik, p.usia, p.jenis_kelamin,
                   qt.nomor_tiket, qt.poli AS queue_poli, qt.tanggal_kunjungan
            FROM "MedicalRecord" mr
            JOIN "Doctor" d  ON d.id  = mr.doctor_id
            JOIN "Patient" p ON p.id  = mr.patient_id
            JOIN "Queue"  qt ON qt.id = mr.queue_id
            WHERE d.poli = ${doctorPoli}
            ORDER BY mr.created_at DESC
            LIMIT 100
          `;
    } else {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    const enriched = await Promise.all(records.map(async (r) => {
      const prescriptions = await sql`
        SELECT id, nama_obat, dosis_aturan FROM "Prescription"
        WHERE medical_record_id = ${r.id}
      `;
      return { ...r, prescriptions };
    }));

    return res.json({ success: true, data: enriched });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// GET /api/public/medical-records/:id/pdf (for patients)
async function getPatientPDF(req, res) {
  try {
    const { id } = req.params;
    const { token } = req.query;

    // Verify patient access token
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token akses tidak ditemukan.' });
    }

    // Get medical record
    const rows = await sql`
      SELECT mr.*, d.nama_dokter, p.nama_lengkap, p.usia, p.jenis_kelamin,
             q.nomor_tiket, q.poli, q.tanggal_kunjungan, q.access_token
      FROM "MedicalRecord" mr
      JOIN "Doctor" d ON d.id = mr.doctor_id
      JOIN "Patient" p ON p.id = mr.patient_id
      JOIN "Queue" q ON q.id = mr.queue_id
      WHERE mr.id = ${id} LIMIT 1
    `;
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Rekam medis tidak ditemukan.' });
    }

    const record = rows[0];

    // Verify that the token matches the queue's access token
    if (record.access_token !== token) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke rekam medis ini.' });
    }

    const prescriptions = await sql`SELECT nama_obat, dosis_aturan FROM "Prescription" WHERE medical_record_id = ${id}`;
    record.prescriptions = prescriptions;

    const pdfBuffer = await generatePrescriptionPDF(record);
    
    // Format tanggal untuk filename yang aman
    const dateStr = record.tanggal_kunjungan 
      ? new Date(record.tanggal_kunjungan).toISOString().split('T')[0]
      : 'no-date';
    const filename = `resep-${record.nomor_tiket}-${dateStr}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating patient PDF:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { getPatientRecords, updateMedicalRecord, getPDF, getShiftStatus, getAllMedicalRecords, getPatientPDF };

