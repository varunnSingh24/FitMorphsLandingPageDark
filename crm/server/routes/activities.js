const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { istNow } = require('../utils/time');

const router = express.Router();
router.use(authenticate);

// GET /api/activities/lead/:leadId
router.get('/lead/:leadId', (req, res) => {
  const db = getDb();
  const activities = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM activities a
    JOIN users u ON a.user_id = u.id
    WHERE a.lead_id = ?
    ORDER BY a.created_at DESC
  `).all(req.params.leadId);

  res.json({ activities });
});

// POST /api/activities (manual note)
router.post('/', (req, res) => {
  const db = getDb();
  const { lead_id, activity_type = 'note', description } = req.body;

  if (!lead_id || !description) {
    return res.status(400).json({ error: 'lead_id and description required' });
  }

  const result = db.prepare(`
    INSERT INTO activities (lead_id, user_id, activity_type, description) VALUES (?, ?, ?, ?)
  `).run(lead_id, req.user.id, activity_type, description);

  const now = istNow();
  db.prepare('UPDATE leads SET updated_at = ? WHERE id = ?').run(now, lead_id);

  res.status(201).json({ id: result.lastInsertRowid, success: true });
});

module.exports = router;
