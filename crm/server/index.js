require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { initializeDatabase, getDb, seedGeneralRoom } = require('./database');
const { runBackup, initBackupScheduler } = require('./backup');
const { JWT_SECRET } = require('./middleware/auth');
const { istNow } = require('./utils/time');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Initialize DB on startup
initializeDatabase();

// Seed General chat room
const db = getDb();
seedGeneralRoom(db);

// Backup on startup, then start scheduler
runBackup();
initBackupScheduler();

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/leads',     require('./routes/leads'));
app.use('/api/call-logs', require('./routes/callLogs'));
app.use('/api/activities',   require('./routes/activities'));
app.use('/api/follow-ups',   require('./routes/followUps'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/clients',      require('./routes/clients'));
app.use('/api/bsl',          require('./routes/bsl'));
app.use('/api/measurements', require('./routes/measurements'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/chat',      require('./routes/chat'));
app.use('/api/export',    require('./routes/export'));

// ── Socket.io ──────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

// Auth middleware for Socket.io
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = getDb().prepare(
      'SELECT id, name, role FROM users WHERE id = ? AND is_active = 1'
    ).get(decoded.userId);
    if (!user) return next(new Error('Invalid user'));
    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const { id: userId, name } = socket.user;
  const db = getDb();

  // Join all rooms this user belongs to
  const memberships = db.prepare(
    'SELECT room_id FROM chat_room_members WHERE user_id = ?'
  ).all(userId);
  memberships.forEach(m => socket.join(`room:${m.room_id}`));

  // New message
  socket.on('send_message', ({ room_id, message }) => {
    if (!message?.trim()) return;
    const isMember = db.prepare(
      'SELECT 1 FROM chat_room_members WHERE room_id = ? AND user_id = ?'
    ).get(room_id, userId);
    if (!isMember) return;

    const now = istNow();
    const result = db.prepare(
      'INSERT INTO chat_messages (room_id, sender_id, message, created_at) VALUES (?, ?, ?, ?)'
    ).run(room_id, userId, message.trim(), now);

    io.to(`room:${room_id}`).emit('new_message', {
      id: result.lastInsertRowid,
      room_id,
      sender_id: userId,
      sender_name: name,
      message: message.trim(),
      created_at: now,
    });
  });

  // Mark room as read
  socket.on('mark_read', ({ room_id }) => {
    db.prepare(
      'UPDATE chat_room_members SET last_read_at = ? WHERE room_id = ? AND user_id = ?'
    ).run(istNow(), room_id, userId);
  });

  // Join a newly created room (called after POST /api/chat/rooms)
  socket.on('join_room', ({ room_id }) => {
    const isMember = db.prepare(
      'SELECT 1 FROM chat_room_members WHERE room_id = ? AND user_id = ?'
    ).get(room_id, userId);
    if (isMember) socket.join(`room:${room_id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`FitMorphs CRM Server running on port ${PORT}`);
});
