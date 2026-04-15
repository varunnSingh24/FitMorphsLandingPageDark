// All timestamps from the server are stored as IST (UTC+5:30).
// Parse a stored IST datetime string into a JS Date (treats it as IST, not UTC).
function parseIST(dateStr) {
  if (!dateStr) return new Date(0);
  // Normalise space to T, then append +05:30 so JS treats it as IST
  const iso = dateStr.replace(' ', 'T');
  return new Date(iso.includes('+') ? iso : iso + '+05:30');
}

// Format datetime to IST display
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return parseIST(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  // Date-only strings (YYYY-MM-DD): treat as IST midnight
  const iso = dateStr.length === 10 ? dateStr + 'T00:00:00+05:30' : dateStr.replace(' ', 'T');
  const d = new Date(iso.includes('+') ? iso : iso + '+05:30');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const past = parseIST(dateStr).getTime();
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
