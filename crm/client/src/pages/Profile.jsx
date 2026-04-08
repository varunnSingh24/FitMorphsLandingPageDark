import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateTime, formatDuration, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, OUTCOME_COLORS } from '../utils/helpers';
import { ModalWrapper } from '../components/LogCallModal';

const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', sales_agent: 'Sales Agent', dietician: 'Dietician' };
const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-sky-100 text-sky-700',
  sales_agent: 'bg-gray-100 text-gray-700',
  dietician: 'bg-emerald-100 text-emerald-700',
};

const AVATAR_COLORS = [
  'bg-sky-500', 'bg-indigo-500', 'bg-violet-500', 'bg-pink-500',
  'bg-rose-500', 'bg-orange-500', 'bg-teal-500', 'bg-cyan-500',
];

function getAvatarColor(id) {
  return AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];
}

export default function Profile() {
  const { id } = useParams();
  const { user: authUser, updateUser } = useAuth();
  const navigate = useNavigate();

  const targetId = id ? parseInt(id) : authUser?.id;
  const isSelf = targetId === authUser?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('calls');
  const [showEdit, setShowEdit] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/users/${targetId}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load profile');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (targetId) load();
  }, [targetId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading profile...
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-xl mx-auto mt-16 text-center">
      <div className="text-5xl mb-4">🚫</div>
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Access Denied</h2>
      <p className="text-gray-500 text-sm mb-4">{error}</p>
      <button onClick={() => navigate(-1)} className="btn-secondary text-sm">Go Back</button>
    </div>
  );

  if (!data) return null;
  const { user, stats, recentCalls, assignedLeads } = data;

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header Card */}
      <div className="card p-4 sm:p-6">
        {/* Top row: avatar + info + edit btn */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {/* Avatar */}
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${getAvatarColor(user.id)} flex items-center justify-center text-white text-2xl sm:text-3xl font-bold flex-shrink-0 shadow-lg`}>
              {user.name?.[0]?.toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">{user.name}</h1>
                <span className={`badge text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </span>
                <span className={`badge text-xs ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {user.is_active ? '● Active' : '● Inactive'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5 sm:gap-4 mt-1 text-xs sm:text-sm text-gray-500">
                <span className="flex items-center gap-1.5 truncate">
                  <EmailIcon className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{user.email}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <PhoneIcon className="w-3.5 h-3.5 flex-shrink-0" /> {user.phone || 'No phone added'}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" /> Joined {formatDate(user.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Edit button */}
          {(isSelf || authUser?.role === 'admin') && (
            <button
              onClick={() => setShowEdit(true)}
              className="btn-secondary text-sm flex items-center gap-1.5 self-start sm:flex-shrink-0"
            >
              <EditIcon className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-gray-100">
          <StatCard label="Total Leads" value={stats.totalLeads} sub={`${stats.activeLeads} active`} color="blue" icon="👥" />
          <StatCard label="Conversions" value={stats.conversions} sub="all time" color="green" icon="✅" />
          <StatCard label="Calls This Month" value={stats.callsMonth} sub={`${stats.callsTotal} total`} color="purple" icon="📞" />
          <StatCard label="Pending Follow-ups" value={stats.pendingFollowUps} sub={stats.overdueFollowUps > 0 ? `${stats.overdueFollowUps} overdue` : 'all on track'} color={stats.overdueFollowUps > 0 ? 'red' : 'gray'} icon="📅" />
        </div>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { key: 'calls', label: `Recent Calls (${recentCalls.length})` },
            { key: 'leads', label: `Assigned Leads (${assignedLeads.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'calls' && (
          <div>
            {recentCalls.length === 0 ? (
              <EmptyState icon="📞" message="No calls logged yet" />
            ) : (
              <>
                {/* Mobile call cards */}
                <div className="sm:hidden divide-y divide-gray-50">
                  {recentCalls.map(call => (
                    <div key={call.id} className="px-4 py-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/leads/${call.lead_id}`} className="font-medium text-sky-600 text-sm">{call.lead_name}</Link>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(call.created_at)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`badge text-xs ${call.call_type === 'inbound' ? 'bg-green-100 text-green-700' : 'bg-sky-100 text-sky-700'}`}>
                          {call.call_type === 'inbound' ? '↙ Inbound' : '↗ Outbound'}
                        </span>
                        <span className={`badge text-xs ${OUTCOME_COLORS[call.call_outcome] || 'bg-gray-100 text-gray-600'}`}>
                          {call.call_outcome?.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-gray-400">{formatDuration(call.call_duration_seconds)}</span>
                      </div>
                      {call.summary && <p className="text-xs text-gray-500">{call.summary}</p>}
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="table-th">Lead</th>
                        <th className="table-th">Type</th>
                        <th className="table-th">Outcome</th>
                        <th className="table-th">Duration</th>
                        <th className="table-th">Summary</th>
                        <th className="table-th">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentCalls.map(call => (
                        <tr key={call.id} className="hover:bg-gray-50">
                          <td className="table-td">
                            <Link to={`/leads/${call.lead_id}`} className="font-medium text-sky-600 hover:underline text-sm">{call.lead_name}</Link>
                            <div className="text-xs text-gray-400 font-mono">{call.lead_phone}</div>
                          </td>
                          <td className="table-td">
                            <span className={`badge text-xs ${call.call_type === 'inbound' ? 'bg-green-100 text-green-700' : 'bg-sky-100 text-sky-700'}`}>
                              {call.call_type === 'inbound' ? '↙ Inbound' : '↗ Outbound'}
                            </span>
                          </td>
                          <td className="table-td">
                            <span className={`badge text-xs ${OUTCOME_COLORS[call.call_outcome] || 'bg-gray-100 text-gray-600'}`}>
                              {call.call_outcome?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="table-td text-xs text-gray-500">{formatDuration(call.call_duration_seconds)}</td>
                          <td className="table-td max-w-xs"><p className="text-xs text-gray-500 truncate">{call.summary || '—'}</p></td>
                          <td className="table-td text-xs text-gray-400 whitespace-nowrap">{formatDateTime(call.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'leads' && (
          <div>
            {assignedLeads.length === 0 ? (
              <EmptyState icon="👥" message="No leads assigned yet" />
            ) : (
              <>
                {/* Mobile lead cards */}
                <div className="sm:hidden divide-y divide-gray-50">
                  {assignedLeads.map(lead => (
                    <div key={lead.id} className="px-4 py-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/leads/${lead.id}`} className="font-medium text-sky-600 text-sm">{lead.full_name}</Link>
                        <span className="text-xs text-gray-400 font-mono">{lead.phone}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className={`badge text-xs ${STATUS_COLORS[lead.status]}`}>{STATUS_LABELS[lead.status]}</span>
                        <span className={`badge text-xs ${PRIORITY_COLORS[lead.priority]}`}>{lead.priority}</span>
                        <span className="text-xs text-gray-400">
                          {lead.last_call ? formatDate(lead.last_call) : <span className="text-red-400">Never called</span>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="table-th">Name</th>
                        <th className="table-th">Phone</th>
                        <th className="table-th">Status</th>
                        <th className="table-th">Priority</th>
                        <th className="table-th">Last Call</th>
                        <th className="table-th">Added</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {assignedLeads.map(lead => (
                        <tr key={lead.id} className="hover:bg-gray-50">
                          <td className="table-td">
                            <Link to={`/leads/${lead.id}`} className="font-medium text-sky-600 hover:underline text-sm">{lead.full_name}</Link>
                          </td>
                          <td className="table-td font-mono text-xs text-gray-500">{lead.phone}</td>
                          <td className="table-td"><span className={`badge text-xs ${STATUS_COLORS[lead.status]}`}>{STATUS_LABELS[lead.status]}</span></td>
                          <td className="table-td"><span className={`badge text-xs ${PRIORITY_COLORS[lead.priority]}`}>{lead.priority}</span></td>
                          <td className="table-td text-xs text-gray-400">
                            {lead.last_call ? formatDateTime(lead.last_call) : <span className="text-red-400">Never called</span>}
                          </td>
                          <td className="table-td text-xs text-gray-400">{formatDate(lead.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showEdit && (
        <EditProfileModal
          user={user}
          isSelf={isSelf}
          isAdmin={authUser?.role === 'admin'}
          onClose={() => setShowEdit(false)}
          onSuccess={(updatedUser) => {
            setShowEdit(false);
            if (isSelf && updateUser) updateUser(updatedUser);
            load();
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }) {
  const colors = {
    blue: 'bg-sky-50 text-sky-700',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
  };
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
      <div className="text-xs opacity-70 mt-0.5">{sub}</div>
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function EditProfileModal({ user, isSelf, isAdmin, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: user.name || '',
    phone: user.phone || '',
    password: '',
    confirmPassword: '',
    role: user.role,
    is_active: user.is_active,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.password && form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password && form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let res;
      if (isSelf && !isAdmin) {
        // Self-update via /me endpoint (no role/active changes)
        res = await api.put('/users/me', {
          name: form.name,
          phone: form.phone,
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        // Admin update via /:id
        res = await api.put(`/users/${user.id}`, {
          name: form.name,
          phone: form.phone,
          role: form.role,
          is_active: form.is_active,
          ...(form.password ? { password: form.password } : {}),
        });
      }
      onSuccess(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper onClose={onClose} title="Edit Profile">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}

        {/* Avatar preview */}
        <div className="flex items-center gap-3 pb-2">
          <div className={`w-14 h-14 rounded-xl ${getAvatarColor(user.id)} flex items-center justify-center text-white text-xl font-bold`}>
            {form.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{form.name || 'Name'}</div>
            <div className="text-xs text-gray-400">{user.email}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Full Name *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" required />
          </div>
          <div className="col-span-2">
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210" />
          </div>
        </div>

        {/* Admin-only fields */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-4 pt-1 border-t border-gray-100">
            <div>
              <label className="label">Role</label>
              <select className="select" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="sales_agent">Sales Agent</option>
                <option value="dietician">Dietician</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="select" value={form.is_active ? '1' : '0'} onChange={e => set('is_active', e.target.value === '1')}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>
        )}

        {/* Change password */}
        <div className="pt-1 border-t border-gray-100 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Change Password <span className="normal-case font-normal">(leave blank to keep current)</span></p>
          <div>
            <label className="label">New Password</label>
            <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 6 characters" />
          </div>
          {form.password && (
            <div>
              <label className="label">Confirm Password</label>
              <input className="input" type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="Repeat password" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────
function EmailIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
}
function PhoneIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>;
}
function CalendarIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
}
function EditIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
}
