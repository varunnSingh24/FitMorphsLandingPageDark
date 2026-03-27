import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
  STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, SOURCE_LABELS,
  INTEREST_LABELS, OUTCOME_COLORS, formatDateTime, formatDate, formatDuration, timeAgo
} from '../../utils/helpers';
import LogCallModal from '../../components/LogCallModal';
import AddNoteModal from '../../components/AddNoteModal';
import ScheduleFollowUpModal from '../../components/ScheduleFollowUpModal';

const STATUSES = ['new','contacted','interested','follow_up','negotiation','converted','lost','junk'];

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [callLogs, setCallLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('timeline');
  const [modal, setModal] = useState(null); // 'call' | 'note' | 'followup'
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingStatus, setSavingStatus] = useState(false);

  const load = async () => {
    try {
      const [leadRes, actRes, callRes] = await Promise.all([
        api.get(`/leads/${id}`),
        api.get(`/activities/lead/${id}`),
        api.get(`/call-logs/lead/${id}`),
      ]);
      setLead(leadRes.data.lead);
      setEditForm(leadRes.data.lead);
      setActivities(actRes.data.activities);
      setCallLogs(callRes.data.callLogs);
    } catch (e) {
      if (e.response?.status === 404) navigate('/leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (['admin', 'manager'].includes(user?.role)) {
      api.get('/users').then(r => setUsers(r.data.users));
    }
  }, [user]);

  const handleStatusChange = async (status) => {
    setSavingStatus(true);
    try {
      await api.put(`/leads/${id}/status`, { status });
      setLead(l => ({ ...l, status }));
      load();
    } finally { setSavingStatus(false); }
  };

  const handleAssign = async (assigned_to) => {
    await api.put(`/leads/${id}/assign`, { assigned_to: parseInt(assigned_to) });
    load();
  };

  const handleSaveEdit = async () => {
    await api.put(`/leads/${id}`, editForm);
    setEditing(false);
    load();
  };

  if (loading) return <div className="text-center text-gray-400 py-20">Loading...</div>;
  if (!lead) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{lead.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge ${STATUS_COLORS[lead.status]}`}>{STATUS_LABELS[lead.status]}</span>
              <span className={`badge ${PRIORITY_COLORS[lead.priority]}`}>{lead.priority}</span>
              {lead.interested_in && <span className="badge bg-indigo-50 text-indigo-700">{INTEREST_LABELS[lead.interested_in]}</span>}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => setModal('call')} className="btn-primary flex items-center gap-1.5">
            📞 Log Call
          </button>
          <button onClick={() => setModal('note')} className="btn-secondary flex items-center gap-1.5">
            📝 Note
          </button>
          <button onClick={() => setModal('followup')} className="btn-secondary flex items-center gap-1.5">
            📅 Follow-Up
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Lead Info */}
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 text-sm">Contact Info</h2>
              <button onClick={() => setEditing(!editing)} className="text-xs text-blue-600 hover:underline">
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editing ? (
              <EditForm form={editForm} setForm={setEditForm} onSave={handleSaveEdit} />
            ) : (
              <dl className="space-y-2.5">
                <InfoRow label="Phone" value={<a href={`tel:${lead.phone}`} className="text-blue-600 font-mono">{lead.phone}</a>} />
                {lead.secondary_phone && <InfoRow label="Alt Phone" value={<span className="font-mono">{lead.secondary_phone}</span>} />}
                {lead.email && <InfoRow label="Email" value={lead.email} />}
                {lead.gender && <InfoRow label="Gender" value={<span className="capitalize">{lead.gender}</span>} />}
                {lead.age && <InfoRow label="Age" value={`${lead.age} years`} />}
                {lead.city && <InfoRow label="Location" value={`${lead.locality ? lead.locality + ', ' : ''}${lead.city}`} />}
                <InfoRow label="Source" value={SOURCE_LABELS[lead.source] || lead.source || '—'} />
                {lead.source_detail && <InfoRow label="Source Detail" value={lead.source_detail} />}
                {lead.notes && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-1">Notes</div>
                    <p className="text-sm text-gray-700">{lead.notes}</p>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* Status */}
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Change Status</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={savingStatus || lead.status === s}
                  className={`text-xs px-2 py-1.5 rounded border transition-colors ${
                    lead.status === s ? 'bg-blue-600 text-white border-blue-600 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Assign */}
          {['admin', 'manager'].includes(user?.role) && (
            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 text-sm mb-3">Assignment</h2>
              <select
                className="select text-sm"
                value={lead.assigned_to || ''}
                onChange={e => handleAssign(e.target.value)}
              >
                <option value="">Unassigned</option>
                {users.filter(u => ['sales_agent','manager'].includes(u.role)).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              {lead.assigned_name && (
                <p className="text-xs text-gray-500 mt-2">Currently: <span className="font-medium">{lead.assigned_name}</span></p>
              )}
            </div>
          )}

          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-2">Metadata</h2>
            <dl className="space-y-2">
              <InfoRow label="Created" value={formatDateTime(lead.created_at)} />
              <InfoRow label="Last Updated" value={timeAgo(lead.updated_at)} />
            </dl>
          </div>
        </div>

        {/* Right: Timeline / Calls */}
        <div className="col-span-2 card">
          {/* Tabs */}
          <div className="border-b border-gray-200 px-4">
            <div className="flex gap-0">
              {[['timeline','Timeline'], ['calls','Call History']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label} {key === 'calls' && callLogs.length > 0 && <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{callLogs.length}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
            {tab === 'timeline' && (
              activities.length === 0
                ? <EmptyState text="No activity yet" />
                : activities.map(a => (
                  <TimelineItem key={a.id} activity={a} />
                ))
            )}

            {tab === 'calls' && (
              callLogs.length === 0
                ? <EmptyState text="No calls logged yet" />
                : callLogs.map(c => (
                  <CallLogItem key={c.id} log={c} />
                ))
            )}
          </div>
        </div>
      </div>

      {modal === 'call' && <LogCallModal lead={lead} onClose={() => setModal(null)} onSuccess={() => { setModal(null); load(); }} />}
      {modal === 'note' && <AddNoteModal lead={lead} onClose={() => setModal(null)} onSuccess={() => { setModal(null); load(); }} />}
      {modal === 'followup' && <ScheduleFollowUpModal lead={lead} onClose={() => setModal(null)} onSuccess={() => { setModal(null); load(); }} />}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <dt className="text-xs text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm text-gray-900 flex-1">{value || '—'}</dd>
    </div>
  );
}

function TimelineItem({ activity }) {
  const icons = { call: '📞', email: '📧', whatsapp: '💬', meeting: '🤝', note: '📝', status_change: '🔄', assignment_change: '👤' };
  return (
    <div className="flex gap-3">
      <div className="text-base mt-0.5 flex-shrink-0">{icons[activity.activity_type] || '📝'}</div>
      <div className="flex-1">
        <div className="text-sm text-gray-700">{activity.description}</div>
        <div className="text-xs text-gray-400 mt-0.5">{activity.user_name} · {formatDateTime(activity.created_at)}</div>
      </div>
    </div>
  );
}

function CallLogItem({ log }) {
  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 capitalize">{log.call_type} Call</span>
          <span className={`badge text-xs ${OUTCOME_COLORS[log.call_outcome]}`}>{log.call_outcome?.replace(/_/g, ' ')}</span>
        </div>
        <div className="text-xs text-gray-400">{formatDuration(log.call_duration_seconds)}</div>
      </div>
      {log.summary && <p className="text-sm text-gray-600 mt-2">{log.summary}</p>}
      {log.follow_up_date && (
        <div className="text-xs text-blue-600 mt-1.5">📅 Follow-up: {formatDate(log.follow_up_date)}</div>
      )}
      <div className="text-xs text-gray-400 mt-1.5">{log.caller_name} · {formatDateTime(log.created_at)}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="text-center text-gray-400 py-12 text-sm">{text}</div>;
}

const SOURCES_OPTS = ['walk_in','instagram','facebook','google_ads','referral','website','phone_inquiry','other'];
const INTERESTS = ['weight_loss','muscle_gain','yoga','crossfit','personal_training','group_classes','diet_plan','other'];

function EditForm({ form, setForm, onSave }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="space-y-3">
      <div><label className="label">Full Name</label><input className="input" value={form.full_name || ''} onChange={e => set('full_name', e.target.value)} /></div>
      <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
      <div><label className="label">Email</label><input className="input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
      <div><label className="label">City</label><input className="input" value={form.city || ''} onChange={e => set('city', e.target.value)} /></div>
      <div><label className="label">Source</label>
        <select className="select" value={form.source || ''} onChange={e => set('source', e.target.value)}>
          <option value="">Select</option>
          {SOURCES_OPTS.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
        </select>
      </div>
      <div><label className="label">Interested In</label>
        <select className="select" value={form.interested_in || ''} onChange={e => set('interested_in', e.target.value)}>
          <option value="">Select</option>
          {INTERESTS.map(i => <option key={i} value={i}>{INTEREST_LABELS[i]}</option>)}
        </select>
      </div>
      <div><label className="label">Notes</label><textarea className="input resize-none" rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value)} /></div>
      <button className="btn-primary w-full" onClick={onSave}>Save Changes</button>
    </div>
  );
}

