import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, timeAgo } from '../../utils/helpers';
import LogCallModal from '../../components/LogCallModal';
import WhatsAppBtn, { waLink } from '../../components/WhatsAppBtn';

const STATUSES = ['new','contacted','interested','follow_up','negotiation','converted','lost','junk'];
const PRIORITIES = ['hot','warm','cold'];
const DEFAULT_SOURCES = [
  { key: 'walk_in', label: 'Walk-in' }, { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' }, { key: 'google_ads', label: 'Google Ads' },
  { key: 'referral', label: 'Referral' }, { key: 'website', label: 'Website' },
  { key: 'phone_inquiry', label: 'Phone Inquiry' }, { key: 'other', label: 'Other' },
];

export default function LeadList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [callLead, setCallLead] = useState(null);
  const [bulkAssignTo, setBulkAssignTo] = useState('');
  const [sources, setSources] = useState(DEFAULT_SOURCES);

  const [filters, setFilters] = useState({
    search: '', status: '', source: '', assigned_to: '', priority: '',
    date_from: '', date_to: '', page: 1,
  });

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''));
      const res = await api.get('/leads', { params });
      setLeads(res.data.leads);
      setTotal(res.data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    // Fetch dynamic sources from settings
    api.get('/settings/lead_sources').then(r => {
      if (r.data.value && Array.isArray(r.data.value)) setSources(r.data.value);
    }).catch(() => {});

    if (['admin', 'manager'].includes(user?.role)) {
      api.get('/users').then(r => setUsers(r.data.users));
    }
  }, [user]);

  const handleBulkAssign = async () => {
    if (!selected.length || !bulkAssignTo) return;
    await api.post('/leads/bulk-assign', { lead_ids: selected, assigned_to: parseInt(bulkAssignTo) });
    setSelected([]);
    setBulkAssignTo('');
    loadLeads();
  };

  const handleBulkDelete = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} lead(s)? This cannot be undone.`)) return;
    await api.post('/leads/bulk-delete', { lead_ids: selected });
    setSelected([]);
    loadLeads();
  };

  const handleDelete = async (lead, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${lead.full_name}"? This cannot be undone.`)) return;
    await api.delete(`/leads/${lead.id}`);
    loadLeads();
  };

  // Update status in-place — no reload, no re-sort
  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await api.put(`/leads/${leadId}/status`, { status: newStatus });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    } catch (err) {
      console.error('Status update failed', err);
    }
  };

  const toggleAll = () => setSelected(selected.length === leads.length ? [] : leads.map(l => l.id));
  const toggleOne = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 text-sm">{total} leads total</p>
        </div>
        <Link to="/leads/add" className="btn-primary">+ Add Lead</Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-6 gap-3">
          <input
            className="input col-span-2"
            placeholder="Search name, phone, email..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
          />
          <select className="select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select className="select" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
          <select className="select" value={filters.source} onChange={e => setFilter('source', e.target.value)}>
            <option value="">All Sources</option>
            {sources.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          {['admin', 'manager'].includes(user?.role) && (
            <select className="select" value={filters.assigned_to} onChange={e => setFilter('assigned_to', e.target.value)}>
              <option value="">All Agents</option>
              {users.filter(u => u.role !== 'admin').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex gap-3 mt-3">
          <input className="input w-40" type="date" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} placeholder="From" />
          <input className="input w-40" type="date" value={filters.date_to} onChange={e => setFilter('date_to', e.target.value)} placeholder="To" />
          <button className="btn-secondary text-xs" onClick={() => setFilters({ search:'',status:'',source:'',assigned_to:'',priority:'',date_from:'',date_to:'',page:1 })}>
            Clear
          </button>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && ['admin', 'manager'].includes(user?.role) && (
        <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-lg px-4 py-2">
          <span className="text-sky-700 text-sm font-medium">{selected.length} selected</span>
          <select className="select w-48 text-sm py-1" value={bulkAssignTo} onChange={e => setBulkAssignTo(e.target.value)}>
            <option value="">Assign to agent...</option>
            {users.filter(u => ['sales_agent','manager','dietician'].includes(u.role)).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button className="btn-primary text-xs py-1.5" onClick={handleBulkAssign} disabled={!bulkAssignTo}>Assign</button>
          <button className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700" onClick={handleBulkDelete}>Delete</button>
          <button className="btn-secondary text-xs py-1.5" onClick={() => setSelected([])}>Cancel</button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['admin','manager'].includes(user?.role) && (
                  <th className="table-th w-10"><input type="checkbox" onChange={toggleAll} checked={selected.length === leads.length && leads.length > 0} className="rounded" /></th>
                )}
                <th className="table-th">Name</th>
                <th className="table-th">Phone</th>
                <th className="table-th">Source</th>
                <th className="table-th">Status</th>
                <th className="table-th">Priority</th>
                {['admin','manager'].includes(user?.role) && <th className="table-th">Assigned To</th>}
                <th className="table-th">Last Activity</th>
                <th className="table-th">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr><td colSpan={9} className="table-td text-center text-gray-400 py-10">Loading...</td></tr>
              )}
              {!loading && leads.length === 0 && (
                <tr><td colSpan={9} className="table-td text-center text-gray-400 py-10">No leads found</td></tr>
              )}
              {!loading && leads.map(lead => (
                <tr key={lead.id} className={`hover:bg-gray-50 cursor-pointer ${selected.includes(lead.id) ? 'bg-sky-50' : ''}`}>
                  {['admin','manager'].includes(user?.role) && (
                    <td className="table-td" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleOne(lead.id)} className="rounded" />
                    </td>
                  )}
                  <td className="table-td" onClick={() => navigate(`/leads/${lead.id}`)}>
                    <div className="font-medium text-gray-900">{lead.full_name}</div>
                    {lead.email && <div className="text-xs text-gray-400 truncate max-w-xs">{lead.email}</div>}
                  </td>
                  <td className="table-td text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-gray-700">{lead.phone}</span>
                      <WhatsAppBtn phone={lead.phone} leadName={lead.full_name} leadId={lead.id} size="xs" showLabel={false} />
                    </div>
                  </td>
                  <td className="table-td" onClick={() => navigate(`/leads/${lead.id}`)}>
                    <span className="text-xs text-gray-600">{sources.find(s => s.key === lead.source)?.label || lead.source || '—'}</span>
                  </td>
                  <td className="table-td" onClick={e => e.stopPropagation()}>
                    <select
                      value={lead.status}
                      onChange={e => handleStatusChange(lead.id, e.target.value)}
                      className={`badge cursor-pointer border border-transparent focus:outline-none focus:ring-2 focus:ring-sky-400 rounded-full pr-5 font-medium ${STATUS_COLORS[lead.status]}`}
                      style={{ WebkitAppearance: 'auto' }}
                      title="Change status"
                    >
                      {STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="table-td" onClick={() => navigate(`/leads/${lead.id}`)}>
                    <span className={`badge ${PRIORITY_COLORS[lead.priority]}`}>{lead.priority}</span>
                  </td>
                  {['admin','manager'].includes(user?.role) && (
                    <td className="table-td text-xs text-gray-600" onClick={() => navigate(`/leads/${lead.id}`)}>{lead.assigned_name || '—'}</td>
                  )}
                  <td className="table-td text-xs text-gray-400" onClick={() => navigate(`/leads/${lead.id}`)}>
                    {timeAgo(lead.last_activity || lead.created_at)}
                  </td>
                  <td className="table-td" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button
                        className="text-xs bg-sky-500 text-white px-2.5 py-1 rounded hover:bg-sky-600"
                        onClick={() => setCallLead(lead)}
                      >📞 Call</button>
                      {['admin','manager'].includes(user?.role) && (
                        <button
                          className="text-xs text-red-500 hover:text-red-700 hover:underline"
                          onClick={(e) => handleDelete(lead, e)}
                        >Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {callLead && (
        <LogCallModal
          lead={callLead}
          onClose={() => setCallLead(null)}
          onSuccess={() => { setCallLead(null); loadLeads(); }}
        />
      )}
    </div>
  );
}
