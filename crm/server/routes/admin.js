/**
 * Admin-only routes
 * POST /api/admin/backup       — trigger a manual backup immediately
 * GET  /api/admin/backups      — list all backup files
 */

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { runBackup, cleanOldBackups, listBackups, BACKUP_DIR } = require('../backup');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('admin'));

// POST /api/admin/backup
// Triggers an on-demand backup + cleanup. Admin only.
router.post('/backup', (req, res) => {
  const filePath = runBackup();
  if (!filePath) {
    return res.status(500).json({ error: 'Backup failed — check server logs.' });
  }

  cleanOldBackups();                 // prune while we're at it
  const backups = listBackups();     // return fresh list to the UI

  res.json({
    message     : 'Backup created successfully.',
    backupFile  : filePath.replace(BACKUP_DIR + '/', ''), // just the filename
    totalBackups: backups.length,
    backups,
  });
});

// GET /api/admin/backups
// Returns a list of all backup files with size + date.
router.get('/backups', (req, res) => {
  const backups = listBackups();
  res.json({ backups, backupDir: BACKUP_DIR });
});

module.exports = router;
