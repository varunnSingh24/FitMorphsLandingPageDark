const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { istNow } = require('../utils/time');

const router = express.Router();
router.use(authenticate);

// GET /api/chat/rooms — all rooms for current user with unread count
router.get('/rooms', (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  const rooms = db.prepare(`
    SELECT
      cr.id, cr.name, cr.type, cr.created_by, cr.created_at,
      crm.last_read_at,
      (
        SELECT COUNT(*) FROM chat_messages cm
        WHERE cm.room_id = cr.id
          AND cm.sender_id != ?
          AND (crm.last_read_at IS NULL OR cm.created_at > crm.last_read_at)
      ) as unread_count,
      (
        SELECT cm2.message FROM chat_messages cm2
        WHERE cm2.room_id = cr.id
        ORDER BY cm2.created_at DESC LIMIT 1
      ) as last_message,
      (
        SELECT cm3.created_at FROM chat_messages cm3
        WHERE cm3.room_id = cr.id
        ORDER BY cm3.created_at DESC LIMIT 1
      ) as last_message_at,
      (
        SELECT cm4.sender_id FROM chat_messages cm4
        WHERE cm4.room_id = cr.id
        ORDER BY cm4.created_at DESC LIMIT 1
      ) as last_sender_id,
      (
        SELECT u2.name FROM chat_messages cm5
        JOIN users u2 ON cm5.sender_id = u2.id
        WHERE cm5.room_id = cr.id
        ORDER BY cm5.created_at DESC LIMIT 1
      ) as last_sender_name,
      (
        SELECT COUNT(*) FROM chat_room_members crm2 WHERE crm2.room_id = cr.id
      ) as member_count
    FROM chat_rooms cr
    JOIN chat_room_members crm ON crm.room_id = cr.id AND crm.user_id = ?
    ORDER BY COALESCE(last_message_at, cr.created_at) DESC
  `).all(userId, userId);

  res.json({ rooms });
});

// GET /api/chat/unread — total unread count across all rooms (for sidebar badge)
router.get('/unread', (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  const row = db.prepare(`
    SELECT SUM(
      (SELECT COUNT(*) FROM chat_messages cm
       WHERE cm.room_id = crm.room_id
         AND cm.sender_id != ?
         AND (crm.last_read_at IS NULL OR cm.created_at > crm.last_read_at))
    ) as total
    FROM chat_room_members crm
    WHERE crm.user_id = ?
  `).get(userId, userId);

  res.json({ unread: row.total || 0 });
});

// GET /api/chat/rooms/:roomId/messages — message history (last 100)
router.get('/rooms/:roomId/messages', (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  const member = db.prepare(
    'SELECT 1 FROM chat_room_members WHERE room_id = ? AND user_id = ?'
  ).get(req.params.roomId, userId);
  if (!member) return res.status(403).json({ error: 'Not a member of this room' });

  const messages = db.prepare(`
    SELECT cm.*, u.name as sender_name
    FROM chat_messages cm
    JOIN users u ON cm.sender_id = u.id
    WHERE cm.room_id = ?
    ORDER BY cm.created_at ASC
    LIMIT 100
  `).all(req.params.roomId);

  // Also return room members for display
  const members = db.prepare(`
    SELECT u.id, u.name, u.role
    FROM chat_room_members crm
    JOIN users u ON crm.user_id = u.id
    WHERE crm.room_id = ?
    ORDER BY u.name ASC
  `).all(req.params.roomId);

  res.json({ messages, members });
});

// PUT /api/chat/rooms/:roomId/read — mark room as read
router.put('/rooms/:roomId/read', (req, res) => {
  const db = getDb();
  db.prepare(
    'UPDATE chat_room_members SET last_read_at = ? WHERE room_id = ? AND user_id = ?'
  ).run(istNow(), req.params.roomId, req.user.id);
  res.json({ success: true });
});

// POST /api/chat/rooms — create a group room
router.post('/rooms', (req, res) => {
  const db = getDb();
  const { name, member_ids = [] } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Room name is required' });

  const now = istNow();
  const result = db.prepare(
    "INSERT INTO chat_rooms (name, type, created_by, created_at) VALUES (?, 'group', ?, ?)"
  ).run(name.trim(), req.user.id, now);
  const roomId = result.lastInsertRowid;

  // Add creator + selected members
  const addMember = db.prepare(
    'INSERT OR IGNORE INTO chat_room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)'
  );
  const allIds = [...new Set([req.user.id, ...member_ids.map(Number)])];
  allIds.forEach(uid => addMember.run(roomId, uid, now));

  const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(roomId);
  res.status(201).json({ room });
});

// DELETE /api/chat/rooms/:roomId — delete group room (admin/manager or creator)
router.delete('/rooms/:roomId', (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.type === 'general') return res.status(400).json({ error: 'Cannot delete General room' });
  if (!['admin', 'manager'].includes(req.user.role) && room.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.prepare('DELETE FROM chat_messages WHERE room_id = ?').run(room.id);
  db.prepare('DELETE FROM chat_room_members WHERE room_id = ?').run(room.id);
  db.prepare('DELETE FROM chat_rooms WHERE id = ?').run(room.id);
  res.json({ success: true });
});

module.exports = router;
