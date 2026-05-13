const { sql } = require('../db');
const { isShiftActive, getTodayDayNameWIB, getCurrentTimeWIB } = require('../utils/timeHelper');

// GET /api/public/info
async function getInfo(req, res) {
  try {
    const doctors = await sql`
      SELECT d.id, d.nama_dokter, d.poli, d.spesialisasi,
             json_agg(json_build_object('hari', s.hari, 'jam_mulai', s.jam_mulai, 'jam_selesai', s.jam_selesai)) AS schedules
      FROM "Doctor" d
      JOIN "Schedule" s ON s.doctor_id = d.id
      GROUP BY d.id, d.nama_dokter, d.poli, d.spesialisasi
      ORDER BY d.nama_dokter
    `;
    const todayDay = getTodayDayNameWIB();
    const nowTime = getCurrentTimeWIB();
    const enriched = doctors.map(d => ({
      ...d,
      isActiveNow: d.schedules.some(s => s.hari === todayDay && s.jam_mulai <= nowTime && nowTime < s.jam_selesai)
    }));
    return res.json({
      success: true,
      data: {
        klinik: {
          nama: 'Klinikita',
          alamat: 'Jl. Kesehatan No. 1, Semarang',
          operasionalHours: [
            { hari: 'Senin – Sabtu', buka: '08:00', tutup: '21:00' },
            { hari: 'Minggu', buka: '08:00', tutup: '16:30' }
          ]
        },
        doctors: enriched
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// GET /api/public/schedule
async function getSchedule(req, res) {
  try {
    const schedules = await sql`
      SELECT s.hari, s.jam_mulai, s.jam_selesai,
             d.id AS doctor_id, d.nama_dokter, d.poli, d.spesialisasi
      FROM "Schedule" s
      JOIN "Doctor" d ON d.id = s.doctor_id
      ORDER BY
        CASE s.hari
          WHEN 'senin' THEN 1 WHEN 'selasa' THEN 2 WHEN 'rabu' THEN 3
          WHEN 'kamis' THEN 4 WHEN 'jumat' THEN 5 WHEN 'sabtu' THEN 6
          WHEN 'minggu' THEN 7 END,
        s.jam_mulai
    `;
    const todayDay = getTodayDayNameWIB();
    const nowTime = getCurrentTimeWIB();
    const grouped = {};
    for (const row of schedules) {
      if (!grouped[row.hari]) grouped[row.hari] = [];
      grouped[row.hari].push({
        doctor_id: row.doctor_id,
        nama_dokter: row.nama_dokter,
        poli: row.poli,
        spesialisasi: row.spesialisasi,
        jam_mulai: row.jam_mulai,
        jam_selesai: row.jam_selesai,
        isActiveNow: row.hari === todayDay && row.jam_mulai <= nowTime && nowTime < row.jam_selesai
      });
    }
    return res.json({ success: true, data: grouped });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { getInfo, getSchedule };
