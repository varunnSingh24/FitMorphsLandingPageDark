import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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
    { label: 'Total Leads', value: stats?.total ?? 0, color: 'text-gray-900', bg: 'bg-gray-50' },
    { label: 'New Today', value: stats?.newToday ?? 0, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Contacted', value: stats?.contacted ?? 0, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Converted', value: stats?.converted ?? 0, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Lost', value: stats?.lost ?? 0, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-gray-500 text-sm mt-0.5">Here's what's happening today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-4">
        {statCards.map(c => (
          <div key={c.label} className={`card p-4 ${c.bg}`}>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Follow-ups today */}
        <div className="col-span-1 card">
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
        <div className="col-span-2 card">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Pipeline Funnel</h2>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats?.funnel || []} layout="vertical" margin={{ left: 60, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} tickFormatter={s => STATUS_LABELS[s] || s} width={80} />
                <Tooltip formatter={(v, n, p) => [v, STATUS_LABELS[p.payload.status]]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {stats?.funnel?.map(entry => (
                    <Cell key={entry.status} fill={FUNNEL_COLORS[entry.status] || '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {(stats?.recentActivity || []).map(a => (
              <div key={a.id} className="px-4 py-2.5 flex items-start gap-3">
                <span className="text-base mt-0.5">{activityIcon(a.activity_type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 truncate">
                    <Link to={`/leads/${a.lead_id}`} className="font-medium hover:text-sky-600">{a.lead_name}</Link>
                    {' — '}{a.description}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{a.user_name} · {timeAgo(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

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
