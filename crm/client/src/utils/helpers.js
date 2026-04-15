// Parse a DB timestamp as UTC (DB stores UTC via datetime('now'))
function parseUTC(dateStr) {
  if (!dateStr) return null;
  // If it already has timezone info (T, Z, +), parse as-is
  if (dateStr.includes('Z') || dateStr.includes('+')) return new Date(dateStr);
  // Date-only strings like "2026-04-12" — treat as IST midnight (no UTC shift)
  if (dateStr.length === 10) return new Date(dateStr + 'T00:00:00+05:30');
  // Full datetime without timezone like "2026-04-12 10:30:00" — it's UTC from the DB
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

// Format datetime to IST
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = parseUTC(dateStr);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = parseUTC(dateStr);
  if (!d || isNaN(d)) return '—';
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const past = parseUTC(dateStr);
  if (!past || isNaN(past)) return '';
  const diff = Math.floor((now - past) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

export const STATUS_COLORS = {
  new: 'bg-gray-100 text-gray-700',
  contacted: 'bg-sky-100 text-sky-700',
  interested: 'bg-purple-100 text-purple-700',
  follow_up: 'bg-yellow-100 text-yellow-700',
  negotiation: 'bg-orange-100 text-orange-700',
  converted: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
  junk: 'bg-gray-100 text-gray-500',
};

export const PRIORITY_COLORS = {
  hot: 'bg-red-100 text-red-700',
  warm: 'bg-orange-100 text-orange-700',
  cold: 'bg-sky-100 text-sky-600',
};

export const OUTCOME_COLORS = {
  interested: 'bg-purple-100 text-purple-700',
  converted: 'bg-green-100 text-green-700',
  not_interested: 'bg-red-100 text-red-700',
  no_answer: 'bg-gray-100 text-gray-600',
  busy: 'bg-yellow-100 text-yellow-700',
  callback_requested: 'bg-sky-100 text-sky-700',
  wrong_number: 'bg-red-100 text-red-600',
  voicemail: 'bg-gray-100 text-gray-600',
};

export const SOURCE_LABELS = {
  walk_in: 'Walk-in', instagram: 'Instagram', facebook: 'Facebook',
  google_ads: 'Google Ads', referral: 'Referral', website: 'Website',
  phone_inquiry: 'Phone Inquiry', other: 'Other',
};

export const STATUS_LABELS = {
  new: 'New', contacted: 'Contacted', interested: 'Interested',
  follow_up: 'Follow-up', negotiation: 'Negotiation',
  converted: 'Converted', lost: 'Lost', junk: 'Junk',
};

export const INTEREST_LABELS = {
  weight_loss: 'Weight Loss', muscle_gain: 'Muscle Gain', yoga: 'Yoga',
  crossfit: 'CrossFit', personal_training: 'Personal Training',
  group_classes: 'Group Classes', diet_plan: 'Diet Plan', other: 'Other',
};
