// Phone normalization for Indian numbers.
// Strips all non-digit characters and trims a leading "0" or country code "91"
// so that "+91 98765 43210", "0 98765 43210", "9876543210" all collapse to
// "9876543210". Returns the cleaned 10-digit form when possible, otherwise the
// best-effort digits-only string.
function normalizePhone(raw) {
  if (raw === null || raw === undefined) return raw;
  let s = String(raw).replace(/\D/g, '');
  if (!s) return '';
  // Strip leading country code 91 if present and length implies it
  if (s.length === 12 && s.startsWith('91')) s = s.slice(2);
  // Strip leading "0" trunk prefix
  if (s.length === 11 && s.startsWith('0')) s = s.slice(1);
  return s;
}

module.exports = { normalizePhone };
