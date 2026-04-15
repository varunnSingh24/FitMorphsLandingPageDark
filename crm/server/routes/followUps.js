const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { istNow, istToday } = require('../utils/time');

const router = express.Router();
router.use(authenticate);

// GET /api/follow-ups
router.get('/', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;
  const { filter = 'upcoming' } = req.query;

  const today = istToday();
  const whereUser = ['sales_agent','dietician'].includes(role) ? `AND f.assigned_to = ${userId}` : '';

  let dateCondition = '';
  if (filter === 'today') dateCondition = `AND f.follow_up_date = '${today}'`;
  else if (filter === 'overdue') dateCondition = `AND f.follow_up_date < '${today}'`;
  else if (filter === 'upcoming') dateCondition = `AND f.follow_up_date >= '${today}'`;
  else if (filter === 'completed') dateCondition = `AND f.is_completed = 1`;

  const completedCondition = filter === 'completed' ? '' : 'AND f.is_completed = 0';

  const followUps = db.prepare(`
    SELECT f.*, l.full_name as lead_name, l.phone as lead_phone, l.status as lead_status,
           u.name as assigned_name
    FROM follow_ups f
    JOIN leads l ON f.lead_id = l.id
    JOIN users u ON f.assigned_to = u.id
    WHERE 1=1 ${completedCondition} ${dateCondition} ${whereUser}
    ORDER BY f.follow_up_date ASC, f.follow_up_time ASC
  `).all();

  res.json({ followUps });
});

// POST /api/follow-ups
router.post('/', (req, res) => {
  const db = getDb();
  const { lead_id, follow_up_date, follow_up_time, note, assigned_to } = req.body;

  if (!lead_id || !follow_up_date) {
    return res.status(400).json({ error: 'lead_id and follow_up_date required' });
  }

  const assignee = assigned_to || req.user.id;
  const now = istNow();
  const result = db.prepare(`
    INSERT INTO follow_ups (lead_id, assigned_to, follow_up_date, follow_up_time, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(lead_id, assignee, follow_up_date, follow_up_time || null, note || null, now);

  // Update lead status to follow_up
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id);
  if (lead && !['converted', 'lost', 'junk'].includes(lead.status)) {
    db.prepare("UPDATE leads SET status = 'follow_up', updated_at = ? WHERE id = ?").run(now, lead_id);
    db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'note', ?, ?)`)
      .run(lead_id, req.user.id, `Follow-up scheduled for ${follow_up_date}${follow_up_time ? ' ' + follow_up_time : ''}`, now);
  }

  res.status(201).json({ id: result.lastInsertRowid, success: true });
});

// PUT /api/follow-ups/:id/complete
router.put('/:id/complete', (req, res) => {
  const db = getDb();
  const followUp = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(req.params.id);
  if (!followUp) return res.status(404).json({ error: 'Follow-up not found' });

  const now = istNow();
  db.prepare('UPDATE follow_ups SET is_completed = 1, completed_at = ? WHERE id = ?').run(now, followUp.id);

  db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'note', ?, ?)`)
    .run(followUp.lead_id, req.user.id, `Follow-up marked as completed`, now);

  res.json({ success: true });
});

module.exports = router;
