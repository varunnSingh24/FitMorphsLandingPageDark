const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { istNow, istToday } = require('../utils/time');

const router = express.Router();
router.use(authenticate);

// Helper — 403 if a sales_agent / dietician tries to touch a lead they don't own
function assertLeadAccess(db, leadId, user) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
  if (!lead) return { error: 'Lead not found', status: 404 };
  if (['sales_agent', 'dietician'].includes(user.role) && lead.assigned_to !== user.id) {
    return { error: 'Access denied', status: 403 };
  }
  return { lead };
}

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

  const check = assertLeadAccess(db, lead_id, req.user);
  if (check.error) return res.status(check.status).json({ error: check.error });
  const lead = check.lead;

  const assignee = assigned_to || req.user.id;
  const now = istNow();

  try {
    const txn = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO follow_ups (lead_id, assigned_to, follow_up_date, follow_up_time, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(lead_id, assignee, follow_up_date, follow_up_time || null, note || null, now);

      // Update lead status to follow_up (skip if lead is already terminal)
      if (!['converted', 'lost', 'junk'].includes(lead.status)) {
        db.prepare("UPDATE leads SET status = 'follow_up', updated_at = ? WHERE id = ?").run(now, lead_id);
        db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'note', ?, ?)`)
          .run(lead_id, req.user.id, `Follow-up scheduled for ${follow_up_date}${follow_up_time ? ' ' + follow_up_time : ''}`, now);
      }

      return result.lastInsertRowid;
    });

    const id = txn();
    res.status(201).json({ id, success: true });
  } catch (err) {
    console.error('[followUps.POST] failed:', err);
    res.status(500).json({ error: 'Failed to create follow-up' });
  }
});

// PUT /api/follow-ups/:id/complete
router.put('/:id/complete', (req, res) => {
  const db = getDb();
  const followUp = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(req.params.id);
  if (!followUp) return res.status(404).json({ error: 'Follow-up not found' });

  // Ownership check via lead
  const check = assertLeadAccess(db, followUp.lead_id, req.user);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const now = istNow();

  try {
    const txn = db.transaction(() => {
      db.prepare('UPDATE follow_ups SET is_completed = 1, completed_at = ? WHERE id = ?').run(now, followUp.id);
      db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'note', ?, ?)`)
        .run(followUp.lead_id, req.user.id, `Follow-up marked as completed`, now);
    });
    txn();
    res.json({ success: true });
  } catch (err) {
    console.error('[followUps.complete] failed:', err);
    res.status(500).json({ error: 'Failed to complete follow-up' });
  }
});

// GET /api/follow-ups/lead/:leadId/pending — pending follow-ups for a lead
router.get('/lead/:leadId/pending', (req, res) => {
  const db = getDb();

  const check = assertLeadAccess(db, req.params.leadId, req.user);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const followUps = db.prepare(`
    SELECT f.id, f.follow_up_date, f.follow_up_time, f.note
    FROM follow_ups f
    WHERE f.lead_id = ? AND f.is_completed = 0
    ORDER BY f.follow_up_date ASC
  `).all(req.params.leadId);

  res.json({ followUps });
});

module.exports = router;
