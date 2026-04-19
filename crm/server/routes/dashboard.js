const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { istToday } = require('../utils/time');

const router = express.Router();
router.use(authenticate);

router.get('/stats', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;

  const whereClause = ['sales_agent','dietician'].includes(role) ? `WHERE l.assigned_to = ${userId}` : '';
  const today = istToday();

  const total = db.prepare(`SELECT COUNT(*) as c FROM leads l ${whereClause}`).get().c;
  const newToday = db.prepare(`SELECT COUNT(*) as c FROM leads l ${whereClause ? whereClause + ' AND' : 'WHERE'} date(l.created_at) = '${today}'`).get().c;
  const contacted = db.prepare(`SELECT COUNT(*) as c FROM leads l ${whereClause ? whereClause + ' AND' : 'WHERE'} l.status = 'contacted'`).get().c;
  const converted = db.prepare(`SELECT COUNT(*) as c FROM leads l ${whereClause ? whereClause + ' AND' : 'WHERE'} l.status = 'converted'`).get().c;
  const lost = db.prepare(`SELECT COUNT(*) as c FROM leads l ${whereClause ? whereClause + ' AND' : 'WHERE'} l.status = 'lost'`).get().c;

  // Pipeline funnel
  const funnelStages = ['new', 'contacted', 'interested', 'follow_up', 'negotiation', 'converted', 'lost', 'junk'];
  const funnel = funnelStages.map(status => {
    const count = db.prepare(`SELECT COUNT(*) as c FROM leads l ${whereClause ? whereClause + ' AND' : 'WHERE'} l.status = '${status}'`).get().c;
    return { status, count };
  });

  // Recent activity
  const activityWhere = ['sales_agent','dietician'].includes(role) ? `WHERE a.user_id = ${userId}` : '';
  const recentActivity = db.prepare(`
    SELECT a.*, u.name as user_name, l.full_name as lead_name
    FROM activities a
    JOIN users u ON a.user_id = u.id
    JOIN leads l ON a.lead_id = l.id
    ${activityWhere}
    ORDER BY a.created_at DESC
    LIMIT 10
  `).all();

  res.json({ total, newToday, contacted, converted, lost, funnel, recentActivity });
});

router.get('/follow-ups-today', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;
  const today = istToday();

  const whereUser = ['sales_agent','dietician'].includes(role) ? `AND f.assigned_to = ${userId}` : '';

  const followUps = db.prepare(`
    SELECT f.*, l.full_name as lead_name, l.phone as lead_phone, l.status as lead_status,
           u.name as assigned_name
    FROM follow_ups f
    JOIN leads l ON f.lead_id = l.id
    JOIN users u ON f.assigned_to = u.id
    WHERE f.is_completed = 0 AND f.follow_up_date <= '${today}' ${whereUser}
    ORDER BY f.follow_up_date ASC, f.follow_up_time ASC
  `).all();

  res.json({ followUps });
});

router.get('/team-performance', (req, res) => {
  const db = getDb();
  const { role } = req.user;

  if (['sales_agent','dietician'].includes(role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const today = istToday();
  const monthStartStr = istToday().slice(0, 7) + '-01'; // YYYY-MM-01 in IST

  const agents = db.prepare(`
    SELECT u.id, u.name, u.email, u.role,
      (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id) as total_leads,
      (SELECT COUNT(*) FROM call_logs WHERE called_by = u.id AND date(created_at) = '${today}') as calls_today,
      (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id AND status = 'converted' AND date(updated_at) >= '${monthStartStr}') as conversions_this_month
    FROM users u
    WHERE u.is_active = 1 AND u.role IN ('sales_agent', 'manager', 'dietician')
    ORDER BY total_leads DESC
  `).all();

  res.json({ agents });
});

// GET /api/dashboard/activity-log?date=YYYY-MM-DD&user_id=N&mode=all
router.get('/activity-log', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;
  const { date, user_id, mode } = req.query;

  // Agents can only see their own
  const effectiveUserId = ['sales_agent', 'dietician'].includes(role)
    ? userId
    : (user_id ? parseInt(user_id) : null);

  let conditions = [];
  const params = [];

  if (mode !== 'all' && date) {
    conditions.push(`date(a.created_at) = ?`);
    params.push(date);
  } else if (mode !== 'all') {
    // Default: today
    conditions.push(`date(a.created_at) = ?`);
    params.push(istToday());
  }

  if (effectiveUserId) {
    conditions.push(`a.user_id = ?`);
    params.push(effectiveUserId);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const activities = db.prepare(`
    SELECT a.id, a.lead_id, a.user_id, a.activity_type, a.description, a.created_at,
           u.name as user_name, u.role as user_role,
           l.full_name as lead_name, l.phone as lead_phone, l.status as lead_status
    FROM activities a
    JOIN users u ON a.user_id = u.id
    JOIN leads l ON a.lead_id = l.id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT 200
  `).all(...params);

  // Summary counts
  const summary = {
    total: activities.length,
    calls:          activities.filter(a => a.activity_type === 'call').length,
    status_changes: activities.filter(a => a.activity_type === 'status_change').length,
    notes:          activities.filter(a => a.activity_type === 'note').length,
  };

  // Users list for filter dropdown (admin/manager only)
  let users = [];
  if (['admin', 'manager'].includes(role)) {
    users = db.prepare(
      `SELECT id, name, role FROM users WHERE is_active = 1 AND role IN ('sales_agent','manager','dietician','admin') ORDER BY name`
    ).all();
  }

  res.json({ activities, summary, users, date: date || istToday(), mode: mode || 'date' });
});

// GET /api/dashboard/daily-activity?date=YYYY-MM-DD&user_id=N
// Returns per-member daily stats. Agents see only themselves.
router.get('/daily-activity', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;
  const date = req.query.date || istToday();

  // Agents can only see themselves
  const filterUserId = ['sales_agent', 'dietician'].includes(role)
    ? userId
    : (req.query.user_id ? parseInt(req.query.user_id) : null);

  const userWhere = filterUserId ? `AND u.id = ${filterUserId}` : '';

  const rows = db.prepare(`
    SELECT
      u.id, u.name, u.role,
      (SELECT COUNT(*) FROM call_logs cl
        WHERE cl.called_by = u.id AND date(cl.created_at) = ?) AS calls,
      (SELECT COUNT(*) FROM leads l
        WHERE l.assigned_to = u.id AND date(l.created_at) = ?) AS leads_added,
      (SELECT COUNT(*) FROM activities a
        WHERE a.user_id = u.id AND a.activity_type = 'note' AND date(a.created_at) = ?) AS notes,
      (SELECT COUNT(*) FROM activities a
        WHERE a.user_id = u.id AND a.activity_type = 'status_change' AND date(a.created_at) = ?) AS stage_moves,
      (SELECT COUNT(*) FROM leads l
        WHERE l.assigned_to = u.id AND l.status = 'converted' AND date(l.updated_at) = ?) AS conversions,
      (SELECT COUNT(*) FROM follow_ups f
        WHERE f.assigned_to = u.id AND f.is_completed = 1 AND date(f.updated_at) = ?) AS followups_done
    FROM users u
    WHERE u.is_active = 1
      AND u.role IN ('sales_agent', 'manager', 'dietician', 'admin')
      ${userWhere}
    ORDER BY (calls + leads_added + notes + stage_moves) DESC
  `).all(date, date, date, date, date, date);

  // Users list for dropdown (admin/manager only)
  let users = [];
  if (['admin', 'manager'].includes(role)) {
    users = db.prepare(
      `SELECT id, name, role FROM users WHERE is_active = 1
       AND role IN ('sales_agent','manager','dietician','admin') ORDER BY name`
    ).all();
  }

  res.json({ rows, date, users });
});

module.exports = router;
