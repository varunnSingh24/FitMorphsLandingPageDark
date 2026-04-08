const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'fitmorphs.db');
let db;

function getDb() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

function initializeDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','manager','sales_agent','dietician')),
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      secondary_phone TEXT,
      gender TEXT CHECK(gender IN ('male','female','other')),
      age INTEGER,
      source TEXT,
      source_detail TEXT,
      status TEXT DEFAULT 'new' CHECK(status IN ('new','contacted','interested','follow_up','negotiation','converted','lost','junk')),
      assigned_to INTEGER REFERENCES users(id),
      priority TEXT DEFAULT 'warm' CHECK(priority IN ('hot','warm','cold')),
      interested_in TEXT CHECK(interested_in IN ('weight_loss','muscle_gain','yoga','crossfit','personal_training','group_classes','diet_plan','other')),
      notes TEXT,
      city TEXT,
      locality TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      called_by INTEGER NOT NULL REFERENCES users(id),
      call_type TEXT DEFAULT 'outbound' CHECK(call_type IN ('outbound','inbound')),
      call_duration_seconds INTEGER DEFAULT 0,
      call_outcome TEXT CHECK(call_outcome IN ('no_answer','busy','callback_requested','interested','not_interested','converted','wrong_number','voicemail')),
      summary TEXT,
      follow_up_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      activity_type TEXT CHECK(activity_type IN ('call','email','whatsapp','meeting','note','status_change','assignment_change')),
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS follow_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      assigned_to INTEGER NOT NULL REFERENCES users(id),
      follow_up_date TEXT NOT NULL,
      follow_up_time TEXT,
      note TEXT,
      is_completed INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS medical_histories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL UNIQUE REFERENCES leads(id),
      height_cm REAL,
      weight_kg REAL,
      blood_group TEXT,
      health_conditions TEXT,
      past_surgeries TEXT,
      current_medications TEXT,
      allergies TEXT,
      fitness_level TEXT CHECK(fitness_level IN ('beginner','intermediate','advanced')),
      dietary_preference TEXT CHECK(dietary_preference IN ('vegetarian','vegan','non_vegetarian','eggetarian','jain','other')),
      smoking TEXT CHECK(smoking IN ('yes','no','occasionally')),
      alcohol TEXT CHECK(alcohol IN ('yes','no','occasionally')),
      doctor_name TEXT,
      doctor_clearance TEXT CHECK(doctor_clearance IN ('yes','no','not_required')),
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      emergency_contact_relation TEXT,
      additional_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      dietitian_id INTEGER REFERENCES users(id),
      program_type TEXT DEFAULT 'custom',
      start_date TEXT NOT NULL,
      end_date TEXT,
      current_weight_kg REAL,
      target_weight_kg REAL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','completed','dropped')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      dietitian_id INTEGER NOT NULL REFERENCES users(id),
      checkin_type TEXT NOT NULL CHECK(checkin_type IN ('food_review','weekly_call','monthly_assessment','adhoc_call')),
      weight_kg REAL,
      compliance TEXT CHECK(compliance IN ('excellent','good','average','poor')),
      energy_level TEXT CHECK(energy_level IN ('high','moderate','low','very_low')),
      notes TEXT,
      next_checkin_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      reminder_type TEXT NOT NULL CHECK(reminder_type IN ('lead_followup','checkin','custom')),
      ref_type TEXT,
      ref_id INTEGER,
      title TEXT NOT NULL,
      message TEXT,
      due_at TEXT NOT NULL,
      snoozed_until TEXT,
      is_done INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed default settings
  const settingsCount = db.prepare('SELECT COUNT(*) as c FROM settings').get().c;
  if (settingsCount === 0) {
    const defaultSources = JSON.stringify([
      { key: 'walk_in', label: 'Walk-in' },
      { key: 'instagram', label: 'Instagram' },
      { key: 'facebook', label: 'Facebook' },
      { key: 'google_ads', label: 'Google Ads' },
      { key: 'referral', label: 'Referral' },
      { key: 'website', label: 'Website' },
      { key: 'phone_inquiry', label: 'Phone Inquiry' },
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'other', label: 'Other' },
    ]);
    const defaultPrograms = JSON.stringify([
      { key: '3_month', label: '3 Month Program' },
      { key: '6_month', label: '6 Month Program' },
      { key: '12_month', label: '12 Month Program' },
      { key: 'custom', label: 'Custom' },
    ]);
    db.prepare("INSERT INTO settings (key, value) VALUES ('lead_sources', ?)").run(defaultSources);
    db.prepare("INSERT INTO settings (key, value) VALUES ('program_types', ?)").run(defaultPrograms);
  }

  // Migration: remove hardcoded source CHECK from leads table (sources are now configurable)
  const leadsSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='leads'").get();
  if (leadsSchema && leadsSchema.sql.includes("source TEXT CHECK")) {
    db.exec(`
      CREATE TABLE leads_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT NOT NULL,
        secondary_phone TEXT,
        gender TEXT CHECK(gender IN ('male','female','other')),
        age INTEGER,
        source TEXT,
        source_detail TEXT,
        status TEXT DEFAULT 'new' CHECK(status IN ('new','contacted','interested','follow_up','negotiation','converted','lost','junk')),
        assigned_to INTEGER REFERENCES users(id),
        priority TEXT DEFAULT 'warm' CHECK(priority IN ('hot','warm','cold')),
        interested_in TEXT CHECK(interested_in IN ('weight_loss','muscle_gain','yoga','crossfit','personal_training','group_classes','diet_plan','other')),
        notes TEXT,
        city TEXT,
        locality TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO leads_new SELECT * FROM leads;
      DROP TABLE leads;
      ALTER TABLE leads_new RENAME TO leads;
    `);
    console.log('Migrated leads table: removed hardcoded source CHECK constraint');
  }

  // Migration: update CHECK constraint to include dietician role
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (schema && !schema.sql.includes('dietician')) {
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','manager','sales_agent','dietician')),
        phone TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO users_new SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
    console.log('Migrated users table: added dietician role');
  }

  // Migration: update clients table to use 'paused' instead of 'on_hold'
  const clientsSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='clients'").get();
  if (clientsSchema && clientsSchema.sql.includes('on_hold')) {
    db.exec(`
      UPDATE clients SET status = 'paused' WHERE status = 'on_hold';
      CREATE TABLE clients_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER NOT NULL REFERENCES leads(id),
        dietitian_id INTEGER REFERENCES users(id),
        program_type TEXT DEFAULT 'custom',
        start_date TEXT NOT NULL,
        end_date TEXT,
        current_weight_kg REAL,
        target_weight_kg REAL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','completed','dropped')),
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO clients_new SELECT * FROM clients;
      DROP TABLE clients;
      ALTER TABLE clients_new RENAME TO clients;
    `);
    console.log('Migrated clients table: on_hold → paused');
  }

  // Migration: update checkins table to add 'excellent' compliance and 'very_low' energy
  const checkinsSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='checkins'").get();
  if (checkinsSchema && !checkinsSchema.sql.includes('excellent')) {
    db.exec(`
      CREATE TABLE checkins_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        dietitian_id INTEGER NOT NULL REFERENCES users(id),
        checkin_type TEXT NOT NULL CHECK(checkin_type IN ('food_review','weekly_call','monthly_assessment','adhoc_call')),
        weight_kg REAL,
        compliance TEXT CHECK(compliance IN ('excellent','good','average','poor')),
        energy_level TEXT CHECK(energy_level IN ('high','moderate','low','very_low')),
        notes TEXT,
        next_checkin_date TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO checkins_new SELECT * FROM checkins;
      DROP TABLE checkins;
      ALTER TABLE checkins_new RENAME TO checkins;
    `);
    console.log('Migrated checkins table: added excellent/very_low options');
  }

  seedIfEmpty(db);
}

function seedIfEmpty(db) {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount > 0) return;

  console.log('Seeding database...');

  const adminHash = bcrypt.hashSync('admin123', 10);
  const agentHash = bcrypt.hashSync('agent123', 10);

  // Seed users
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)'
  );

  const users = [
    { name: 'Admin User', email: 'admin@fitmorphs.com', hash: adminHash, role: 'admin', phone: '9999900000' },
    { name: 'Rahul Sharma', email: 'rahul@fitmorphs.com', hash: agentHash, role: 'manager', phone: '9876543210' },
    { name: 'Priya Mehta', email: 'priya@fitmorphs.com', hash: agentHash, role: 'sales_agent', phone: '9876543211' },
    { name: 'Amit Kumar', email: 'amit@fitmorphs.com', hash: agentHash, role: 'sales_agent', phone: '9876543212' },
    { name: 'Sunita Rao', email: 'sunita@fitmorphs.com', hash: agentHash, role: 'sales_agent', phone: '9876543213' },
  ];

  const userIds = users.map(u => {
    const r = insertUser.run(u.name, u.email, u.hash, u.role, u.phone);
    return r.lastInsertRowid;
  });

  // Seed leads (20 realistic Indian leads)
  const insertLead = db.prepare(`
    INSERT INTO leads (full_name, email, phone, secondary_phone, gender, age, source, source_detail, status, assigned_to, priority, interested_in, notes, city, locality, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const daysAgo = (d) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - d);
    return dt.toISOString().replace('T', ' ').split('.')[0];
  };

  const leadsData = [
    ['Rajesh Kumar', 'rajesh.kumar@gmail.com', '9811234567', '9811234568', 'male', 34, 'instagram', 'Reel ad - Weight Loss', 'interested', userIds[2], 'hot', 'weight_loss', 'Wants to lose 15 kg before wedding in 3 months', 'Mumbai', 'Andheri West', daysAgo(1), daysAgo(0)],
    ['Priya Sharma', 'priya.sharma@yahoo.com', '9822345678', null, 'female', 28, 'facebook', 'Facebook Group Ad', 'follow_up', userIds[3], 'hot', 'yoga', 'Interested in morning yoga batch, asked for schedule', 'Delhi', 'Lajpat Nagar', daysAgo(3), daysAgo(1)],
    ['Amit Patel', 'amitpatel@gmail.com', '9833456789', '9833456780', 'male', 42, 'google_ads', 'Diabetes reversal search', 'negotiation', userIds[2], 'hot', 'diet_plan', 'Diabetic, doctor recommended exercise + diet', 'Ahmedabad', 'Satellite', daysAgo(5), daysAgo(1)],
    ['Sneha Reddy', 'sneha.reddy@hotmail.com', '9844567890', null, 'female', 25, 'referral', 'Referred by Kavya Iyer (member)', 'converted', userIds[4], 'hot', 'personal_training', 'Signed up for 3-month PT package', 'Hyderabad', 'Banjara Hills', daysAgo(10), daysAgo(2)],
    ['Vikram Singh', null, '9855678901', null, 'male', 31, 'walk_in', null, 'contacted', userIds[3], 'warm', 'muscle_gain', 'Walked in, asked about bodybuilding programs', 'Bangalore', 'Koramangala', daysAgo(2), daysAgo(1)],
    ['Pooja Mehta', 'pooja.mehta@gmail.com', '9866789012', null, 'female', 36, 'website', 'Contact form', 'new', userIds[2], 'warm', 'weight_loss', 'Post-pregnancy weight loss inquiry', 'Pune', 'Kothrud', daysAgo(0), daysAgo(0)],
    ['Arjun Gupta', 'arjun.gupta@gmail.com', '9877890123', '9877890124', 'male', 22, 'instagram', 'Story ad - Crossfit', 'interested', userIds[4], 'hot', 'crossfit', 'College student, very keen on crossfit', 'Mumbai', 'Bandra', daysAgo(4), daysAgo(1)],
    ['Divya Nair', 'divya.nair@gmail.com', '9888901234', null, 'female', 29, 'facebook', 'Weight loss success stories post', 'follow_up', userIds[3], 'warm', 'group_classes', 'Wants group Zumba class, budget conscious', 'Chennai', 'Anna Nagar', daysAgo(6), daysAgo(2)],
    ['Karan Shah', 'karan.shah@outlook.com', '9899012345', null, 'male', 38, 'referral', 'Referred by Amit Patel', 'new', userIds[2], 'warm', 'diet_plan', 'Pre-diabetic, wants nutrition counseling', 'Surat', 'Vesu', daysAgo(0), daysAgo(0)],
    ['Ananya Joshi', 'ananya.joshi@gmail.com', '9800123456', null, 'female', 26, 'google_ads', 'Personal trainer search', 'interested', userIds[4], 'hot', 'personal_training', 'Wants 1-on-1 training, flexible timings', 'Delhi', 'Dwarka', daysAgo(3), daysAgo(1)],
    ['Suresh Rao', null, '9811111111', null, 'male', 55, 'phone_inquiry', null, 'contacted', userIds[3], 'warm', 'yoga', 'Senior citizen, interested in gentle yoga', 'Bangalore', 'Indiranagar', daysAgo(7), daysAgo(3)],
    ['Lakshmi Pillai', 'lakshmi.pillai@gmail.com', '9822222222', null, 'female', 33, 'instagram', 'DM from fitness post', 'negotiation', userIds[2], 'hot', 'weight_loss', 'Wants to join next week, negotiating price', 'Kochi', 'Kakkanad', daysAgo(8), daysAgo(1)],
    ['Rohit Verma', 'rohit.verma@gmail.com', '9833333333', '9833333334', 'male', 27, 'facebook', 'Gym near me ad', 'converted', userIds[4], 'hot', 'muscle_gain', 'Enrolled in 6-month bodybuilding program', 'Jaipur', 'Malviya Nagar', daysAgo(14), daysAgo(3)],
    ['Nisha Agarwal', 'nisha.agarwal@gmail.com', '9844444444', null, 'female', 41, 'website', 'Blog - PCOS fitness', 'follow_up', userIds[3], 'warm', 'yoga', 'PCOS, doctor referred to yoga therapy', 'Lucknow', 'Gomti Nagar', daysAgo(9), daysAgo(2)],
    ['Manish Trivedi', null, '9855555555', null, 'male', 45, 'google_ads', 'Back pain yoga search', 'lost', userIds[2], 'cold', 'yoga', 'Found a cheaper studio nearby, dropped out', 'Bhopal', 'MP Nagar', daysAgo(12), daysAgo(5)],
    ['Deepa Krishnan', 'deepa.k@gmail.com', '9866666666', null, 'female', 30, 'instagram', 'Transformation reel', 'interested', userIds[4], 'hot', 'weight_loss', 'Wants to lose weight for sister\'s wedding', 'Coimbatore', 'RS Puram', daysAgo(2), daysAgo(1)],
    ['Sanjay Malhotra', 'sanjay.m@gmail.com', '9877777777', '9877777778', 'male', 39, 'referral', 'Referred by employee', 'new', userIds[3], 'warm', 'personal_training', 'Corporate client, wants post-work sessions', 'Gurgaon', 'DLF Phase 2', daysAgo(1), daysAgo(0)],
    ['Kavya Iyer', 'kavya.iyer@gmail.com', '9888888888', null, 'female', 24, 'instagram', 'Instagram bio link', 'junk', userIds[2], 'cold', 'group_classes', 'Wrong number, not interested at all', 'Chennai', 'T Nagar', daysAgo(15), daysAgo(10)],
    ['Akash Dubey', 'akash.dubey@gmail.com', '9899999999', null, 'male', 20, 'other', 'College fest stall', 'new', userIds[4], 'cold', 'crossfit', 'Student, very price sensitive', 'Varanasi', 'Lanka', daysAgo(0), daysAgo(0)],
    ['Meena Banerjee', 'meena.b@gmail.com', '9800000001', null, 'female', 47, 'phone_inquiry', null, 'contacted', userIds[3], 'warm', 'diet_plan', 'Hypothyroid, needs specialized diet + exercise', 'Kolkata', 'Salt Lake', daysAgo(4), daysAgo(2)],
  ];

  const leadIds = leadsData.map(l => {
    const r = insertLead.run(...l);
    return r.lastInsertRowid;
  });

  // Seed call logs
  const insertCall = db.prepare(`
    INSERT INTO call_logs (lead_id, called_by, call_type, call_duration_seconds, call_outcome, summary, follow_up_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const callsData = [
    [leadIds[0], userIds[2], 'outbound', 185, 'interested', 'Spoke to Rajesh. He is very keen on weight loss program. Wants to start next week. Will visit center on Saturday.', daysAgo(-2).split(' ')[0], daysAgo(1)],
    [leadIds[1], userIds[3], 'outbound', 95, 'callback_requested', 'Priya was in a meeting. She asked me to call back tomorrow at 10am. Seems interested in yoga.', daysAgo(-1).split(' ')[0], daysAgo(3)],
    [leadIds[1], userIds[3], 'outbound', 0, 'no_answer', 'No answer on callback attempt.', null, daysAgo(2)],
    [leadIds[2], userIds[2], 'outbound', 420, 'interested', 'Long call with Amit. He is diabetic and doctor has referred him for diet + exercise. Discussed our diabetes reversal package. Price negotiation pending.', null, daysAgo(4)],
    [leadIds[2], userIds[2], 'inbound', 300, 'interested', 'Amit called back with questions about diet plan. Sent him the brochure on WhatsApp.', daysAgo(-1).split(' ')[0], daysAgo(3)],
    [leadIds[3], userIds[4], 'outbound', 540, 'converted', 'Sneha confirmed enrollment. Collected advance of Rs 5000. PT sessions start Monday 6am.', null, daysAgo(2)],
    [leadIds[4], userIds[3], 'outbound', 120, 'interested', 'Vikram confirmed his walk-in interest. Sent him our muscle gain program details.', daysAgo(-1).split(' ')[0], daysAgo(2)],
    [leadIds[6], userIds[4], 'outbound', 210, 'interested', 'Arjun is very excited about crossfit. Wants to see the box first. Scheduled a visit for this weekend.', daysAgo(-3).split(' ')[0], daysAgo(4)],
    [leadIds[9], userIds[4], 'outbound', 180, 'interested', 'Ananya wants flexible timing PT. 7-8pm works for her. Sharing schedule.', null, daysAgo(3)],
    [leadIds[11], userIds[2], 'outbound', 240, 'callback_requested', 'Lakshmi is comparing prices with other gyms. She asked for our best offer. Following up tomorrow.', daysAgo(-1).split(' ')[0], daysAgo(8)],
    [leadIds[12], userIds[4], 'outbound', 360, 'converted', 'Rohit confirmed 6-month bodybuilding package. Payment done online. Starts next Monday.', null, daysAgo(3)],
    [leadIds[14], userIds[2], 'outbound', 60, 'not_interested', 'Manish says he found a studio closer to his house with lower price. Marked as lost.', null, daysAgo(5)],
    [leadIds[15], userIds[4], 'outbound', 150, 'interested', 'Deepa wants to lose weight fast. Showing strong interest in our transformation package.', daysAgo(-2).split(' ')[0], daysAgo(1)],
    [leadIds[17], userIds[2], 'outbound', 30, 'wrong_number', 'Called Kavya — she said wrong number. Number registered to someone else. Marking as junk.', null, daysAgo(10)],
    [leadIds[19], userIds[3], 'outbound', 120, 'callback_requested', 'Meena was busy. Will call tomorrow. She has hypothyroid and needs special program.', daysAgo(-1).split(' ')[0], daysAgo(4)],
  ];

  callsData.forEach(c => insertCall.run(...c));

  // Seed activities
  const insertActivity = db.prepare(`
    INSERT INTO activities (lead_id, user_id, activity_type, description, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const activitiesData = [
    [leadIds[0], userIds[2], 'call', 'Outbound call — Interested. Will visit on Saturday.', daysAgo(1)],
    [leadIds[0], userIds[0], 'assignment_change', 'Lead assigned to Priya Mehta', daysAgo(1)],
    [leadIds[0], userIds[0], 'status_change', 'Status changed: new → contacted', daysAgo(1)],
    [leadIds[1], userIds[3], 'call', 'Outbound call — Callback requested for 10am tomorrow.', daysAgo(3)],
    [leadIds[1], userIds[3], 'call', 'Outbound call — No answer on callback.', daysAgo(2)],
    [leadIds[2], userIds[2], 'call', 'Outbound call — Interested in diabetes reversal package.', daysAgo(4)],
    [leadIds[2], userIds[2], 'whatsapp', 'Sent diabetes reversal program brochure on WhatsApp', daysAgo(3)],
    [leadIds[2], userIds[2], 'call', 'Inbound call — Amit had questions about diet plan.', daysAgo(3)],
    [leadIds[3], userIds[4], 'call', 'Outbound call — Converted. Enrolled in 3-month PT package.', daysAgo(2)],
    [leadIds[3], userIds[4], 'status_change', 'Status changed: negotiation → converted', daysAgo(2)],
    [leadIds[4], userIds[3], 'call', 'Outbound call — Interested. Sent program details.', daysAgo(2)],
    [leadIds[6], userIds[4], 'call', 'Outbound call — Crossfit visit scheduled for weekend.', daysAgo(4)],
    [leadIds[9], userIds[4], 'call', 'Outbound call — Interested in PT. Sharing schedule.', daysAgo(3)],
    [leadIds[11], userIds[2], 'call', 'Outbound call — Comparing prices. Following up.', daysAgo(8)],
    [leadIds[12], userIds[4], 'call', 'Outbound call — Converted. 6-month bodybuilding package sold.', daysAgo(3)],
    [leadIds[12], userIds[4], 'status_change', 'Status changed: follow_up → converted', daysAgo(3)],
    [leadIds[14], userIds[2], 'call', 'Outbound call — Not interested. Found closer studio.', daysAgo(5)],
    [leadIds[14], userIds[2], 'status_change', 'Status changed: contacted → lost', daysAgo(5)],
    [leadIds[15], userIds[4], 'call', 'Outbound call — Interested in transformation package.', daysAgo(1)],
    [leadIds[17], userIds[2], 'call', 'Outbound call — Wrong number. Marking as junk.', daysAgo(10)],
    [leadIds[17], userIds[2], 'status_change', 'Status changed: new → junk', daysAgo(10)],
    [leadIds[19], userIds[3], 'call', 'Outbound call — Callback requested. Hypothyroid patient.', daysAgo(4)],
  ];

  activitiesData.forEach(a => insertActivity.run(...a));

  // Seed follow-ups
  const insertFollowUp = db.prepare(`
    INSERT INTO follow_ups (lead_id, assigned_to, follow_up_date, follow_up_time, note, is_completed, completed_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().split('T')[0];

  const followUpsData = [
    [leadIds[0], userIds[2], tomorrow, '10:00', 'Rajesh visiting center — show him the floor', 0, null, daysAgo(1)],
    [leadIds[1], userIds[3], today, '10:00', 'Call Priya back at 10am as requested', 0, null, daysAgo(3)],
    [leadIds[2], userIds[2], tomorrow, '14:00', 'Final price negotiation with Amit', 0, null, daysAgo(3)],
    [leadIds[4], userIds[3], today, '18:00', 'Follow up with Vikram about program choice', 0, null, daysAgo(2)],
    [leadIds[6], userIds[4], tomorrow, '11:00', 'Arjun visiting for crossfit trial session', 0, null, daysAgo(4)],
    [leadIds[9], userIds[4], today, '19:00', 'Confirm PT schedule with Ananya', 0, null, daysAgo(3)],
    [leadIds[11], userIds[2], today, '11:00', 'Lakshmi follow-up — give her best offer', 0, null, daysAgo(8)],
    [leadIds[15], userIds[4], tomorrow, '16:00', 'Deepa follow-up — she wants to think overnight', 0, null, daysAgo(1)],
    [leadIds[16], userIds[3], today, '09:00', 'Sanjay initial call — corporate client', 0, null, daysAgo(1)],
    [leadIds[19], userIds[3], today, '10:30', 'Meena callback — discuss hypothyroid program', 0, null, daysAgo(4)],
    [leadIds[3], userIds[4], yesterday, '09:00', 'Sneha onboarding check-in', 1, daysAgo(0), daysAgo(2)],
    [leadIds[1], userIds[3], twoDaysAgo, '10:00', 'Priya follow-up (overdue)', 0, null, daysAgo(5)],
    [leadIds[7], userIds[3], twoDaysAgo, '17:00', 'Divya group class inquiry follow-up (overdue)', 0, null, daysAgo(6)],
  ];

  followUpsData.forEach(f => insertFollowUp.run(...f));

  console.log('Database seeded successfully!');
}

module.exports = { getDb, initializeDatabase };
