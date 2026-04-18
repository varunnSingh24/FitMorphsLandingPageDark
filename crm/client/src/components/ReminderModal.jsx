import React, { useState } from 'react';
import api from '../utils/api';

const TIME_PRESETS = ['08:00','09:30','11:00','12:00','14:00','16:00','18:00','20:00'];

export default function ReminderModal({ onClose, onSaved, refType, refId, refName, defaultTitle = '' }) {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    title: defaultTitle,
    date:  today,
    time:  '10:00',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim())    { setError('Title is required'); return; }
    if (!form.date || !form.time) { setError('Date and time are required'); return; }

    setSaving(true); setError('');
    try {
      await api.post('/reminders', {
        title:    form.title.trim(),
        message:  form.notes.trim() || null,
        due_at:   `${form.date} ${form.time}:00`,
        ref_type: refType || null,
        ref_id:   refId   ? parseInt(refId) : null,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save reminder');
    } finally {
      setSaving(false);
    }
  };

  const fmtPreset = (t) => {
    const [h, m] = t.split(':');
    return new Date(2000, 0, 1, +h, +m).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">

        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">🔔 Set Reminder</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          </div>
          {refName && (
            <p className="text-sm text-gray-400 mt-0.5">
              For: <span className="font-medium text-gray-600">{refName}</span>
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>
          )}

          {/* Title */}
          <div>
            <label className="label">What to remind *</label>
            <input
              className="input"
              placeholder="e.g. Call back, Follow up on diet plan, Check HbA1C report…"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date *</label>
              <input
                className="input"
                type="date"
                min={today}
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Callback Time *</label>
              <input
                className="input"
                type="time"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
              />
            </div>
          </div>

          {/* Quick time presets */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Quick pick time</p>
            <div className="flex flex-wrap gap-1.5">
              {TIME_PRESETS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, time: t }))}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    form.time === t
                      ? 'border-sky-400 bg-sky-50 text-sky-700 font-semibold'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {fmtPreset(t)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes <span className="text-gray-300 font-normal">(optional)</span></label>
            <input
              className="input"
              placeholder="Any context — e.g. 'client asked about protein intake'"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : '🔔 Set Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
