import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, STATUS_COLORS, STATUS_LABELS, istToday } from '../utils/helpers';
import LogCallModal from '../components/LogCallModal';

const FILTERS = [
  { key: 'today', label: 'Today', color: 'text-orange-600' },
  { key: 'overdue', label: 'Overdue', color: 'text-red-600' },
  { key: 'upcoming', label: 'Upcoming', color: 'text-green-600' },
  { key: 'completed', label: 'Completed', color: 'text-gray-600' },
];

export default function FollowUps() {
  const [followUps, setFollowUps] = useState([]);
  const [filter, setFilter] = useState('today');
  const [loading, setLoading] = useState(true);
  const [callLead, setCallLead] = useState(null);

  const today = istToday();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/follow-ups', { params: { filter } });
      setFollowUps(res.data.followUps);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const handleComplete = async (id, lead) => {
    await api.put(`/follow-ups/${id}/complete`);
    setCallLead({ id: lead.lead_id, full_name: lead.lead_name, phone: lead.lead_phone });
    load();
  };

  const getColor = (f) => {
    if (f.is_completed) return 'border-gray-200 bg-gray-50';
    if (f.follow_up_date < today) return 'border-red-200 bg-red-50';
    if (f.follow_up_date === today) return 'border-orange-200 bg-orange-50';
    return 'border-green-200 bg-green-50';
  };

  const getDotColor = (f) => {
    if (f.is_completed) return 'bg-gray-400';
    if (f.follow_up_date < today) return 'bg-red-500';
    if (f.follow_up_date === today) return 'bg-orange-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Follow-Ups</h1>
        <p className="text-gray-500 text-sm">{followUps.length} follow-ups</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-400 text-center py-10">Loading...</div>}

      {!loading && followUps.length === 0 && (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">{filter === 'completed' ? '✅' : filter === 'overdue' ? '⚠️' : '📅'}</div>
          <div className="text-gray-500">No {filter} follow-ups</div>
        </div>
      )}

      <div className="space-y-3">
        {followUps.map(f => (
          <div key={f.id} className={`card border-l-4 ${getColor(f)} p-4 flex items-start gap-4`}>
            <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${getDotColor(f)}`} />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link to={`/leads/${f.lead_id}`} className="font-medium text-gray-900 hover:text-sky-600">
                    {f.lead_name}
                  </Link>
                  <span className="ml-2">
                    <span className={`badge text-xs ${STATUS_COLORS[f.lead_status]}`}>{STATUS_LABELS[f.lead_status]}</span>
                  </span>
                </div>
                <div className="text-xs text-gray-500 flex-shrink-0">
                  {formatDate(f.follow_up_date)}{f.follow_up_time && ` at ${f.follow_up_time}`}
                </div>
              </div>

              {f.note && <p className="text-sm text-gray-600 mt-1">{f.note}</p>}

              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-gray-400">Phone: <span className="font-mono">{f.lead_phone}</span></span>
                <span className="text-xs text-gray-400">Assigned: {f.assigned_name}</span>
              </div>
            </div>

            {!f.is_completed && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setCallLead({ id: f.lead_id, full_name: f.lead_name, phone: f.lead_phone })}
                  className="text-xs bg-sky-500 text-white px-3 py-1.5 rounded hover:bg-sky-600"
                >
                  📞 Call
                </button>
                <button
                  onClick={() => handleComplete(f.id, f)}
                  className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700"
                >
                  ✓ Done
                </button>
              </div>
            )}

            {f.is_completed && (
              <span className="text-xs text-gray-400 flex-shrink-0">Completed</span>
            )}
          </div>
        ))}
      </div>

      {callLead && (
        <LogCallModal
          lead={callLead}
          onClose={() => setCallLead(null)}
          onSuccess={() => { setCallLead(null); load(); }}
        />
      )}
    </div>
  );
}
