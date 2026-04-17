import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { timeAgo, STATUS_COLORS, STATUS_LABELS, formatDate } from '../utils/helpers';
import LogCallModal from '../components/LogCallModal';

const FUNNEL_COLORS = {
  new: '#6b7280', contacted: '#0ea5e9', interested: '#8b5cf6',
  follow_up: '#f59e0b', negotiation: '#f97316', converted: '#10b981',
  lost: '#ef4444', junk: '#9ca3af',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [followUps, setFollowUps] = useState([]);
  const [team, setTeam] = useState([]);
  const [callLead, setCallLead] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [statsRes, fuRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/follow-ups-today'),
      ]);
      setStats(statsRes.data);
      setFollowUps(fuRes.data.followUps);

      if (['admin', 'manager'].includes(user?.role)) {
        const teamRes = await api.get('/dashboard/team-performance');
        setTeam(teamRes.data.agents);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-gray-500 text-center py-20">Loading dashboard...</div>;

  const statCards = [
    { label: 'Total Leads', value: stats?.total ?? 0,     color: 'text-gray-900',   bg: 'bg-gray-50',   sub: 'all time' },
    { label: 'Added Today', value: stats?.newToday ?? 0,  color: 'text-sky-600',    bg: 'bg-sky-50',    sub: 'created today' },
    { label: 'Contacted',   value: stats?.contacted ?? 0, color: 'text-purple-600', bg: 'bg-purple-50', sub: 'total in stage' },
    { label: 'Converted',   value: stats?.converted ?? 0, color: 'text-green-600',  bg: 'bg-green-50',  sub: 'total all time' },
    { label: 'Lost',        value: stats?.lost ?? 0,      color: 'text-red-600',    bg: 'bg-red-50',    sub: 'total all time' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 text-sm mt-0.5">Here's what's happening today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {statCards.map(c => (
          <div key={c.label} className={`card p-4 ${c.bg}`}>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs font-medium text-gray-700 mt-1">{c.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Follow-ups today */}
        <div className="lg:col-span-1 card">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Today's Follow-Ups</h2>
            <span className="badge bg-orange-100 text-orange-700">{followUps.length}</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {followUps.length === 0 && (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">All caught up!</div>
            )}
            {followUps.map(f => (
              <div key={f.id} className="px-4 py-3 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Link to={`/leads/${f.lead_id}`} className="text-sm font-medium text-gray-900 hover:text-sky-600 truncate block">
                      {f.lead_name}
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{f.note || 'Follow up required'}</div>
                    {f.follow_up_time && <div className="text-xs text-orange-600 mt-0.5">{f.follow_up_time}</div>}
                  </div>
                  <button
                    onClick={() => setCallLead({ id: f.lead_id, full_name: f.lead_name, phone: f.lead_phone })}
                    className="text-xs bg-sky-500 text-white px-2 py-1 rounded hover:bg-sky-600 flex-shrink-0"
                  >
                    Call
                  </button>
                </div>
              </div>
            ))}
          </div>
          {followUps.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100">
              <Link to="/follow-ups" className="text-xs text-sky-600 hover:underline">View all follow-ups →</Link>
            </div>
          )}
        </div>

        {/* Pipeline Funnel */}
        <div className="lg:col-span-2 card">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Pipeline Funnel</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats?.funnel || []} layout="vertical" margin={{ left: 10, right: 48, top: 2, bottom: 2 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} tickFormatter={s => STATUS_LABELS[s] || s} width={90} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v, n, p) => [v, STATUS_LABELS[p.payload.status]]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {stats?.funnel?.map(entry => (
                    <Cell key={entry.status} fill={FUNNEL_COLORS[entry.status] || '#6b7280'} />
                  ))}
                  <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Daily Activity Log */}
        <DailyActivityLog userRole={user?.role} />

        {/* Team Performance */}
        {['admin', 'manager'].includes(user?.role) && (
          <div className="card">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Team Performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-th">Agent</th>
                    <th className="table-th text-right">Leads</th>
                    <th className="table-th text-right">Calls Today</th>
                    <th className="table-th text-right">Converted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {team.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="table-td">
                        <div className="font-medium text-gray-900">{a.name}</div>
                        <div className="text-xs text-gray-400 capitalize">{a.role?.replace('_', ' ')}</div>
                      </td>
                      <td className="table-td text-right">{a.total_leads}</td>
                      <td className="table-td text-right">{a.calls_today}</td>
                      <td className="table-td text-right">
                        <span className="text-green-600 font-medium">{a.conversions_this_month}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

// ── Daily Activity Log Component ─────────────────────────────────────────────
function DailyActivityLog({ userRole }) {
  const istToday = () => {
    const IST = 5.5 * 60 * 60 * 1000;
    return new Date(Date.now() + IST).toISOString().split('T')[0];
  };

  const [date, setDate] = useState(istToday());
  const [mode, setMode] = useState('date'); // 'date' | 'all'
  const [userId, setUserId] = useState('');
  const [data, setData] = useState({ activities: [], summary: {}, users: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ mode });
      if (mode === 'date') params.set('date', date);
      if (userId) params.set('user_id', userId);
      const res = await api.get(`/dashboard/activity-log?${params}`);
      setData(res.data);
    } catch {}
    finally { setLoading(false); }
  }, [date, mode, userId]);

  useEffect(() => { load(); }, [load]);

  const shiftDate = (days) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
    setMode('date');
  };

  const displayDate = () => {
    const today = istToday();
    const yesterday = new Date(Date.now() + 5.5 * 60 * 60 * 1000 - 86400000).toISOString().split('T')[0];
    if (date === today) return 'Today';
    if (date === yesterday) return 'Yesterday';
    return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isToday = date === istToday();

  // Group by user
  const grouped = {};
  data.activities.forEach(a => {
    const key = a.user_id;
    if (!grouped[key]) grouped[key] = { user_name: a.user_name, user_role: a.user_role, items: [] };
    grouped[key].items.push(a);
  });
  const groups = Object.values(grouped);

  const ACTIVITY_META = {
    call:             { icon: '📞', label: 'Call',          color: 'bg-sky-100 text-sky-700' },
    note:             { icon: '📝', label: 'Note',          color: 'bg-yellow-100 text-yellow-700' },
    status_change:    { icon: '🔄', label: 'Status',        color: 'bg-orange-100 text-orange-700' },
    assignment_change:{ icon: '👤', label: 'Assign',        color: 'bg-indigo-100 text-indigo-700' },
    whatsapp:         { icon: '💬', label: 'WhatsApp',      color: 'bg-green-100 text-green-700' },
    email:            { icon: '📧', label: 'Email',         color: 'bg-purple-100 text-purple-700' },
    meeting:          { icon: '🤝', label: 'Meeting',       color: 'bg-teal-100 text-teal-700' },
  };

  return (
    <div className="card flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Daily Activity Log</h2>
          <button
            onClick={() => { setMode(m => m === 'all' ? 'date' : 'all'); setDate(istToday()); }}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors ${
              mode === 'all'
                ? 'bg-sky-500 text-white border-sky-500'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            All Time
          </button>
        </div>

        {/* Date navigation */}
        {mode === 'date' && (
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDate(-1)} className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
            <input
              type="date"
              value={date}
              max={istToday()}
              onChange={e => { setDate(e.target.value); setMode('date'); }}
              className="flex-1 text-xs text-center border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300 cursor-pointer"
            />
            <span className="text-xs font-semibold text-gray-700 whitespace-nowrap min-w-[56px] text-center">{displayDate()}</span>
            <button
              onClick={() => shiftDate(1)}
              disabled={isToday}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
            {!isToday && (
              <button onClick={() => setDate(istToday())} className="text-xs text-sky-600 hover:underline whitespace-nowrap">Today</button>
            )}
          </div>
        )}

        {/* User filter (admin/manager only) */}
        {['admin', 'manager'].includes(userRole) && data.users?.length > 0 && (
          <select
            className="select text-xs py-1"
            value={userId}
            onChange={e => setUserId(e.target.value)}
          >
            <option value="">All Team Members</option>
            {data.users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role.replace('_', ' ')})</option>
            ))}
          </select>
        )}

        {/* Summary pills */}
        {!loading && data.summary?.total > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
              {data.summary.total} total
            </span>
            {data.summary.calls > 0 && (
              <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">📞 {data.summary.calls} calls</span>
            )}
            {data.summary.status_changes > 0 && (
              <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">🔄 {data.summary.status_changes} status</span>
            )}
            {data.summary.notes > 0 && (
              <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">📝 {data.summary.notes} notes</span>
            )}
          </div>
        )}
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : data.activities.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-3xl mb-1">📭</div>
            <p className="text-sm text-gray-400">
              {mode === 'all' ? 'No activities recorded yet.' : `No activity on ${displayDate()}.`}
            </p>
          </div>
        ) : groups.map(g => (
          <div key={g.user_name}>
            {/* User header (only when multiple users or admin view) */}
            {(groups.length > 1 || ['admin','manager'].includes(userRole)) && (
              <div className="px-4 py-2 bg-gray-50 flex items-center gap-2 sticky top-0 z-10">
                <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {g.user_name[0]?.toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-gray-700">{g.user_name}</span>
                <span className="text-[10px] text-gray-400 capitalize">{g.user_role?.replace('_', ' ')}</span>
                <span className="ml-auto text-[10px] text-gray-400">{g.items.length} action{g.items.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {g.items.map(a => {
              const meta = ACTIVITY_META[a.activity_type] || { icon: '📌', color: 'bg-gray-100 text-gray-600' };
              const timeStr = new Date(a.created_at.replace(' ', 'T') + '+05:30')
                .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
              return (
                <div key={a.id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                  <span className="text-sm mt-0.5 flex-shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1.5 flex-wrap">
                      <Link to={`/leads/${a.lead_id}`} className="text-sm font-medium text-gray-900 hover:text-sky-600 truncate">
                        {a.lead_name}
                      </Link>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{a.description}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 font-mono">{timeStr}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function activityIcon(type) {
  const icons = { call: '📞', email: '📧', whatsapp: '💬', meeting: '🤝', note: '📝', status_change: '🔄', assignment_change: '👤' };
  return icons[type] || '📝';
}
