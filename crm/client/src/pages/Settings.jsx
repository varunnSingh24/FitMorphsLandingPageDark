import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/helpers';
import { ModalWrapper } from '../components/LogCallModal';

const ROLES = ['admin', 'manager', 'sales_agent', 'dietician'];
const ROLE_LABELS = { admin: 'Admin', manager: 'Manager', sales_agent: 'Sales Agent', dietician: 'Dietician' };

export default function Settings() {
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
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm">Manage team members and permissions</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditUser(null); setShowModal(true); }}>
          + Add User
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-900 text-sm">Team Members</h2>
        </div>

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
                <span className={`badge text-xs flex-shrink-0 ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge text-xs ${
                  u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                  u.role === 'manager' ? 'bg-sky-100 text-sky-700' :
                  u.role === 'dietician' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-gray-100 text-gray-700'
                }`}>{ROLE_LABELS[u.role]}</span>
                {u.phone && <span className="text-xs text-gray-400 font-mono">{u.phone}</span>}
                <span className="text-xs text-gray-400">Joined {formatDate(u.created_at)}</span>
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
                  <td className="table-td">
                    <span className={`badge text-xs ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'manager' ? 'bg-sky-100 text-sky-700' :
                    u.role === 'dietician' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{ROLE_LABELS[u.role]}</span>
                  </td>
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
    </div>
  );
}

function UserModal({ user, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'sales_agent',
    phone: user?.phone || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || (!user && !form.password)) {
      setError('Name, email and password are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (user) {
        await api.put(`/users/${user.id}`, form);
      } else {
        await api.post('/users', form);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user');
    } finally {
      setLoading(false);
    }
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
