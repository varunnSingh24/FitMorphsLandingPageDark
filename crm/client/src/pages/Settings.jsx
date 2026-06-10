import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/helpers';
import { ModalWrapper } from '../components/LogCallModal';

const ROLES = ['admin', 'manager', 'sales_agent', 'dietician'];
const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', sales_agent: 'Sales Agent', dietician: 'Dietician' };

const TABS = [
  { key: 'team', label: 'Team Members', icon: '👥' },
  { key: 'sources', label: 'Lead Sources', icon: '📡' },
  { key: 'programs', label: 'Program Types', icon: '📋' },
  { key: 'export', label: 'Export Data', icon: '⬇️' },
];

export default function Settings() {
  const [tab, setTab] = useState('team');

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm">Manage team, sources, and programs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'team' && <TeamSection />}
      {tab === 'sources' && <ConfigListSection settingKey="lead_sources" title="Lead Sources" description="Add or remove sources where leads come from. These appear in the Add Lead and Lead List filters." placeholder="e.g. YouTube Ads" />}
      {tab === 'programs' && <ConfigListSection settingKey="program_types" title="Program Types" description="Define program types for clients. These appear when converting a lead to an active client." placeholder="e.g. 1 Month Trial" />}
      {tab === 'export' && <ExportSection />}
    </div>
  );
}

// ── Export Data Section ─────────────────────────────────────────────────

const EXPORTS = [
  { key: 'leads',             label: 'Leads',             desc: 'All leads with assigned agent, call count, last activity, and current status.' },
  { key: 'clients',           label: 'Clients',           desc: 'All active clients joined with lead info, dietitian, and latest checkin stats.' },
  { key: 'call-logs',         label: 'Call Logs',         desc: 'Every call logged, with outcome, duration, and which agent made it.' },
  { key: 'follow-ups',        label: 'Follow-Ups',        desc: 'Scheduled and completed follow-ups across all leads.' },
  { key: 'activities',        label: 'Activity Log',      desc: 'Full activity timeline — calls, notes, status changes, assignments.' },
  { key: 'medical-histories', label: 'Medical Histories', desc: 'Lead medical info: conditions, medications, emergency contacts.' },
  { key: 'checkins',          label: 'Client Check-ins',  desc: 'Dietitian check-in notes with weight, compliance, energy level.' },
  { key: 'bsl',               label: 'BSL Readings',      desc: 'Blood sugar readings (fasting, PP, random) per client.' },
  { key: 'hba1c',             label: 'HbA1c Records',     desc: 'HbA1c lab results per client.' },
  { key: 'measurements',      label: 'Body Measurements', desc: 'Waist, hip, chest, arms, thighs per client over time.' },
];

function ExportSection() {
  const [downloading, setDownloading] = useState('');

  const download = async (key) => {
    setDownloading(key);
    try {
      // Use fetch with the JWT so the browser doesn't need to know the token.
      // Then turn the response into a blob and trigger a download via an anchor.
      const token = localStorage.getItem('crm_token');
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const base = isDev ? `http://${window.location.hostname}:3001` : window.location.origin;
      const res = await fetch(`${base}/api/export/${key}.csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      // Pull the filename from the Content-Disposition header (set by the server)
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `${key}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setDownloading('');
    }
  };

  const downloadAll = async () => {
    for (const e of EXPORTS) {
      // eslint-disable-next-line no-await-in-loop
      await download(e.key);
      // tiny pause so the browser actually shows each download
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 200));
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Export Data</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xl">
              Download CSV snapshots to import into another CRM or feed into an analytics tool.
              Files are UTF-8 encoded with a BOM so Excel and Google Sheets open Indian names correctly.
            </p>
          </div>
          <button
            onClick={downloadAll}
            disabled={!!downloading}
            className="btn-primary text-sm flex items-center gap-2"
          >
            ⬇️ Download All
          </button>
        </div>
      </div>

      <div className="card divide-y divide-gray-100">
        {EXPORTS.map(e => (
          <div key={e.key} className="flex items-start justify-between gap-4 p-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">{e.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{e.desc}</div>
            </div>
            <button
              onClick={() => download(e.key)}
              disabled={!!downloading}
              className="btn-secondary text-xs flex-shrink-0 flex items-center gap-1.5"
            >
              {downloading === e.key ? (
                <><span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Preparing…</>
              ) : (
                <>⬇️ CSV</>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Team Members Section ────────────────────────────────────────────────

function TeamSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const load = () => {
    api.get('/users').then(r => { setUsers(r.data.users); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleToggleActive = async (u) => {
    await api.put(`/users/${u.id}`, { is_active: !u.is_active });
    load();
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    await api.delete(`/users/${u.id}`);
    load();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div />
        <button className="btn-primary" onClick={() => { setEditUser(null); setShowModal(true); }}>
          + Add User
        </button>
      </div>

      <div className="card overflow-hidden">
        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-gray-100">
          {loading && <div className="px-4 py-8 text-center text-gray-400 text-sm">Loading...</div>}
          {users.map(u => (
            <div key={u.id} className={`px-4 py-3 space-y-2 ${!u.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-sky-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {u.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">{u.name}</div>
                    <div className="text-xs text-gray-400 truncate">{u.email}</div>
                  </div>
                </div>
                <RoleBadge role={u.role} />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Link to={`/profile/${u.id}`} className="text-xs text-gray-500 hover:text-sky-600 hover:underline">Profile</Link>
                <button onClick={() => { setEditUser(u); setShowModal(true); }} className="text-xs text-sky-600 hover:underline">Edit</button>
                <button onClick={() => handleToggleActive(u)} className={`text-xs ${u.is_active ? 'text-orange-600' : 'text-green-600'} hover:underline`}>
                  {u.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleDelete(u)} className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-th">Name</th>
                <th className="table-th">Email</th>
                <th className="table-th">Role</th>
                <th className="table-th">Phone</th>
                <th className="table-th">Status</th>
                <th className="table-th">Joined</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <tr><td colSpan={7} className="table-td text-center text-gray-400 py-8">Loading...</td></tr>}
              {users.map(u => (
                <tr key={u.id} className={`${!u.is_active ? 'opacity-50' : ''} hover:bg-gray-50`}>
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold">
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="table-td text-gray-600">{u.email}</td>
                  <td className="table-td"><RoleBadge role={u.role} /></td>
                  <td className="table-td font-mono text-xs">{u.phone || '—'}</td>
                  <td className="table-td">
                    <span className={`badge text-xs ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-td text-xs text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <Link to={`/profile/${u.id}`} className="text-xs text-gray-500 hover:text-sky-600 hover:underline">Profile</Link>
                      <button onClick={() => { setEditUser(u); setShowModal(true); }} className="text-xs text-sky-600 hover:underline">Edit</button>
                      <button onClick={() => handleToggleActive(u)} className={`text-xs ${u.is_active ? 'text-orange-600' : 'text-green-600'} hover:underline`}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(u)} className="text-xs text-red-600 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <UserModal
          user={editUser}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load(); }}
        />
      )}
    </>
  );
}

// ── Configurable List Section (Sources / Programs) ──────────────────────

function ConfigListSection({ settingKey, title, description, placeholder }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editIdx, setEditIdx] = useState(-1);
  const [editLabel, setEditLabel] = useState('');

  const load = () => {
    api.get(`/settings/${settingKey}`)
      .then(r => { setItems(r.data.value || []); setLoading(false); })
      .catch(() => { setItems([]); setLoading(false); });
  };

  useEffect(() => { load(); }, [settingKey]);

  const save = async (newItems) => {
    setSaving(true);
    try {
      await api.put(`/settings/${settingKey}`, { value: newItems });
      setItems(newItems);
    } catch (e) { alert('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    const key = newKey.trim() || newLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (items.some(i => i.key === key)) { alert('Key already exists'); return; }
    save([...items, { key, label: newLabel.trim() }]);
    setNewKey('');
    setNewLabel('');
  };

  const handleRemove = (idx) => {
    if (!window.confirm(`Remove "${items[idx].label}"?`)) return;
    save(items.filter((_, i) => i !== idx));
  };

  const handleEditSave = (idx) => {
    if (!editLabel.trim()) return;
    const updated = items.map((item, i) => i === idx ? { ...item, label: editLabel.trim() } : item);
    save(updated);
    setEditIdx(-1);
  };

  const handleMoveUp = (idx) => {
    if (idx === 0) return;
    const arr = [...items];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    save(arr);
  };

  const handleMoveDown = (idx) => {
    if (idx === items.length - 1) return;
    const arr = [...items];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    save(arr);
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map((item, idx) => (
            <div key={item.key} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => handleMoveUp(idx)} className="text-gray-300 hover:text-gray-600 text-xs leading-none" disabled={idx === 0}>▲</button>
                <button onClick={() => handleMoveDown(idx)} className="text-gray-300 hover:text-gray-600 text-xs leading-none" disabled={idx === items.length - 1}>▼</button>
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                {editIdx === idx ? (
                  <div className="flex items-center gap-2">
                    <input className="input py-1 text-sm" value={editLabel} onChange={e => setEditLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEditSave(idx)} autoFocus />
                    <button onClick={() => handleEditSave(idx)} className="text-xs text-green-600 hover:underline">Save</button>
                    <button onClick={() => setEditIdx(-1)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{item.label}</span>
                    <span className="text-xs text-gray-400 font-mono">({item.key})</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {editIdx !== idx && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => { setEditIdx(idx); setEditLabel(item.label); }} className="text-xs text-sky-600 hover:underline">Edit</button>
                  <button onClick={() => handleRemove(idx)} className="text-xs text-red-500 hover:underline">Remove</button>
                </div>
              )}
            </div>
          ))}

          {/* Add new */}
          <div className="px-4 py-3 bg-gray-50">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label">Label</label>
                <input className="input py-1.5 text-sm" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                  placeholder={placeholder} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
              </div>
              <div className="w-36">
                <label className="label">Key (auto)</label>
                <input className="input py-1.5 text-sm font-mono" value={newKey} onChange={e => setNewKey(e.target.value)}
                  placeholder="auto_generated" />
              </div>
              <button onClick={handleAdd} className="btn-primary py-1.5 text-sm" disabled={!newLabel.trim() || saving}>
                + Add
              </button>
            </div>
          </div>
        </div>
      )}

      {saving && <div className="px-4 py-1.5 bg-sky-50 text-sky-600 text-xs text-center">Saving...</div>}
    </div>
  );
}

// ── Shared Components ───────────────────────────────────────────────────

function RoleBadge({ role }) {
  const colors = {
    admin: 'bg-purple-100 text-purple-700',
    manager: 'bg-sky-100 text-sky-700',
    dietician: 'bg-emerald-100 text-emerald-700',
    sales_agent: 'bg-gray-100 text-gray-700',
  };
  return <span className={`badge text-xs ${colors[role] || 'bg-gray-100 text-gray-700'}`}>{ROLE_LABELS[role] || role}</span>;
}

function UserModal({ user, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '', password: '',
    role: user?.role || 'sales_agent', phone: user?.phone || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || (!user && !form.password)) {
      setError('Name, email and password are required'); return;
    }
    setLoading(true); setError('');
    try {
      if (user) await api.put(`/users/${user.id}`, form);
      else await api.post('/users', form);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user');
    } finally { setLoading(false); }
  };

  return (
    <ModalWrapper onClose={onClose} title={user ? `Edit ${user.name}` : 'Add New User'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <div>
          <label className="label">Full Name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Rahul Sharma" required />
        </div>
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="rahul@fitmorphs.com" required />
        </div>
        <div>
          <label className="label">{user ? 'New Password (leave blank to keep)' : 'Password *'}</label>
          <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder={user ? 'Leave blank to keep current' : '••••••••'} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Role</label>
            <select className="select" value={form.role} onChange={e => set('role', e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : user ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
