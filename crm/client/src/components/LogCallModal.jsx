import React, { useState } from 'react';
import api from '../utils/api';

const OUTCOMES = [
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'callback_requested', label: 'Callback Requested' },
  { value: 'converted', label: 'Converted' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'wrong_number', label: 'Wrong Number' },
];

export default function LogCallModal({ lead, onClose, onSuccess }) {
  const [form, setForm] = useState({
    call_type: 'outbound',
    duration_min: '',
    duration_sec: '',
    call_outcome: '',
    summary: '',
    follow_up_date: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.call_outcome) { setError('Please select a call outcome'); return; }

    const seconds = (parseInt(form.duration_min || 0) * 60) + parseInt(form.duration_sec || 0);
    setLoading(true);
    setError('');
    try {
      await api.post('/call-logs', {
        lead_id: lead.id,
        call_type: form.call_type,
        call_duration_seconds: seconds,
        call_outcome: form.call_outcome,
        summary: form.summary,
        follow_up_date: form.follow_up_date || null,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log call');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={`Log Call — ${lead.full_name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Call Type</label>
            <select className="select" value={form.call_type} onChange={e => set('call_type', e.target.value)}>
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </div>
          <div>
            <label className="label">Duration</label>
            <div className="flex gap-2">
              <input className="input" type="number" min="0" max="120" placeholder="mm" value={form.duration_min} onChange={e => set('duration_min', e.target.value)} />
              <input className="input" type="number" min="0" max="59" placeholder="ss" value={form.duration_sec} onChange={e => set('duration_sec', e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <label className="label">Outcome *</label>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => set('call_outcome', o.value)}
                className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                  form.call_outcome === o.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Notes / Summary</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="What did you discuss? Key points from the call..."
            value={form.summary}
            onChange={e => set('summary', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Schedule Follow-Up (optional)</label>
          <input className="input" type="date" value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Log Call'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

export function ModalWrapper({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
