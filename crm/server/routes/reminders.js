const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/reminders — get due/upcoming reminders for current user
router.get('/', (req, res) => {
  const db = getDb();
  const { id: userId } = req.user;
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  const reminders = db.prepare(`
    SELECT r.*,
      CASE
        WHEN r.ref_type = 'client' THEN (SELECT l.full_name FROM clients c JOIN leads l ON c.lead_id = l.id WHERE c.id = r.ref_id)
        WHEN r.ref_type = 'lead' THEN (SELECT l.full_name FROM leads l WHERE l.id = r.ref_id)
        ELSE NULL
      END as ref_name,
      CASE
        WHEN r.ref_type = 'client' THEN (SELECT l.phone FROM clients c JOIN leads l ON c.lead_id = l.id WHERE c.id = r.ref_id)
        WHEN r.ref_type = 'lead' THEN (SELECT l.phone FROM leads l WHERE l.id = r.ref_id)
        ELSE NULL
      END as ref_phone
    FROM reminders r
    WHERE r.user_id = ? AND r.is_done = 0
      AND (r.snoozed_until IS NULL OR r.snoozed_until <= ?)
    ORDER BY r.due_at ASC
    LIMIT 50
  `).all(userId, now);

  // Count overdue
  const overdueCount = db.prepare(`
    SELECT COUNT(*) as c FROM reminders
    WHERE user_id = ? AND is_done = 0 AND due_at <= ?
      AND (snoozed_until IS NULL OR snoozed_until <= ?)
  `).get(userId, now, now).c;

  res.json({ reminders, overdueCount });
});

// PUT /api/reminders/:id/done
router.put('/:id/done', (req, res) => {
  const db = getDb();
  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

  db.prepare('UPDATE reminders SET is_done = 1 WHERE id = ?').run(reminder.id);
  res.json({ success: true });
});

// PUT /api/reminders/:id/snooze
router.put('/:id/snooze', (req, res) => {
  const db = getDb();
  const { duration } = req.body; // '1h', '3h', 'tomorrow'
  const reminder = db.prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!reminder) return res.status(404).json({ error: 'Reminder not found' });

  const now = new Date();
  let snoozeUntil;
  if (duration === '1h') snoozeUntil = new Date(now.getTime() + 3600000);
  else if (duration === '3h') snoozeUntil = new Date(now.getTime() + 10800000);
  else { // tomorrow 9am
    snoozeUntil = new Date(now);
    snoozeUntil.setDate(snoozeUntil.getDate() + 1);
    snoozeUntil.setHours(9, 0, 0, 0);
  }

  db.prepare('UPDATE reminders SET snoozed_until = ? WHERE id = ?')
    .run(snoozeUntil.toISOString().replace('T', ' ').split('.')[0], reminder.id);

  res.json({ success: true });
});

// POST /api/reminders (create custom reminder)
router.post('/', (req, res) => {
  const db = getDb();
  const { title, message, due_at, ref_type, ref_id } = req.body;
  if (!title || !due_at) return res.status(400).json({ error: 'title and due_at required' });

  const result = db.prepare(`
    INSERT INTO reminders (user_id, reminder_type, ref_type, ref_id, title, message, due_at)
    VALUES (?, 'custom', ?, ?, ?, ?, ?)
  `).run(req.user.id, ref_type || null, ref_id || null, title, message || null, due_at);

  res.status(201).json({ id: result.lastInsertRowid, success: true });
});

module.exports = router;
