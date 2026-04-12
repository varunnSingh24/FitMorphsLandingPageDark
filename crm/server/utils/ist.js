// IST timezone helpers — all DB timestamps are UTC, but comparisons need IST dates
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +5:30 in milliseconds

// Get current date in IST as "YYYY-MM-DD"
function istToday() {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  return now.toISOString().split('T')[0];
}

// Get current datetime in IST as "YYYY-MM-DD HH:MM:SS"
function istNow() {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  return now.toISOString().replace('T', ' ').split('.')[0];
}

// Get IST date string for a date N days ago
function istDaysAgo(n) {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// Get IST date for first day of current month
function istMonthStart() {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

// Get IST date for 7 days ago
function istWeekStart() {
  return istDaysAgo(7);
}

// Convert a UTC datetime string to IST date "YYYY-MM-DD"
// Used in SQL: compare date(column, '+5 hours', '+30 minutes') for IST conversion in SQLite
const IST_SQL_SHIFT = "'+5 hours', '+30 minutes'";

module.exports = { istToday, istNow, istDaysAgo, istMonthStart, istWeekStart, IST_SQL_SHIFT };
