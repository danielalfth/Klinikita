const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('../db');

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });

    const users = await sql`SELECT * FROM "User" WHERE email = ${email} LIMIT 1`;
    if (users.length === 0)
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });

    let doctorId = null;
    if (user.role === 'dokter') {
      const doctors = await sql`SELECT id FROM "Doctor" WHERE user_id = ${user.id} LIMIT 1`;
      if (doctors.length > 0) doctorId = doctors[0].id;
    }

    const payload = { userId: user.id, role: user.role, doctorId };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, role: user.role, doctorId }
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function me(req, res) {
  try {
    const users = await sql`SELECT id, email, role FROM "User" WHERE id = ${req.user.userId} LIMIT 1`;
    if (users.length === 0)
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    const user = users[0];
    return res.json({ success: true, data: { ...user, doctorId: req.user.doctorId } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { login, me };
