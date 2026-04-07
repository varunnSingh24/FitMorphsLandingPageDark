const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/users
router.get('/', (req, res) => {
  const db = getDb();
  const users = db.prepare(
    'SELECT id, name, email, role, phone, is_active, created_at FROM users ORDER BY name'
  ).all();
  res.json({ users });
});

// PUT /api/users/me  — self-update (any logged-in user)
router.put('/me', (req, res) => {
  const db = getDb();
  const { name, phone, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let query = 'UPDATE users SET name=?, phone=?';
  const params = [name || user.name, phone !== undefined ? phone : user.phone];

  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    query += ', password_hash=?';
    params.push(bcrypt.hashSync(password, 10));
  }
  query += ' WHERE id=?';
  params.push(user.id);

  db.prepare(query).run(...params);
  const updated = db.prepare('SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE id = ?').get(user.id);
  res.json({ user: updated });
});

// GET /api/users/:id  — profile with stats (self or admin/manager)
router.get('/:id', (req, res) => {
  const db = getDb();
  const targetId = parseInt(req.params.id);

  // Only allow: own profile, or admin/manager
  if (req.user.id !== targetId && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const user = db.prepare(
    'SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE id = ?'
  ).get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Stats
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const totalLeads = db.prepare('SELECT COUNT(*) as c FROM leads WHERE assigned_to = ?').get(targetId).c;
  const activeLeads = db.prepare("SELECT COUNT(*) as c FROM leads WHERE assigned_to = ? AND status NOT IN ('converted','lost','junk')").get(targetId).c;
  const conversions = db.prepare("SELECT COUNT(*) as c FROM leads WHERE assigned_to = ? AND status = 'converted'").get(targetId).c;
  const callsMonth = db.prepare("SELECT COUNT(*) as c FROM call_logs WHERE called_by = ? AND created_at >= ?").get(targetId, monthStart).c;
  const callsTotal = db.prepare('SELECT COUNT(*) as c FROM call_logs WHERE called_by = ?').get(targetId).c;
  const pendingFollowUps = db.prepare("SELECT COUNT(*) as c FROM follow_ups WHERE assigned_to = ? AND is_completed = 0").get(targetId).c;
  const overdueFollowUps = db.prepare(
    "SELECT COUNT(*) as c FROM follow_ups WHERE assigned_to = ? AND is_completed = 0 AND follow_up_date < date('now')"
  ).get(targetId).c;

  // Recent calls (last 15)
  const recentCalls = db.prepare(`
    SELECT cl.*, l.full_name as lead_name, l.phone as lead_phone
    FROM call_logs cl
    JOIN leads l ON cl.lead_id = l.id
    WHERE cl.called_by = ?
    ORDER BY cl.created_at DESC LIMIT 15
  `).all(targetId);

  // Assigned leads (latest 20)
  const assignedLeads = db.prepare(`
    SELECT l.id, l.full_name, l.phone, l.status, l.priority, l.source, l.created_at,
           (SELECT MAX(cl2.created_at) FROM call_logs cl2 WHERE cl2.lead_id = l.id) as last_call
    FROM leads l
    WHERE l.assigned_to = ?
    ORDER BY l.updated_at DESC LIMIT 20
  `).all(targetId);

  res.json({
    user,
    stats: { totalLeads, activeLeads, conversions, callsMonth, callsTotal, pendingFollowUps, overdueFollowUps },
    recentCalls,
    assignedLeads,
  });
});

// POST /api/users (admin only)
router.post('/', requireRole('admin'), (req, res) => {
  const db = getDb();
  const { name, email, password, role, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, role required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'Email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email.toLowerCase().trim(), hash, role, phone || null);

  const user = db.prepare('SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ user });
});

// PUT /api/users/:id (admin only)
router.put('/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  const { name, email, role, phone, is_active, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updates = {
    name: name || user.name,
    email: email ? email.toLowerCase().trim() : user.email,
    role: role || user.role,
    phone: phone !== undefined ? phone : user.phone,
    is_active: is_active !== undefined ? (is_active ? 1 : 0) : user.is_active,
  };

  let query = 'UPDATE users SET name=?, email=?, role=?, phone=?, is_active=?';
  const params = [updates.name, updates.email, updates.role, updates.phone, updates.is_active];

  if (password) {
    query += ', password_hash=?';
    params.push(bcrypt.hashSync(password, 10));
  }

  query += ' WHERE id=?';
  params.push(user.id);

  db.prepare(query).run(...params);
  const updated = db.prepare('SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE id = ?').get(user.id);
  res.json({ user: updated });
});

// DELETE /api/users/:id (admin only, cannot delete self)
router.delete('/:id', requireRole('admin'), (req, res) => {
  const db = getDb();
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ success: true });
});

module.exports = router;
