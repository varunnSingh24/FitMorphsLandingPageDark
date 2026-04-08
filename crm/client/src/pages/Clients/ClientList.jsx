import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { timeAgo } from '../../utils/helpers';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-sky-100 text-sky-700',
  dropped: 'bg-red-100 text-red-700',
};
const STATUS_LABELS = { active: 'Active', paused: 'Paused', completed: 'Completed', dropped: 'Dropped' };

const AVATAR_COLORS = ['bg-sky-500','bg-violet-500','bg-pink-500','bg-teal-500','bg-orange-500','bg-indigo-500'];
const avatarColor = (id) => AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];

export default function ClientList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dietitians, setDietitians] = useState([]);
  const [dietitianFilter, setDietitianFilter] = useState('');

  useEffect(() => {
    loadClients();
    if (['admin', 'manager'].includes(user?.role)) {
      api.get('/users').then(r => {
        setDietitians(r.data.users.filter(u => ['dietician', 'sales_agent'].includes(u.role)));
      }).catch(() => {});
    }
  }, [user]);

  const loadClients = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (dietitianFilter) params.dietitian_id = dietitianFilter;
      const res = await api.get('/clients', { params });
      setClients(res.data.clients);
    } catch (err) {
      console.error('Failed to load clients', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { loadClients(); }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, dietitianFilter]);

  const weightProgress = (client) => {
    if (!client.current_weight_kg || !client.target_weight_kg) return null;
    const diff = client.current_weight_kg - client.target_weight_kg;
    return diff;
  };

  const statCounts = {
    total: clients.length,
    active: clients.filter(c => c.status === 'active').length,
    paused: clients.filter(c => c.status === 'paused').length,
    completed: clients.filter(c => c.status === 'completed').length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center text-gray-400">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading clients...
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-400">Manage active clients and their progress</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Clients', value: statCounts.total, color: 'bg-gray-50 text-gray-700' },
          { label: 'Active', value: statCounts.active, color: 'bg-green-50 text-green-700' },
          { label: 'Paused', value: statCounts.paused, color: 'bg-yellow-50 text-yellow-700' },
          { label: 'Completed', value: statCounts.completed, color: 'bg-sky-50 text-sky-700' },
        ].map(s => (
          <div key={s.label} className={`card p-3 ${s.color}`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs opacity-70">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Search by name or phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <select className="select w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {['admin', 'manager'].includes(user?.role) && (
            <select className="select w-auto" value={dietitianFilter} onChange={e => setDietitianFilter(e.target.value)}>
              <option value="">All Dietitians</option>
              {dietitians.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Client List */}
      {clients.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🧑‍⚕️</div>
          <h3 className="text-gray-900 font-semibold mb-1">No clients yet</h3>
          <p className="text-sm text-gray-400">Convert leads to clients from the lead detail page</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="card overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="table-th">Client</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Program</th>
                  <th className="table-th">Weight Progress</th>
                  <th className="table-th">Check-ins</th>
                  <th className="table-th">Last Check-in</th>
                  {['admin','manager'].includes(user?.role) && <th className="table-th">Dietitian</th>}
                </tr>
              </thead>
              <tbody>
                {clients.map(client => {
                  const wp = weightProgress(client);
                  return (
                    <tr
                      key={client.id}
                      onClick={() => navigate(`/clients/${client.id}`)}
                      className="border-b border-gray-50 hover:bg-sky-50/30 cursor-pointer transition-colors"
                    >
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl ${avatarColor(client.id)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                            {client.full_name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{client.full_name}</div>
                            <div className="text-xs text-gray-400 font-mono">{client.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="table-td">
                        <span className={`badge ${STATUS_COLORS[client.status]}`}>{STATUS_LABELS[client.status] || client.status}</span>
                      </td>
                      <td className="table-td">
                        <span className="text-sm capitalize">{(client.program_type || 'custom').replace(/_/g, ' ')}</span>
                      </td>
                      <td className="table-td">
                        {client.current_weight_kg ? (
                          <div className="text-sm">
                            <span className="font-semibold">{client.current_weight_kg} kg</span>
                            {client.target_weight_kg && (
                              <span className="text-gray-400 text-xs ml-1">
                                → {client.target_weight_kg} kg
                                {wp !== null && (
                                  <span className={`ml-1 font-medium ${wp > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                                    ({wp > 0 ? '+' : ''}{wp.toFixed(1)})
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-td text-center">
                        <span className="font-semibold text-sky-600">{client.total_checkins || 0}</span>
                      </td>
                      <td className="table-td">
                        {client.last_checkin ? (
                          <span className="text-xs text-gray-500">{timeAgo(client.last_checkin)}</span>
                        ) : <span className="text-gray-300 text-xs">Never</span>}
                      </td>
                      {['admin','manager'].includes(user?.role) && (
                        <td className="table-td text-sm text-gray-600">{client.dietitian_name || '—'}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {clients.map(client => {
              const wp = weightProgress(client);
              return (
                <Link key={client.id} to={`/clients/${client.id}`} className="card-hover p-4 block">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl ${avatarColor(client.id)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                      {client.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 truncate">{client.full_name}</div>
                        <span className={`badge text-xs ${STATUS_COLORS[client.status]}`}>{STATUS_LABELS[client.status] || client.status}</span>
                      </div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">{client.phone}</div>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        {client.current_weight_kg && (
                          <span className="text-gray-600">
                            <span className="font-semibold">{client.current_weight_kg}kg</span>
                            {client.target_weight_kg && (
                              <span className="text-gray-400"> → {client.target_weight_kg}kg</span>
                            )}
                          </span>
                        )}
                        <span className="text-sky-600">{client.total_checkins || 0} check-ins</span>
                        {client.last_checkin && (
                          <span className="text-gray-400">{timeAgo(client.last_checkin)}</span>
                        )}
                      </div>
                      {['admin','manager'].includes(user?.role) && client.dietitian_name && (
                        <div className="text-xs text-gray-400 mt-1">Dietitian: {client.dietitian_name}</div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SearchIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>;
}
