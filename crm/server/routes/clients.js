const express = require('express');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { istNow } = require('../utils/time');

const router = express.Router();
router.use(authenticate);

// GET /api/clients
router.get('/', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;
  const { status, dietitian_id, search } = req.query;

  let conditions = [];
  const params = [];

  if (['sales_agent', 'dietician'].includes(role)) {
    conditions.push('c.dietitian_id = ?');
    params.push(userId);
  } else if (dietitian_id) {
    conditions.push('c.dietitian_id = ?');
    params.push(dietitian_id);
  }

  if (status) { conditions.push('c.status = ?'); params.push(status); }
  if (search) {
    conditions.push('(l.full_name LIKE ? OR l.phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const clients = db.prepare(`
    SELECT c.*, l.full_name, l.phone, l.email, l.city, l.gender, l.age,
           u.name as dietitian_name,
           (SELECT MAX(ch.created_at) FROM checkins ch WHERE ch.client_id = c.id) as last_checkin,
           (SELECT COUNT(*) FROM checkins ch WHERE ch.client_id = c.id) as total_checkins
    FROM clients c
    JOIN leads l ON c.lead_id = l.id
    LEFT JOIN users u ON c.dietitian_id = u.id
    ${where}
    ORDER BY c.updated_at DESC
  `).all(...params);

  res.json({ clients });
});

// GET /api/clients/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;

  const client = db.prepare(`
    SELECT c.*, l.full_name, l.phone, l.email, l.city, l.gender, l.age,
           l.interested_in, l.notes as lead_notes,
           u.name as dietitian_name, u.phone as dietitian_phone
    FROM clients c
    JOIN leads l ON c.lead_id = l.id
    LEFT JOIN users u ON c.dietitian_id = u.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (['sales_agent', 'dietician'].includes(role) && client.dietitian_id !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Get medical history from lead
  const medical = db.prepare('SELECT * FROM medical_histories WHERE lead_id = ?').get(client.lead_id);

  // Get checkins
  const checkins = db.prepare(`
    SELECT ch.*, u.name as dietitian_name
    FROM checkins ch
    JOIN users u ON ch.dietitian_id = u.id
    WHERE ch.client_id = ?
    ORDER BY ch.created_at DESC
  `).all(client.id);

  res.json({ client, medical: medical || null, checkins });
});

// POST /api/clients (convert lead → client)
router.post('/', requireRole('admin', 'manager'), (req, res) => {
  const db = getDb();
  const { lead_id, dietitian_id, program_type, start_date, end_date, target_weight_kg, notes } = req.body;

  if (!lead_id || !start_date) {
    return res.status(400).json({ error: 'lead_id and start_date required' });
  }

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  // Check if already a client
  const existing = db.prepare('SELECT id FROM clients WHERE lead_id = ?').get(lead_id);
  if (existing) return res.status(409).json({ error: 'Lead is already a client' });

  // Get current weight from medical history
  const medical = db.prepare('SELECT weight_kg FROM medical_histories WHERE lead_id = ?').get(lead_id);

  const now = istNow();
  const result = db.prepare(`
    INSERT INTO clients (lead_id, dietitian_id, program_type, start_date, end_date,
      current_weight_kg, target_weight_kg, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(lead_id, dietitian_id || null, program_type || 'custom', start_date,
    end_date || null, medical?.weight_kg || null, target_weight_kg || null,
    notes || null, now, now);

  // Update lead status to converted
  db.prepare("UPDATE leads SET status = 'converted', updated_at = ? WHERE id = ?").run(now, lead_id);
  db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description) VALUES (?, ?, 'status_change', ?)`)
    .run(lead_id, req.user.id, 'Lead converted to active client');

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ client });
});

// PUT /api/clients/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  // Dieticians can update their own clients, admin/manager can update any
  if (['sales_agent', 'dietician'].includes(role) && client.dietitian_id !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { dietitian_id, program_type, start_date, end_date, current_weight_kg,
    target_weight_kg, status, notes } = req.body;

  const now = istNow();
  db.prepare(`
    UPDATE clients SET dietitian_id=?, program_type=?, start_date=?, end_date=?,
      current_weight_kg=?, target_weight_kg=?, status=?, notes=?, updated_at=?
    WHERE id=?
  `).run(
    dietitian_id !== undefined ? dietitian_id : client.dietitian_id,
    program_type || client.program_type,
    start_date || client.start_date,
    end_date !== undefined ? end_date : client.end_date,
    current_weight_kg !== undefined ? current_weight_kg : client.current_weight_kg,
    target_weight_kg !== undefined ? target_weight_kg : client.target_weight_kg,
    status || client.status,
    notes !== undefined ? notes : client.notes,
    now, client.id
  );

  res.json({ client: db.prepare('SELECT * FROM clients WHERE id = ?').get(client.id) });
});

// POST /api/clients/:id/checkins
router.post('/:id/checkins', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (['sales_agent', 'dietician'].includes(role) && client.dietitian_id !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { checkin_type, weight_kg, compliance, energy_level, notes, next_checkin_date } = req.body;
  if (!checkin_type) return res.status(400).json({ error: 'checkin_type required' });

  const now = istNow();

  const result = db.prepare(`
    INSERT INTO checkins (client_id, dietitian_id, checkin_type, weight_kg, compliance, energy_level, notes, next_checkin_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(client.id, userId, checkin_type, weight_kg || null, compliance || null,
    energy_level || null, notes || null, next_checkin_date || null);

  // Update client weight if provided
  if (weight_kg) {
    db.prepare('UPDATE clients SET current_weight_kg = ?, updated_at = ? WHERE id = ?')
      .run(weight_kg, now, client.id);
  }

  // Update client updated_at
  db.prepare('UPDATE clients SET updated_at = ? WHERE id = ?').run(now, client.id);

  // Create reminder for next checkin if date provided
  if (next_checkin_date) {
    db.prepare(`
      INSERT INTO reminders (user_id, reminder_type, ref_type, ref_id, title, message, due_at)
      VALUES (?, 'checkin', 'client', ?, ?, ?, ?)
    `).run(userId, client.id,
      `Check-in: ${checkin_type.replace(/_/g, ' ')}`,
      `Scheduled check-in with client`,
      next_checkin_date + ' 10:00:00');
  }

  // Log activity on the lead
  db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description) VALUES (?, ?, 'note', ?)`)
    .run(client.lead_id, userId, `${checkin_type.replace(/_/g, ' ')} logged${weight_kg ? ` — ${weight_kg}kg` : ''}${compliance ? ` — ${compliance}` : ''}`);

  res.status(201).json({ id: result.lastInsertRowid, success: true });
});

// DELETE /api/clients/:id (admin only)
router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  db.transaction(() => {
    db.prepare('DELETE FROM checkins WHERE client_id = ?').run(client.id);
    db.prepare("DELETE FROM reminders WHERE ref_type = 'client' AND ref_id = ?").run(client.id);
    db.prepare('DELETE FROM clients WHERE id = ?').run(client.id);
  })();

  res.json({ success: true });
});

module.exports = router;
