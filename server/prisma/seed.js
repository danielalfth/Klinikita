require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const sql = neon(process.env.DATABASE_URL);

async function seed() {
  console.log('🌱 Starting seed...');

  // Hash password
  const hashedPw = await bcrypt.hash('password', 10);

  // ── ADMIN ──────────────────────────────────────────────
  const adminId = uuidv4();
  await sql`DELETE FROM "User" WHERE email = 'admin@admin.com'`;
  await sql`INSERT INTO "User" (id, email, password, role, created_at) VALUES (${adminId}, 'admin@admin.com', ${hashedPw}, 'admin', NOW())`;
  console.log('✅ Admin created');

  // ── DOKTER POLI UMUM ───────────────────────────────────
  const umumDoctors = [
    { name: 'Daniel', email: 'daniel@umum.com', schedules: [{ hari: 'senin', mulai: '08:00', selesai: '14:30' }] },
    { name: 'Zaki', email: 'zaki@umum.com', schedules: [{ hari: 'senin', mulai: '14:30', selesai: '21:00' }] },
    { name: 'Ali', email: 'ali@umum.com', schedules: [{ hari: 'selasa', mulai: '08:00', selesai: '14:30' }] },
    { name: 'Mario', email: 'mario@umum.com', schedules: [{ hari: 'selasa', mulai: '14:30', selesai: '21:00' }] },
    { name: 'Ashar', email: 'ashar@umum.com', schedules: [{ hari: 'rabu', mulai: '08:00', selesai: '14:30' }] },
    { name: 'Hening', email: 'hening@umum.com', schedules: [{ hari: 'rabu', mulai: '14:30', selesai: '21:00' }] },
    { name: 'Zaid', email: 'zaid@umum.com', schedules: [{ hari: 'kamis', mulai: '08:00', selesai: '14:30' }] },
    { name: 'Erghy', email: 'erghy@umum.com', schedules: [{ hari: 'kamis', mulai: '14:30', selesai: '21:00' }] },
    { name: 'Justin', email: 'justin@umum.com', schedules: [{ hari: 'jumat', mulai: '08:00', selesai: '14:30' }] },
    { name: 'Yusuf', email: 'yusuf@umum.com', schedules: [{ hari: 'jumat', mulai: '14:30', selesai: '21:00' }] },
    { name: 'Reizal', email: 'reizal@umum.com', schedules: [{ hari: 'sabtu', mulai: '08:00', selesai: '14:30' }] },
    { name: 'Arya', email: 'arya@umum.com', schedules: [{ hari: 'sabtu', mulai: '14:30', selesai: '21:00' }] },
    { name: 'Daffa', email: 'daffa@umum.com', schedules: [{ hari: 'minggu', mulai: '08:00', selesai: '12:00' }] },
    { name: 'Kevin', email: 'kevin@umum.com', schedules: [{ hari: 'minggu', mulai: '12:00', selesai: '16:30' }] },
  ];

  // ── DOKTER POLI GIGI ───────────────────────────────────
  const gigiDoctors = [
    { name: 'Charlie', email: 'charlie@gigi.com', schedules: [
      { hari: 'senin', mulai: '08:00', selesai: '14:30' },
      { hari: 'rabu', mulai: '08:00', selesai: '14:30' },
      { hari: 'jumat', mulai: '08:00', selesai: '14:30' },
      { hari: 'minggu', mulai: '08:00', selesai: '14:30' },
    ]},
    { name: 'Matthew', email: 'matthew@gigi.com', schedules: [
      { hari: 'senin', mulai: '14:30', selesai: '21:00' },
      { hari: 'rabu', mulai: '14:30', selesai: '21:00' },
      { hari: 'jumat', mulai: '14:30', selesai: '21:00' },
      { hari: 'minggu', mulai: '14:30', selesai: '16:30' },
    ]},
    { name: 'Amel', email: 'amel@gigi.com', schedules: [
      { hari: 'selasa', mulai: '08:00', selesai: '14:30' },
      { hari: 'kamis', mulai: '08:00', selesai: '14:30' },
      { hari: 'sabtu', mulai: '08:00', selesai: '14:30' },
    ]},
    { name: 'Richie', email: 'richie@gigi.com', schedules: [
      { hari: 'selasa', mulai: '14:30', selesai: '21:00' },
      { hari: 'kamis', mulai: '14:30', selesai: '21:00' },
      { hari: 'sabtu', mulai: '14:30', selesai: '21:00' },
    ]},
  ];

  // Helper: upsert doctor + user + schedules
  async function upsertDoctor(d, poli) {
    await sql`DELETE FROM "Schedule" WHERE doctor_id IN (SELECT id FROM "Doctor" WHERE user_id IN (SELECT id FROM "User" WHERE email = ${d.email}))`;
    await sql`DELETE FROM "Doctor" WHERE user_id IN (SELECT id FROM "User" WHERE email = ${d.email})`;
    await sql`DELETE FROM "User" WHERE email = ${d.email}`;

    const userId = uuidv4();
    await sql`INSERT INTO "User" (id, email, password, role, created_at) VALUES (${userId}, ${d.email}, ${hashedPw}, 'dokter', NOW())`;

    const doctorId = uuidv4();
    await sql`INSERT INTO "Doctor" (id, user_id, nama_dokter, poli, spesialisasi) VALUES (${doctorId}, ${userId}, ${d.name}, ${poli}, null)`;

    for (const s of d.schedules) {
      await sql`INSERT INTO "Schedule" (id, doctor_id, hari, jam_mulai, jam_selesai) VALUES (${uuidv4()}, ${doctorId}, ${s.hari}, ${s.mulai}, ${s.selesai})`;
    }
    return doctorId;
  }

  for (const d of umumDoctors) await upsertDoctor(d, 'umum');
  console.log('✅ Poli Umum doctors created');

  for (const d of gigiDoctors) await upsertDoctor(d, 'gigi');
  console.log('✅ Poli Gigi doctors created');

  console.log('🎉 Seed complete!');
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
