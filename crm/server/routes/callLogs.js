const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { istNow } = require('../utils/time');

const router = express.Router();
router.use(authenticate);

// POST /api/call-logs
router.post('/', (req, res) => {
  const db = getDb();
  const { lead_id, call_type = 'outbound', call_duration_seconds = 0,
    call_outcome, summary, follow_up_date,
    is_follow_up = 0, follow_up_id = null } = req.body;

  if (!lead_id || !call_outcome) {
    return res.status(400).json({ error: 'lead_id and call_outcome required' });
  }

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const now = istNow();

  // Auto-compute call_number for this lead
  const maxRow = db.prepare('SELECT COALESCE(MAX(call_number), 0) as max_num FROM call_logs WHERE lead_id = ?').get(lead_id);
  const call_number = maxRow.max_num + 1;

  // Create call log
  const result = db.prepare(`
    INSERT INTO call_logs (lead_id, called_by, call_type, call_duration_seconds,
      call_outcome, summary, follow_up_date, call_number, is_follow_up, follow_up_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(lead_id, req.user.id, call_type, call_duration_seconds, call_outcome,
    summary || null, follow_up_date || null, call_number, is_follow_up ? 1 : 0,
    follow_up_id || null, now);

  // Create activity
  const durationStr = formatDuration(call_duration_seconds);
  const callLabel = is_follow_up ? 'Follow-up call' : 'Call';
  db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'call', ?, ?)`)
    .run(lead_id, req.user.id, `${callLabel} #${call_number} — ${call_type === 'inbound' ? 'Inbound' : 'Outbound'} (${durationStr}) — ${call_outcome}. ${summary || ''}`, now);

  // Auto-complete linked follow-up
  if (follow_up_id) {
    db.prepare('UPDATE follow_ups SET is_completed = 1, completed_at = ? WHERE id = ?').run(now, follow_up_id);
  }

  // Auto-update lead status
  let newStatus = lead.status;
  if (call_outcome === 'converted') newStatus = 'converted';
  else if (call_outcome === 'not_interested') newStatus = 'lost';
  else if (call_outcome === 'wrong_number') newStatus = 'junk';
  else if (call_outcome === 'interested') newStatus = 'interested';
  else if (['no_answer', 'busy', 'voicemail'].includes(call_outcome) && lead.status === 'new') newStatus = 'contacted';
  else if (call_outcome === 'callback_requested') newStatus = 'follow_up';

  if (newStatus !== lead.status) {
    db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, lead_id);
    db.prepare(`INSERT INTO activities (lead_id, user_id, activity_type, description, created_at) VALUES (?, ?, 'status_change', ?, ?)`)
      .run(lead_id, req.user.id, `Status auto-updated: ${lead.status} → ${newStatus}`, now);
  } else {
    db.prepare('UPDATE leads SET updated_at = ? WHERE id = ?').run(now, lead_id);
  }

  // Create follow-up if follow_up_date provided
  if (follow_up_date) {
    db.prepare(`
      INSERT INTO follow_ups (lead_id, assigned_to, follow_up_date, note, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(lead_id, req.user.id, follow_up_date, `Follow-up from call #${call_number}: ${summary || call_outcome}`, now);
  }

  res.status(201).json({ id: result.lastInsertRowid, call_number, success: true });
});

// GET /api/call-logs/lead/:leadId
router.get('/lead/:leadId', (req, res) => {
  const db = getDb();
  const callLogs = db.prepare(`
    SELECT cl.*, u.name as caller_name,
           fu.follow_up_date as linked_follow_up_date,
           fu.note as linked_follow_up_note,
           fu.is_completed as linked_follow_up_completed
    FROM call_logs cl
    JOIN users u ON cl.called_by = u.id
    LEFT JOIN follow_ups fu ON cl.follow_up_id = fu.id
    WHERE cl.lead_id = ?
    ORDER BY cl.call_number DESC, cl.created_at DESC
  `).all(req.params.leadId);

  res.json({ callLogs });
});

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

module.exports = router;
