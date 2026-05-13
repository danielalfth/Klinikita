const { sql } = require('../db');
const { v4: uuidv4 } = require('uuid');

// GET /api/admin/patients/search?q=<NIK atau nama>
async function searchPatients(req, res) {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    const search = `%${q}%`;
    const rows = await sql`
      SELECT id, nik, nama_lengkap, tanggal_lahir, usia, jenis_kelamin, alamat, nomor_telepon, created_at
      FROM "Patient"
      WHERE nik ILIKE ${search} OR nama_lengkap ILIKE ${search}
      ORDER BY nama_lengkap ASC
      LIMIT 20
    `;
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// POST /api/admin/patients
async function createPatient(req, res) {
  try {
    const { nik, nama_lengkap, tanggal_lahir, usia, jenis_kelamin, alamat, nomor_telepon } = req.body;

    if (!nik || !nama_lengkap || !tanggal_lahir || !usia || !jenis_kelamin)
      return res.status(400).json({ success: false, message: 'Field wajib tidak lengkap.' });

    // 1. Map the incoming value to match your Database ENUM ('L', 'P')
    const genderMap = {
      'laki_laki': 'L',
      'perempuan': 'P',
      'L': 'L', // Handle cases where it might already be correct
      'P': 'P'
    };

    const mappedGender = genderMap[jenis_kelamin];

    // Validate that the mapping actually found a valid ENUM value
    if (!mappedGender) {
      return res.status(400).json({
        success: false,
        message: 'Nilai jenis kelamin tidak valid. Gunakan laki_laki atau perempuan.'
      });
    }

    const existing = await sql`SELECT id FROM "Patient" WHERE nik = ${nik} LIMIT 1`;
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: 'NIK sudah terdaftar.' });

    const id = uuidv4();

    // 2. Use mappedGender in the VALUES list
    await sql`
      INSERT INTO "Patient" (id, nik, nama_lengkap, tanggal_lahir, usia, jenis_kelamin, alamat, nomor_telepon, created_at)
      VALUES (
        ${id}, 
        ${nik}, 
        ${nama_lengkap}, 
        ${tanggal_lahir}, 
        ${parseInt(usia)}, 
        ${mappedGender}, 
        ${alamat || null}, 
        ${nomor_telepon || null}, 
        NOW()
      )
    `;

    const patient = (await sql`SELECT * FROM "Patient" WHERE id = ${id}`)[0];
    return res.status(201).json({ success: true, data: patient });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { searchPatients, createPatient };
