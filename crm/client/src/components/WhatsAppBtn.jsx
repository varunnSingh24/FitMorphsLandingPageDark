import React from 'react';
import api from '../utils/api';

/**
 * Formats a phone number to E.164 for India (+91).
 * Accepts 10-digit (9876543210) or already-prefixed (919876543210).
 */
function toE164(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return `91${digits}`;
}

/**
 * Builds a wa.me click-to-chat URL with an optional pre-filled greeting.
 */
export function waLink(phone, leadName = '', agentName = '') {
  const e164 = toE164(phone);
  if (!e164) return null;
  const greeting = leadName
    ? `Hi ${leadName}! This is ${agentName || 'us'} from FitMorphs. 😊`
    : '';
  const qs = greeting ? `?text=${encodeURIComponent(greeting)}` : '';
  return `https://wa.me/${e164}${qs}`;
}

/**
 * WhatsApp click-to-chat button.
 *
 * Props:
 *   phone      — lead/client phone number (required)
 *   leadName   — used in the pre-filled message
 *   agentName  — agent's name shown in message
 *   leadId     — if provided, logs a 'whatsapp' activity to the CRM
 *   size       — 'sm' (default) | 'xs'
 *   label      — button label (default: 'WhatsApp')
 *   showLabel  — show text label (default true)
 */
export default function WhatsAppBtn({
  phone,
  leadName = '',
  agentName = '',
  leadId = null,
  size = 'sm',
  label = 'WhatsApp',
  showLabel = true,
}) {
  const url = waLink(phone, leadName, agentName);
  if (!url) return null;

  const handleClick = (e) => {
    // Log activity fire-and-forget (don't block the link open)
    if (leadId) {
      api.post('/activities', {
        lead_id: leadId,
        activity_type: 'whatsapp',
        description: `WhatsApp opened for ${leadName || phone}`,
      }).catch(() => {});
    }
    // Let the <a> tag open the link naturally
  };

  const sizeClass = size === 'xs'
    ? 'px-2 py-1 text-[11px] gap-1'
    : 'px-3 py-1.5 text-sm gap-1.5';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      title={`Open WhatsApp chat with ${leadName || phone}`}
      className={`inline-flex items-center ${sizeClass} rounded-lg font-medium
        bg-green-500 hover:bg-green-600 text-white transition-colors shadow-sm`}
    >
      {/* WhatsApp logo SVG */}
      <svg viewBox="0 0 24 24" fill="currentColor"
        className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
      {showLabel && <span>{label}</span>}
    </a>
  );
}
