const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { istNow } = require('../utils/time');

const router = express.Router();
router.use(authenticate);

// Helper: verify client access
function getClient(db, clientId, user, res) {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) { res.status(404).json({ error: 'Client not found' }); return null; }
  if (['sales_agent', 'dietician'].includes(user.role) && client.dietitian_id !== user.id) {
    res.status(403).json({ error: 'Access denied' }); return null;
  }
  return client;
}

// GET /api/bsl/client/:clientId
router.get('/client/:clientId', (req, res) => {
  const db = getDb();
  if (!getClient(db, req.params.clientId, req.user, res)) return;

  const readings = db.prepare(`
    SELECT b.*, u.name as logged_by_name
    FROM bsl_readings b
    JOIN users u ON b.logged_by = u.id
    WHERE b.client_id = ?
    ORDER BY b.reading_date DESC, b.created_at DESC
  `).all(req.params.clientId);

  const hba1c = db.prepare(`
    SELECT h.*, u.name as logged_by_name
    FROM hba1c_records h
    JOIN users u ON h.logged_by = u.id
    WHERE h.client_id = ?
    ORDER BY h.test_date DESC
  `).all(req.params.clientId);

  res.json({ readings, hba1c });
});

// POST /api/bsl/client/:clientId/reading
router.post('/client/:clientId/reading', (req, res) => {
  const db = getDb();
  if (!getClient(db, req.params.clientId, req.user, res)) return;

  const { reading_date, fasting_bsl, pp_bsl, random_bsl, comment } = req.body;
  if (!reading_date) return res.status(400).json({ error: 'reading_date is required' });
  if (!fasting_bsl && !pp_bsl && !random_bsl) {
    return res.status(400).json({ error: 'Enter at least one BSL value (fasting, post-meal, or random)' });
  }

  const now = istNow();
  const result = db.prepare(`
    INSERT INTO bsl_readings (client_id, logged_by, reading_date, fasting_bsl, pp_bsl, random_bsl, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.clientId, req.user.id, reading_date,
    fasting_bsl ? parseFloat(fasting_bsl) : null,
    pp_bsl ? parseFloat(pp_bsl) : null,
    random_bsl ? parseFloat(random_bsl) : null,
    comment || null, now
  );

  res.status(201).json({ id: result.lastInsertRowid, success: true });
});

// DELETE /api/bsl/reading/:id
router.delete('/reading/:id', (req, res) => {
  const db = getDb();
  const reading = db.prepare('SELECT * FROM bsl_readings WHERE id = ?').get(req.params.id);
  if (!reading) return res.status(404).json({ error: 'Reading not found' });
  if (!getClient(db, reading.client_id, req.user, res)) return;
  db.prepare('DELETE FROM bsl_readings WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/bsl/client/:clientId/hba1c
router.post('/client/:clientId/hba1c', (req, res) => {
  const db = getDb();
  if (!getClient(db, req.params.clientId, req.user, res)) return;

  const { test_date, hba1c_value, lab_name, notes } = req.body;
  if (!test_date || !hba1c_value) {
    return res.status(400).json({ error: 'test_date and hba1c_value are required' });
  }

  const now = istNow();
  const result = db.prepare(`
    INSERT INTO hba1c_records (client_id, logged_by, test_date, hba1c_value, lab_name, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.clientId, req.user.id, test_date,
    parseFloat(hba1c_value), lab_name || null, notes || null, now
  );

  res.status(201).json({ id: result.lastInsertRowid, success: true });
});

// DELETE /api/bsl/hba1c/:id
router.delete('/hba1c/:id', (req, res) => {
  const db = getDb();
  const record = db.prepare('SELECT * FROM hba1c_records WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'HbA1C record not found' });
  if (!getClient(db, record.client_id, req.user, res)) return;
  db.prepare('DELETE FROM hba1c_records WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
