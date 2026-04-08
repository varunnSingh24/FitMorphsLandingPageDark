const express = require('express');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin', 'manager'));

// GET /api/reports/source
router.get('/source', (req, res) => {
  const db = getDb();
  const { date_from, date_to } = req.query;

  let dateWhere = '';
  const params = [];
  if (date_from) { dateWhere += ' AND date(created_at) >= ?'; params.push(date_from); }
  if (date_to) { dateWhere += ' AND date(created_at) <= ?'; params.push(date_to); }

  const data = db.prepare(`
    SELECT
      source,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted,
      ROUND(100.0 * SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) / COUNT(*), 1) as conversion_rate
    FROM leads
    WHERE source IS NOT NULL ${dateWhere}
    GROUP BY source
    ORDER BY total DESC
  `).all(...params);

  res.json({ data });
});

// GET /api/reports/agent-performance
router.get('/agent-performance', (req, res) => {
  const db = getDb();
  const { date_from, date_to } = req.query;

  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  let leadDateWhere = '';
  const params = [];
  if (date_from) { leadDateWhere += ' AND date(l.created_at) >= ?'; params.push(date_from); }
  if (date_to) { leadDateWhere += ' AND date(l.created_at) <= ?'; params.push(date_to); }

  const agents = db.prepare(`
    SELECT
      u.id, u.name, u.email,
      COUNT(DISTINCT l.id) as total_leads,
      (SELECT COUNT(*) FROM call_logs cl WHERE cl.called_by = u.id ${date_from ? 'AND date(cl.created_at) >= ?' : ''} ${date_to ? 'AND date(cl.created_at) <= ?' : ''}) as total_calls,
      (SELECT COUNT(*) FROM call_logs cl WHERE cl.called_by = u.id AND date(cl.created_at) >= '${weekStartStr}') as calls_this_week,
      (SELECT COUNT(*) FROM call_logs cl WHERE cl.called_by = u.id AND date(cl.created_at) >= '${monthStartStr}') as calls_this_month,
      SUM(CASE WHEN l.status = 'converted' THEN 1 ELSE 0 END) as conversions,
      ROUND(100.0 * SUM(CASE WHEN l.status = 'converted' THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT l.id), 0), 1) as conversion_rate
    FROM users u
    LEFT JOIN leads l ON l.assigned_to = u.id ${leadDateWhere}
    WHERE u.is_active = 1 AND u.role IN ('sales_agent', 'manager', 'dietician')
    GROUP BY u.id
    ORDER BY total_leads DESC
  `).all(...params, ...(date_from ? params.slice(0, 1) : []), ...(date_to ? params.slice(-1) : []));

  res.json({ agents });
});

// GET /api/reports/funnel
router.get('/funnel', (req, res) => {
  const db = getDb();
  const { date_from, date_to } = req.query;

  let dateWhere = '';
  const params = [];
  if (date_from) { dateWhere += ' AND date(created_at) >= ?'; params.push(date_from); }
  if (date_to) { dateWhere += ' AND date(created_at) <= ?'; params.push(date_to); }

  const stages = ['new', 'contacted', 'interested', 'follow_up', 'negotiation', 'converted', 'lost', 'junk'];
  const data = stages.map(status => {
    const row = db.prepare(`SELECT COUNT(*) as count FROM leads WHERE status = ? ${dateWhere}`).get(status, ...params);
    return { status, count: row.count };
  });

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const result = data.map(d => ({ ...d, percentage: total ? Math.round((d.count / total) * 100) : 0 }));

  res.json({ data: result, total });
});

module.exports = router;
