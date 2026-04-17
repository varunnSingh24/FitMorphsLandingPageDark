const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { istNow } = require('../utils/time');

const router = express.Router();
router.use(authenticate);

// Helper: verify client access (same pattern as bsl.js)
function getClient(db, clientId, user, res) {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) { res.status(404).json({ error: 'Client not found' }); return null; }
  if (['sales_agent', 'dietician'].includes(user.role) && client.dietitian_id !== user.id) {
    res.status(403).json({ error: 'Access denied' }); return null;
  }
  return client;
}

// GET /api/measurements/client/:clientId
router.get('/client/:clientId', (req, res) => {
  const db = getDb();
  if (!getClient(db, req.params.clientId, req.user, res)) return;

  const measurements = db.prepare(`
    SELECT m.*, u.name as logged_by_name
    FROM measurements m
    JOIN users u ON m.logged_by = u.id
    WHERE m.client_id = ?
    ORDER BY m.measurement_date DESC, m.created_at DESC
  `).all(req.params.clientId);

  res.json({ measurements });
});

// POST /api/measurements/client/:clientId
router.post('/client/:clientId', (req, res) => {
  const db = getDb();
  if (!getClient(db, req.params.clientId, req.user, res)) return;

  const { measurement_date, waist_cm, hip_cm, chest_cm, arms_cm, thighs_cm, notes } = req.body;
  if (!measurement_date) return res.status(400).json({ error: 'measurement_date is required' });
  if (!waist_cm && !hip_cm && !chest_cm && !arms_cm && !thighs_cm) {
    return res.status(400).json({ error: 'Enter at least one measurement value' });
  }

  const now = istNow();
  const result = db.prepare(`
    INSERT INTO measurements
      (client_id, logged_by, measurement_date, waist_cm, hip_cm, chest_cm, arms_cm, thighs_cm, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.clientId, req.user.id, measurement_date,
    waist_cm   ? parseFloat(waist_cm)   : null,
    hip_cm     ? parseFloat(hip_cm)     : null,
    chest_cm   ? parseFloat(chest_cm)   : null,
    arms_cm    ? parseFloat(arms_cm)    : null,
    thighs_cm  ? parseFloat(thighs_cm)  : null,
    notes || null, now
  );

  res.status(201).json({ id: result.lastInsertRowid, success: true });
});

// DELETE /api/measurements/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const m = db.prepare('SELECT * FROM measurements WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Measurement not found' });
  if (!getClient(db, m.client_id, req.user, res)) return;
  db.prepare('DELETE FROM measurements WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
