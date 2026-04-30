import React, { useState } from 'react';
import api from '../utils/api';
import { ModalWrapper } from './LogCallModal';
import { istToday } from '../utils/helpers';

export default function ScheduleFollowUpModal({ lead, onClose, onSuccess }) {
  const today = istToday();
  const [form, setForm] = useState({ follow_up_date: today, follow_up_time: '', note: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.follow_up_date) { setError('Please select a date'); return; }
    setLoading(true);
    try {
      await api.post('/follow-ups', { lead_id: lead.id, ...form });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule follow-up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={`Schedule Follow-Up — ${lead.full_name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date *</label>
            <input className="input" type="date" min={today} value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} />
          </div>
          <div>
            <label className="label">Time (optional)</label>
            <input className="input" type="time" value={form.follow_up_time} onChange={e => set('follow_up_time', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Note</label>
          <textarea className="input resize-none" rows={3} placeholder="What to discuss..." value={form.note} onChange={e => set('note', e.target.value)} />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Schedule'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
