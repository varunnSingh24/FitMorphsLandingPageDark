/**
 * CSV export endpoints (admin/manager only).
 * Used to copy CRM data into external analytics tools or other CRMs.
 *
 * All endpoints return text/csv with a Content-Disposition header so the
 * browser triggers a download. UTF-8 BOM is prepended so Excel opens
 * non-ASCII characters (Hindi names, ₹, etc.) correctly.
 */
const express = require('express');
const { getDb } = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin', 'manager'));

// ── CSV helpers ──────────────────────────────────────────────────────────
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // RFC 4180: wrap in quotes if it contains comma, quote, or newline
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCSV(rows, columns) {
  const header = columns.join(',');
  if (!rows.length) return '﻿' + header + '\n';
  const body = rows.map(r => columns.map(c => csvCell(r[c])).join(',')).join('\n');
  return '﻿' + header + '\n' + body + '\n';
}

function sendCSV(res, filename, csv) {
  const today = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}-${today}.csv"`);
  res.send(csv);
}

// ── GET /api/export/leads.csv ────────────────────────────────────────────
router.get('/leads.csv', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      l.id, l.full_name, l.email, l.phone, l.secondary_phone,
      l.gender, l.age, l.city, l.locality,
      l.source, l.source_detail, l.interested_in,
      l.priority, l.status, l.notes,
      u.name AS assigned_to_name, u.email AS assigned_to_email,
      l.created_at, l.updated_at,
      (SELECT COUNT(*) FROM call_logs cl WHERE cl.lead_id = l.id) AS call_count,
      (SELECT MAX(cl.created_at) FROM call_logs cl WHERE cl.lead_id = l.id) AS last_call_at,
      (SELECT cl.call_outcome FROM call_logs cl WHERE cl.lead_id = l.id ORDER BY cl.created_at DESC LIMIT 1) AS last_call_outcome,
      (SELECT COUNT(*) FROM follow_ups fu WHERE fu.lead_id = l.id) AS follow_up_count,
      (SELECT COUNT(*) FROM follow_ups fu WHERE fu.lead_id = l.id AND fu.is_completed = 0) AS open_follow_ups,
      (SELECT MAX(a.created_at) FROM activities a WHERE a.lead_id = l.id) AS last_activity_at
    FROM leads l
    LEFT JOIN users u ON l.assigned_to = u.id
    ORDER BY l.id ASC
  `).all();

  const columns = [
    'id','full_name','email','phone','secondary_phone',
    'gender','age','city','locality',
    'source','source_detail','interested_in',
    'priority','status','notes',
    'assigned_to_name','assigned_to_email',
    'created_at','updated_at',
    'call_count','last_call_at','last_call_outcome',
    'follow_up_count','open_follow_ups','last_activity_at',
  ];
  sendCSV(res, 'leads', toCSV(rows, columns));
});

// ── GET /api/export/clients.csv ──────────────────────────────────────────
router.get('/clients.csv', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      c.id, c.lead_id,
      l.full_name, l.email, l.phone, l.city, l.gender, l.age,
      c.program_type, c.start_date, c.end_date, c.status,
      c.current_weight_kg, c.target_weight_kg, c.notes,
      u.name AS dietitian_name, u.email AS dietitian_email,
      c.created_at, c.updated_at,
      (SELECT COUNT(*) FROM checkins ch WHERE ch.client_id = c.id) AS checkin_count,
      (SELECT MAX(ch.created_at) FROM checkins ch WHERE ch.client_id = c.id) AS last_checkin_at,
      (SELECT ch.weight_kg FROM checkins ch WHERE ch.client_id = c.id AND ch.weight_kg IS NOT NULL ORDER BY ch.created_at DESC LIMIT 1) AS latest_weight_kg,
      (SELECT COUNT(*) FROM bsl_readings b WHERE b.client_id = c.id) AS bsl_reading_count,
      (SELECT COUNT(*) FROM hba1c_records h WHERE h.client_id = c.id) AS hba1c_count
    FROM clients c
    JOIN leads l ON c.lead_id = l.id
    LEFT JOIN users u ON c.dietitian_id = u.id
    ORDER BY c.id ASC
  `).all();

  const columns = [
    'id','lead_id','full_name','email','phone','city','gender','age',
    'program_type','start_date','end_date','status',
    'current_weight_kg','target_weight_kg','notes',
    'dietitian_name','dietitian_email',
    'created_at','updated_at',
    'checkin_count','last_checkin_at','latest_weight_kg',
    'bsl_reading_count','hba1c_count',
  ];
  sendCSV(res, 'clients', toCSV(rows, columns));
});

// ── GET /api/export/call-logs.csv ────────────────────────────────────────
router.get('/call-logs.csv', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      cl.id, cl.lead_id, l.full_name AS lead_name, l.phone AS lead_phone,
      u.name AS called_by_name,
      cl.call_type, cl.call_duration_seconds, cl.call_outcome,
      cl.call_number, cl.is_follow_up, cl.follow_up_id,
      cl.summary, cl.follow_up_date, cl.created_at
    FROM call_logs cl
    JOIN leads l ON cl.lead_id = l.id
    JOIN users u ON cl.called_by = u.id
    ORDER BY cl.id ASC
  `).all();

  const columns = [
    'id','lead_id','lead_name','lead_phone','called_by_name',
    'call_type','call_duration_seconds','call_outcome',
    'call_number','is_follow_up','follow_up_id',
    'summary','follow_up_date','created_at',
  ];
  sendCSV(res, 'call-logs', toCSV(rows, columns));
});

// ── GET /api/export/follow-ups.csv ───────────────────────────────────────
router.get('/follow-ups.csv', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      f.id, f.lead_id, l.full_name AS lead_name, l.phone AS lead_phone, l.status AS lead_status,
      u.name AS assigned_to_name,
      f.follow_up_date, f.follow_up_time, f.note,
      f.is_completed, f.completed_at, f.created_at
    FROM follow_ups f
    JOIN leads l ON f.lead_id = l.id
    JOIN users u ON f.assigned_to = u.id
    ORDER BY f.id ASC
  `).all();

  const columns = [
    'id','lead_id','lead_name','lead_phone','lead_status','assigned_to_name',
    'follow_up_date','follow_up_time','note',
    'is_completed','completed_at','created_at',
  ];
  sendCSV(res, 'follow-ups', toCSV(rows, columns));
});

// ── GET /api/export/activities.csv ───────────────────────────────────────
router.get('/activities.csv', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      a.id, a.lead_id, l.full_name AS lead_name,
      u.name AS user_name, u.role AS user_role,
      a.activity_type, a.description, a.created_at
    FROM activities a
    JOIN leads l ON a.lead_id = l.id
    JOIN users u ON a.user_id = u.id
    ORDER BY a.id ASC
  `).all();

  const columns = ['id','lead_id','lead_name','user_name','user_role','activity_type','description','created_at'];
  sendCSV(res, 'activities', toCSV(rows, columns));
});

// ── GET /api/export/medical-histories.csv ────────────────────────────────
router.get('/medical-histories.csv', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      mh.id, mh.lead_id, l.full_name AS lead_name, l.phone AS lead_phone,
      mh.height_cm, mh.weight_kg, mh.blood_group, mh.health_conditions,
      mh.past_surgeries, mh.current_medications, mh.allergies,
      mh.fitness_level, mh.dietary_preference, mh.smoking, mh.alcohol,
      mh.doctor_name, mh.doctor_clearance,
      mh.emergency_contact_name, mh.emergency_contact_phone, mh.emergency_contact_relation,
      mh.additional_notes, mh.created_at, mh.updated_at
    FROM medical_histories mh
    JOIN leads l ON mh.lead_id = l.id
    ORDER BY mh.id ASC
  `).all();

  const columns = [
    'id','lead_id','lead_name','lead_phone',
    'height_cm','weight_kg','blood_group','health_conditions',
    'past_surgeries','current_medications','allergies',
    'fitness_level','dietary_preference','smoking','alcohol',
    'doctor_name','doctor_clearance',
    'emergency_contact_name','emergency_contact_phone','emergency_contact_relation',
    'additional_notes','created_at','updated_at',
  ];
  sendCSV(res, 'medical-histories', toCSV(rows, columns));
});

// ── GET /api/export/checkins.csv ─────────────────────────────────────────
router.get('/checkins.csv', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      ch.id, ch.client_id, l.full_name AS client_name,
      u.name AS dietitian_name,
      ch.checkin_type, ch.weight_kg, ch.compliance, ch.energy_level,
      ch.notes, ch.next_checkin_date, ch.created_at
    FROM checkins ch
    JOIN clients c ON ch.client_id = c.id
    JOIN leads l ON c.lead_id = l.id
    JOIN users u ON ch.dietitian_id = u.id
    ORDER BY ch.id ASC
  `).all();

  const columns = [
    'id','client_id','client_name','dietitian_name',
    'checkin_type','weight_kg','compliance','energy_level',
    'notes','next_checkin_date','created_at',
  ];
  sendCSV(res, 'checkins', toCSV(rows, columns));
});

// ── GET /api/export/bsl.csv ──────────────────────────────────────────────
router.get('/bsl.csv', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      b.id, b.client_id, l.full_name AS client_name,
      u.name AS logged_by_name,
      b.reading_date, b.fasting_bsl, b.pp_bsl, b.random_bsl,
      b.comment, b.created_at
    FROM bsl_readings b
    JOIN clients c ON b.client_id = c.id
    JOIN leads l ON c.lead_id = l.id
    JOIN users u ON b.logged_by = u.id
    ORDER BY b.id ASC
  `).all();

  const columns = ['id','client_id','client_name','logged_by_name','reading_date','fasting_bsl','pp_bsl','random_bsl','comment','created_at'];
  sendCSV(res, 'bsl-readings', toCSV(rows, columns));
});

// ── GET /api/export/hba1c.csv ────────────────────────────────────────────
router.get('/hba1c.csv', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      h.id, h.client_id, l.full_name AS client_name,
      u.name AS logged_by_name,
      h.test_date, h.hba1c_value, h.lab_name, h.notes, h.created_at
    FROM hba1c_records h
    JOIN clients c ON h.client_id = c.id
    JOIN leads l ON c.lead_id = l.id
    JOIN users u ON h.logged_by = u.id
    ORDER BY h.id ASC
  `).all();

  const columns = ['id','client_id','client_name','logged_by_name','test_date','hba1c_value','lab_name','notes','created_at'];
  sendCSV(res, 'hba1c', toCSV(rows, columns));
});

// ── GET /api/export/measurements.csv ─────────────────────────────────────
router.get('/measurements.csv', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      m.id, m.client_id, l.full_name AS client_name,
      u.name AS logged_by_name,
      m.measurement_date, m.waist_cm, m.hip_cm, m.chest_cm, m.arms_cm, m.thighs_cm,
      m.notes, m.created_at
    FROM measurements m
    JOIN clients c ON m.client_id = c.id
    JOIN leads l ON c.lead_id = l.id
    JOIN users u ON m.logged_by = u.id
    ORDER BY m.id ASC
  `).all();

  const columns = ['id','client_id','client_name','logged_by_name','measurement_date','waist_cm','hip_cm','chest_cm','arms_cm','thighs_cm','notes','created_at'];
  sendCSV(res, 'measurements', toCSV(rows, columns));
});

module.exports = router;
