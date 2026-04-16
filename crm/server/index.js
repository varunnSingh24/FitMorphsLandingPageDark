require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeDatabase } = require('./database');
const { runBackup, initBackupScheduler } = require('./backup');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : ['http://localhost:3000'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Initialize DB on startup
initializeDatabase();

// Backup on startup (safety snapshot before any migrations), then start scheduler
runBackup();
initBackupScheduler();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/call-logs', require('./routes/callLogs'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/follow-ups', require('./routes/followUps'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/bsl', require('./routes/bsl'));
app.use('/api/reminders', require('./routes/reminders'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`FitMorphs CRM Server running on port ${PORT}`);
});
