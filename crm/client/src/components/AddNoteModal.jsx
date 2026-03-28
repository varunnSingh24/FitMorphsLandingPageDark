import React, { useState } from 'react';
import api from '../utils/api';
import { ModalWrapper } from './LogCallModal';

export default function AddNoteModal({ lead, onClose, onSuccess }) {
  const [type, setType] = useState('note');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) { setError('Please enter a note'); return; }
    setLoading(true);
    try {
      await api.post('/activities', { lead_id: lead.id, activity_type: type, description });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={`Add Note — ${lead.full_name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

        <div>
          <label className="label">Type</label>
          <select className="select" value={type} onChange={e => setType(e.target.value)}>
            <option value="note">Note</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="meeting">Meeting</option>
          </select>
        </div>

        <div>
          <label className="label">Description *</label>
          <textarea
            className="input resize-none"
            rows={4}
            placeholder="Enter your notes..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
