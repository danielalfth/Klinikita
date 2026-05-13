require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const app = require('./app');
const { sql } = require('./db');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible in controllers via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

// Cron: setiap hari 07:55 WIB — hapus antrean lama yang tidak selesai
// WIB = UTC+7, jadi 07:55 WIB = 00:55 UTC
cron.schedule('55 0 * * *', async () => {
  try {
    // Get today's date in WIB
    const now = new Date();
    const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const today = wib.toISOString().split('T')[0];

    console.log(`[CRON] Running cleanup for date < ${today}`);

    // Get old incomplete queues
    const oldQueues = await sql`
      SELECT id FROM "Queue"
      WHERE tanggal_kunjungan < ${today} AND status != 'selesai'
    `;

    for (const q of oldQueues) {
      const mrs = await sql`SELECT id FROM "MedicalRecord" WHERE queue_id = ${q.id}`;
      for (const mr of mrs) {
        await sql`DELETE FROM "Prescription" WHERE medical_record_id = ${mr.id}`;
        await sql`DELETE FROM "MedicalRecord" WHERE id = ${mr.id}`;
      }
      await sql`DELETE FROM "Queue" WHERE id = ${q.id}`;
    }

    console.log(`[CRON] Cleaned up ${oldQueues.length} old incomplete queues.`);
  } catch (err) {
    console.error('[CRON] Error during cleanup:', err);
  }
}, { timezone: 'Asia/Jakarta' });

server.listen(PORT, () => {
  console.log(`🏥 Klinikita Server running on port ${PORT}`);
  console.log(`   Client URL: ${process.env.CLIENT_URL}`);
});
