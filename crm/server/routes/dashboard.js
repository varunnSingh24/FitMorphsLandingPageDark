const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { istToday, istMonthStart, IST_SQL_SHIFT } = require('../utils/ist');

const router = express.Router();
router.use(authenticate);

router.get('/stats', (req, res) => {
  const db = getDb();
  const { role, id: userId } = req.user;

  const whereClause = ['sales_agent','dietician'].includes(role) ? `WHERE l.assigned_to = ${userId}` : '';
  const today = istToday();

  const total = db.prepare(`SELECT COUNT(*) as c FROM leads l ${whereClause}`).get().c;
  const newToday = db.prepare(`SELECT COUNT(*) as c FROM leads l ${whereClause ? whereClause + ' AND' : 'WHERE'} date(l.created_at, ${IST_SQL_SHIFT}) = '${today}'`).get().c;
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
  const monthStartStr = istMonthStart();

  const agents = db.prepare(`
    SELECT u.id, u.name, u.email, u.role,
      (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id) as total_leads,
      (SELECT COUNT(*) FROM call_logs WHERE called_by = u.id AND date(created_at, ${IST_SQL_SHIFT}) = '${today}') as calls_today,
      (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id AND status = 'converted' AND date(updated_at, ${IST_SQL_SHIFT}) >= '${monthStartStr}') as conversions_this_month
    FROM users u
    WHERE u.is_active = 1 AND u.role IN ('sales_agent', 'manager', 'dietician')
    ORDER BY total_leads DESC
  `).all();

  res.json({ agents });
});

module.exports = router;
