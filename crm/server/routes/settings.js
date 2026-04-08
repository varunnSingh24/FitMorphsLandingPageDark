const express = require('express');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/settings/:key — anyone can read settings
router.get('/:key', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key);
  if (!row) return res.status(404).json({ error: 'Setting not found' });
  try {
    res.json({ key: req.params.key, value: JSON.parse(row.value) });
  } catch {
    res.json({ key: req.params.key, value: row.value });
  }
});

// PUT /api/settings/:key — admin only
router.put('/:key', requireRole('admin'), (req, res) => {
  const db = getDb();
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value required' });

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const now = new Date().toISOString().replace('T', ' ').split('.')[0];

  const existing = db.prepare('SELECT key FROM settings WHERE key = ?').get(req.params.key);
  if (existing) {
    db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(serialized, now, req.params.key);
  } else {
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(req.params.key, serialized, now);
  }

  res.json({ success: true });
});

module.exports = router;
