/**
 * FitMorphs CRM — Database Backup Utility
 *
 * Backup location: crm/server/backups/
 * Naming format:   fitmorphs-YYYY-MM-DD_HH-MM-SS.db
 * Retention:       Last 30 days (older files are auto-deleted)
 * Schedule:        Daily at midnight IST (18:30 UTC) via node-cron
 */

const fs   = require('fs');
const path = require('path');
const cron = require('node-cron');

const DB_PATH      = path.join(__dirname, 'fitmorphs.db');
const BACKUP_DIR   = path.join(__dirname, 'backups');
const MAX_DAYS     = 30;   // keep backups for 30 days
const MAX_BACKUPS  = 100;  // hard cap — safety net

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Zero-pad a number to 2 digits */
const pad = (n) => String(n).padStart(2, '0');

/** IST timestamp string: YYYY-MM-DD_HH-MM-SS */
function istTimestamp() {
  const now = new Date();
  // IST = UTC + 5:30
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const Y  = ist.getUTCFullYear();
  const M  = pad(ist.getUTCMonth() + 1);
  const D  = pad(ist.getUTCDate());
  const h  = pad(ist.getUTCHours());
  const m  = pad(ist.getUTCMinutes());
  const s  = pad(ist.getUTCSeconds());
  return `${Y}-${M}-${D}_${h}-${m}-${s}`;
}

/** Ensure the backups directory exists */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`[Backup] Created backup directory: ${BACKUP_DIR}`);
  }
}

// ─── core operations ──────────────────────────────────────────────────────────

/**
 * Run a single backup.
 * Copies fitmorphs.db → backups/fitmorphs-<timestamp>.db
 * Returns the path of the created backup file, or null on failure.
 */
function runBackup() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.warn('[Backup] Database file not found — skipping backup.');
      return null;
    }

    ensureBackupDir();

    const filename   = `fitmorphs-${istTimestamp()}.db`;
    const destPath   = path.join(BACKUP_DIR, filename);

    fs.copyFileSync(DB_PATH, destPath);

    const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(1);
    console.log(`[Backup] ✅ Saved: ${filename} (${sizeKB} KB)`);

    return destPath;
  } catch (err) {
    console.error('[Backup] ❌ Backup failed:', err.message);
    return null;
  }
}

/**
 * Delete backup files older than MAX_DAYS days.
 * Also enforces the MAX_BACKUPS hard cap (deletes oldest first).
 */
function cleanOldBackups() {
  try {
    ensureBackupDir();

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('fitmorphs-') && f.endsWith('.db'))
      .map((f) => ({
        name : f,
        path : path.join(BACKUP_DIR, f),
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => a.mtime - b.mtime); // oldest first

    const cutoff = Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000;
    let deleted  = 0;

    for (const file of files) {
      const overAge  = file.mtime < cutoff;
      const overCap  = files.length - deleted > MAX_BACKUPS;

      if (overAge || overCap) {
        fs.unlinkSync(file.path);
        deleted++;
        console.log(`[Backup] 🗑️  Deleted old backup: ${file.name}`);
      }
    }

    if (deleted === 0) {
      console.log(`[Backup] Cleanup: no old backups to remove (${files.length} files kept).`);
    }
  } catch (err) {
    console.error('[Backup] ❌ Cleanup failed:', err.message);
  }
}

/**
 * List all existing backup files with metadata.
 * Returns an array of { filename, sizeKB, createdAt }.
 */
function listBackups() {
  try {
    ensureBackupDir();

    return fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('fitmorphs-') && f.endsWith('.db'))
      .map((f) => {
        const filePath = path.join(BACKUP_DIR, f);
        const stat     = fs.statSync(filePath);
        return {
          filename : f,
          sizeKB   : (stat.size / 1024).toFixed(1),
          createdAt: new Date(stat.mtimeMs).toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first
  } catch (err) {
    console.error('[Backup] ❌ List failed:', err.message);
    return [];
  }
}

// ─── scheduler ────────────────────────────────────────────────────────────────

/**
 * Start the daily backup scheduler.
 *
 * Cron schedule: '30 18 * * *'  →  18:30 UTC = 00:00 IST (midnight)
 *
 * On each trigger:
 *   1. Run backup
 *   2. Clean old backups
 */
function initBackupScheduler() {
  // midnight IST = 18:30 UTC
  cron.schedule('30 18 * * *', () => {
    console.log('[Backup] ⏰ Scheduled daily backup starting...');
    runBackup();
    cleanOldBackups();
  });

  console.log('[Backup] Scheduler started — daily backup at midnight IST (18:30 UTC).');
}

module.exports = { runBackup, cleanOldBackups, listBackups, initBackupScheduler, BACKUP_DIR };
