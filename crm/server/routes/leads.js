const express = require('express');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');
const { istNow } = require('../utils/time');

const router = express.Router();
router.use(authenticate);

// GET /api/leads
router.get('/', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;
  const { status, source, assigned_to, priority, search, date_from, date_to, page = 1, limit = 50 } = req.query;

  let conditions = [];
  const params = [];

  if (['sales_agent','dietician'].includes(role)) {
    conditions.push('l.assigned_to = ?');
    params.push(userId);
  } else if (assigned_to) {
    conditions.push('l.assigned_to = ?');
    params.push(assigned_to);
  }

  if (status) { conditions.push('l.status = ?'); params.push(status); }
  if (source) { conditions.push('l.source = ?'); params.push(source); }
  if (priority) { conditions.push('l.priority = ?'); params.push(priority); }
  if (date_from) { conditions.push(`date(l.created_at) >= ?`); params.push(date_from); }
  if (date_to) { conditions.push(`date(l.created_at) <= ?`); params.push(date_to); }
  if (search) {
    conditions.push('(l.full_name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const total = db.prepare(`SELECT COUNT(*) as c FROM leads l ${where}`).get(...params).c;
  const leads = db.prepare(`
    SELECT l.*, u.name as assigned_name,
      (SELECT created_at FROM activities WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_activity
    FROM leads l
    LEFT JOIN users u ON l.assigned_to = u.id
    ${where}
    ORDER BY l.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ leads, total, page: parseInt(page), limit: parseInt(limit) });
});

// POST /api/leads
router.post('/', (req, res) => {
  const db = getDb();
  const { full_name, email, phone, secondary_phone, gender, age, source, source_detail,
    status = 'new', assigned_to, priority = 'warm', interested_in, notes, city, locality } = req.body;

  if (!full_name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }

  const now = istNow();
  const result = db.prepare(`
    INSERT INTO leads (full_name, email, phone, secondary_phone, gender, age, source, source_detail,
      status, assigned_to, priority, interested_in, notes, city, locality, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(full_name, email || null, phone, secondary_phone || null, gender || null, age || null,
    source || null, source_detail || null, status,
    assigned_to || req.user.id, priority, interested_in || null, notes || null,
    city || null, locality || null, now, now);

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);

  // Log activity
  db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'note', ?, ?)`)
    .run(lead.id, req.user.id, `Lead created by ${req.user.name}`, now);

  res.status(201).json({ lead });
});

// GET /api/leads/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;

  const lead = db.prepare(`
    SELECT l.*, u.name as assigned_name, u.email as assigned_email, u.phone as assigned_phone
    FROM leads l
    LEFT JOIN users u ON l.assigned_to = u.id
    WHERE l.id = ?
  `).get(req.params.id);

  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (['sales_agent','dietician'].includes(role) && lead.assigned_to !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({ lead });
});

// PUT /api/leads/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (['sales_agent','dietician'].includes(role) && lead.assigned_to !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { full_name, email, phone, secondary_phone, gender, age, source, source_detail,
    priority, interested_in, notes, city, locality } = req.body;

  const now = istNow();
  db.prepare(`
    UPDATE leads SET full_name=?, email=?, phone=?, secondary_phone=?, gender=?, age=?,
      source=?, source_detail=?, priority=?, interested_in=?, notes=?, city=?, locality=?, updated_at=?
    WHERE id=?
  `).run(full_name || lead.full_name, email ?? lead.email, phone || lead.phone,
    secondary_phone ?? lead.secondary_phone, gender ?? lead.gender, age ?? lead.age,
    source ?? lead.source, source_detail ?? lead.source_detail,
    priority || lead.priority, interested_in ?? lead.interested_in,
    notes ?? lead.notes, city ?? lead.city, locality ?? lead.locality, now, lead.id);

  db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'note', ?, ?)`)
    .run(lead.id, userId, `Lead info updated by ${req.user.name}`, now);

  res.json({ lead: db.prepare('SELECT * FROM leads WHERE id = ?').get(lead.id) });
});

// PUT /api/leads/:id/status
router.put('/:id/status', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: 'Status required' });

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (['sales_agent','dietician'].includes(role) && lead.assigned_to !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const now = istNow();
  db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').run(status, now, lead.id);

  db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'status_change', ?, ?)`)
    .run(lead.id, userId, `Status changed: ${lead.status} → ${status}`, now);

  res.json({ success: true, status });
});

// PUT /api/leads/:id/assign
router.put('/:id/assign', requireRole('admin', 'manager'), (req, res) => {
  const db = getDb();
  const { assigned_to } = req.body;
  if (!assigned_to) return res.status(400).json({ error: 'assigned_to required' });

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const agent = db.prepare('SELECT * FROM users WHERE id = ?').get(assigned_to);
  if (!agent) return res.status(404).json({ error: 'User not found' });

  const now = istNow();
  db.prepare('UPDATE leads SET assigned_to = ?, updated_at = ? WHERE id = ?').run(assigned_to, now, lead.id);

  db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'assignment_change', ?, ?)`)
    .run(lead.id, req.user.id, `Lead assigned to ${agent.name}`, now);

  res.json({ success: true });
});

// GET /api/leads/:id/medical
router.get('/:id/medical', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;
  const lead = db.prepare('SELECT id, assigned_to FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (['sales_agent','dietician'].includes(role) && lead.assigned_to !== userId) return res.status(403).json({ error: 'Access denied' });

  const medical = db.prepare('SELECT * FROM medical_histories WHERE lead_id = ?').get(req.params.id);
  res.json({ medical: medical || null });
});

// PUT /api/leads/:id/medical  (upsert)
router.put('/:id/medical', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;
  const lead = db.prepare('SELECT id, assigned_to FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (['sales_agent','dietician'].includes(role) && lead.assigned_to !== userId) return res.status(403).json({ error: 'Access denied' });

  const {
    height_cm, weight_kg, blood_group, health_conditions,
    past_surgeries, current_medications, allergies,
    fitness_level, dietary_preference, smoking, alcohol,
    doctor_name, doctor_clearance,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    additional_notes,
  } = req.body;

  const now = istNow();
  const existing = db.prepare('SELECT id FROM medical_histories WHERE lead_id = ?').get(lead.id);
  const conditionsJson = Array.isArray(health_conditions) ? JSON.stringify(health_conditions) : (health_conditions || null);

  if (existing) {
    db.prepare(`
      UPDATE medical_histories SET
        height_cm=?, weight_kg=?, blood_group=?, health_conditions=?,
        past_surgeries=?, current_medications=?, allergies=?,
        fitness_level=?, dietary_preference=?, smoking=?, alcohol=?,
        doctor_name=?, doctor_clearance=?,
        emergency_contact_name=?, emergency_contact_phone=?, emergency_contact_relation=?,
        additional_notes=?, updated_at=?
      WHERE lead_id=?
    `).run(height_cm||null, weight_kg||null, blood_group||null, conditionsJson,
      past_surgeries||null, current_medications||null, allergies||null,
      fitness_level||null, dietary_preference||null, smoking||null, alcohol||null,
      doctor_name||null, doctor_clearance||null,
      emergency_contact_name||null, emergency_contact_phone||null, emergency_contact_relation||null,
      additional_notes||null, now, lead.id);
  } else {
    db.prepare(`
      INSERT INTO medical_histories (lead_id, height_cm, weight_kg, blood_group, health_conditions,
        past_surgeries, current_medications, allergies, fitness_level, dietary_preference, smoking, alcohol,
        doctor_name, doctor_clearance, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
        additional_notes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(lead.id, height_cm||null, weight_kg||null, blood_group||null, conditionsJson,
      past_surgeries||null, current_medications||null, allergies||null,
      fitness_level||null, dietary_preference||null, smoking||null, alcohol||null,
      doctor_name||null, doctor_clearance||null,
      emergency_contact_name||null, emergency_contact_phone||null, emergency_contact_relation||null,
      additional_notes||null, now, now);
  }

  db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'note', ?, ?)`)
    .run(lead.id, userId, `Medical history updated by ${req.user.name}`, now);

  const medical = db.prepare('SELECT * FROM medical_histories WHERE lead_id = ?').get(lead.id);
  res.json({ medical });
});

// POST /api/leads/bulk-assign
router.post('/bulk-assign', requireRole('admin', 'manager'), (req, res) => {
  const db = getDb();
  const { lead_ids, assigned_to } = req.body;

  if (!lead_ids?.length || !assigned_to) {
    return res.status(400).json({ error: 'lead_ids and assigned_to required' });
  }

  const agent = db.prepare('SELECT * FROM users WHERE id = ?').get(assigned_to);
  if (!agent) return res.status(404).json({ error: 'User not found' });

  const now = istNow();
  const stmt = db.prepare('UPDATE leads SET assigned_to = ?, updated_at = ? WHERE id = ?');
  const actStmt = db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'assignment_change', ?, ?)`);

  db.transaction(() => {
    lead_ids.forEach(id => {
      stmt.run(assigned_to, now, id);
      actStmt.run(id, req.user.id, `Lead bulk-assigned to ${agent.name}`, now);
    });
  })();

  res.json({ success: true, count: lead_ids.length });
});

// Helper: delete a client and all its child records by client id
function deleteClientData(db, clientId) {
  db.prepare('DELETE FROM client_checkins  WHERE client_id = ?').run(clientId);
  db.prepare('DELETE FROM bsl_readings     WHERE client_id = ?').run(clientId);
  db.prepare('DELETE FROM hba1c_records    WHERE client_id = ?').run(clientId);
  db.prepare('DELETE FROM measurements     WHERE client_id = ?').run(clientId);
  db.prepare("DELETE FROM reminders WHERE ref_type = 'client' AND ref_id = ?").run(clientId);
  db.prepare('DELETE FROM clients          WHERE id = ?').run(clientId);
}

// Helper: fully delete one lead and everything linked to it
function deleteLeadCascade(db, leadId) {
  // If lead was converted, remove the client and all its data first
  const client = db.prepare('SELECT id FROM clients WHERE lead_id = ?').get(leadId);
  if (client) deleteClientData(db, client.id);

  // Remove lead-scoped reminders
  db.prepare("DELETE FROM reminders WHERE ref_type = 'lead' AND ref_id = ?").run(leadId);

  db.prepare('DELETE FROM call_logs        WHERE lead_id = ?').run(leadId);
  db.prepare('DELETE FROM activities       WHERE lead_id = ?').run(leadId);
  db.prepare('DELETE FROM follow_ups       WHERE lead_id = ?').run(leadId);
  db.prepare('DELETE FROM medical_histories WHERE lead_id = ?').run(leadId);
  db.prepare('DELETE FROM leads            WHERE id = ?').run(leadId);
}

// DELETE /api/leads/:id (admin/manager only)
router.delete('/:id', requireRole('admin', 'manager'), (req, res) => {
  const db = getDb();
  const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  db.transaction(() => deleteLeadCascade(db, lead.id))();
  res.json({ success: true });
});

// POST /api/leads/bulk-delete (admin/manager only)
router.post('/bulk-delete', requireRole('admin', 'manager'), (req, res) => {
  const db = getDb();
  const { lead_ids } = req.body;
  if (!lead_ids?.length) return res.status(400).json({ error: 'lead_ids required' });

  db.transaction(() => {
    lead_ids.forEach(id => deleteLeadCascade(db, id));
  })();

  res.json({ success: true, count: lead_ids.length });
});

module.exports = router;
