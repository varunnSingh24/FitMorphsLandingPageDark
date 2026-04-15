// All timestamps stored in DB are IST (UTC+5:30)
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

// Current IST datetime as 'YYYY-MM-DD HH:MM:SS'
function istNow() {
  return new Date(Date.now() + IST_OFFSET)
    .toISOString().replace('T', ' ').split('.')[0];
}

// Current IST date as 'YYYY-MM-DD'
function istToday() {
  return new Date(Date.now() + IST_OFFSET)
    .toISOString().split('T')[0];
}

// IST datetime N milliseconds in the future as 'YYYY-MM-DD HH:MM:SS'
function istFuture(addMs) {
  return new Date(Date.now() + IST_OFFSET + addMs)
    .toISOString().replace('T', ' ').split('.')[0];
}

// Tomorrow's IST date + a fixed time string, e.g. istTomorrow('09:00:00')
function istTomorrow(timeStr) {
  const date = new Date(Date.now() + IST_OFFSET + 86400000)
    .toISOString().split('T')[0];
  return `${date} ${timeStr}`;
}

module.exports = { istNow, istToday, istFuture, istTomorrow };
