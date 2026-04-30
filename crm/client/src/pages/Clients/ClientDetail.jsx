import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatDateTime, timeAgo, istToday } from '../../utils/helpers';
import ReminderModal from '../../components/ReminderModal';
import WhatsAppBtn from '../../components/WhatsAppBtn';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-sky-100 text-sky-700',
  dropped: 'bg-red-100 text-red-700',
};
const STATUS_LABELS = { active: 'Active', paused: 'Paused', completed: 'Completed', dropped: 'Dropped' };

const CHECKIN_TYPES = [
  { key: 'food_review', label: 'Food Review', icon: '🍽', color: 'bg-green-100 text-green-700' },
  { key: 'weekly_call', label: 'Weekly Call', icon: '📞', color: 'bg-sky-100 text-sky-700' },
  { key: 'monthly_assessment', label: 'Monthly Assessment', icon: '📊', color: 'bg-purple-100 text-purple-700' },
  { key: 'adhoc_call', label: 'Ad-hoc Call', icon: '💬', color: 'bg-orange-100 text-orange-700' },
];

const COMPLIANCE_OPTIONS = ['excellent', 'good', 'average', 'poor'];
const ENERGY_OPTIONS = ['high', 'moderate', 'low', 'very_low'];

const AVATAR_COLORS = ['bg-sky-500','bg-violet-500','bg-pink-500','bg-teal-500','bg-orange-500','bg-indigo-500'];
const avatarColor = (id) => AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [client, setClient] = useState(null);
  const [medical, setMedical] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [checkinForm, setCheckinForm] = useState({
    checkin_type: 'food_review', weight_kg: '', compliance: '', energy_level: '',
    notes: '', next_checkin_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [dietitians, setDietitians] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [bslData, setBslData] = useState({ readings: [], hba1c: [] });
  const [measurementsData, setMeasurementsData] = useState({ measurements: [] });

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/clients/${id}`);
      setClient(res.data.client);
      setMedical(res.data.medical);
      setCheckins(res.data.checkins || []);
      setEditForm({
        dietitian_id: res.data.client.dietitian_id || '',
        program_type: res.data.client.program_type || 'custom',
        start_date: res.data.client.start_date || '',
        end_date: res.data.client.end_date || '',
        current_weight_kg: res.data.client.current_weight_kg || '',
        target_weight_kg: res.data.client.target_weight_kg || '',
        status: res.data.client.status || 'active',
        notes: res.data.client.notes || '',
      });
    } catch (e) {
      if (e.response?.status === 404 || e.response?.status === 403) navigate('/clients');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const loadBSL = useCallback(async () => {
    try {
      const r = await api.get(`/bsl/client/${id}`);
      setBslData(r.data);
    } catch {}
  }, [id]);

  const loadMeasurements = useCallback(async () => {
    try {
      const r = await api.get(`/measurements/client/${id}`);
      setMeasurementsData(r.data);
    } catch {}
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadBSL(); }, [loadBSL]);
  useEffect(() => { loadMeasurements(); }, [loadMeasurements]);
  useEffect(() => {
    if (['admin', 'manager'].includes(user?.role)) {
      api.get('/users').then(r => {
        setDietitians(r.data.users.filter(u => ['dietician', 'sales_agent'].includes(u.role)));
      }).catch(() => {});
    }
  }, [user]);

  const handleCheckin = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/clients/${id}/checkins`, {
        ...checkinForm,
        weight_kg: checkinForm.weight_kg ? parseFloat(checkinForm.weight_kg) : undefined,
      });
      setShowCheckinForm(false);
      setCheckinForm({ checkin_type: 'food_review', weight_kg: '', compliance: '', energy_level: '', notes: '', next_checkin_date: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to log check-in');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/clients/${id}`, editForm);
      setEditing(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/clients/${id}`);
      navigate('/clients');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete client');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center text-gray-400">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading client...
      </div>
    </div>
  );
  if (!client) return null;

  // Weight chart data from checkins
  const weightData = checkins
    .filter(c => c.weight_kg)
    .reverse()
    .map(c => ({ date: c.created_at, weight: c.weight_kg }));

  // Add current weight as latest if not in checkins
  if (client.current_weight_kg && weightData.length === 0) {
    weightData.push({ date: client.updated_at, weight: client.current_weight_kg });
  }

  const weightMin = weightData.length > 0 ? Math.min(...weightData.map(w => w.weight)) - 2 : 0;
  const weightMax = weightData.length > 0 ? Math.max(...weightData.map(w => w.weight)) + 2 : 100;
  const weightRange = weightMax - weightMin || 1;

  return (
    <div className="space-y-5 max-w-7xl">

      {/* Reminder Modal */}
      {showReminder && (
        <ReminderModal
          refType="client"
          refId={client.id}
          refName={client.full_name}
          defaultTitle={`Check in with ${client.full_name}`}
          onClose={() => setShowReminder(false)}
        />
      )}

      {/* Header Card */}
      <div className="card overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-green-400 via-teal-500 to-sky-500" />
        <div className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <button onClick={() => navigate('/clients')} className="text-gray-400 hover:text-gray-600 p-1 rounded flex-shrink-0">
              <BackIcon className="w-5 h-5" />
            </button>

            <div className={`w-14 h-14 rounded-2xl ${avatarColor(client.id)} flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow`}>
              {client.full_name?.[0]?.toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{client.full_name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className={`badge ${STATUS_COLORS[client.status]}`}>{STATUS_LABELS[client.status] || client.status}</span>
                <span className="badge bg-indigo-50 text-indigo-700 capitalize">{(client.program_type || 'custom').replace(/_/g, ' ')}</span>
                <span className="text-gray-300">|</span>
                <a href={`tel:${client.phone}`} className="text-sm font-mono text-sky-600 hover:underline">{client.phone}</a>
                <WhatsAppBtn phone={client.phone} leadName={client.full_name} agentName={user?.name} leadId={client.lead_id} size="xs" label="WhatsApp" />
                {client.city && <span className="text-xs text-gray-400">📍 {client.city}</span>}
              </div>
              {client.dietitian_name && (
                <p className="text-xs text-gray-400 mt-1">
                  Dietitian: <span className="font-medium text-gray-600">{client.dietitian_name}</span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setShowCheckinForm(true)} className="btn-primary flex items-center gap-1.5 text-sm">
                <PlusIcon className="w-3.5 h-3.5" /> Log Check-in
              </button>
              <button onClick={() => setShowReminder(true)} className="btn-secondary flex items-center gap-1.5 text-sm" title="Set Reminder">
                🔔 Remind
              </button>
              <button onClick={() => setEditing(!editing)} className="btn-secondary text-sm">
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <StatCard label="Current Weight" value={client.current_weight_kg ? `${client.current_weight_kg} kg` : '—'} icon="⚖️" />
            <StatCard label="Target Weight" value={client.target_weight_kg ? `${client.target_weight_kg} kg` : '—'} icon="🎯" />
            <StatCard label="Total Check-ins" value={checkins.length} icon="📋" />
            <StatCard
              label="Started"
              value={client.start_date ? formatDate(client.start_date) : '—'}
              icon="📅"
            />
          </div>
        </div>
      </div>

      {/* Check-in Form Modal */}
      {showCheckinForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Log Check-in</h2>
              <p className="text-sm text-gray-400">{client.full_name}</p>
            </div>
            <form onSubmit={handleCheckin} className="p-5 space-y-4">
              <div>
                <label className="label">Check-in Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {CHECKIN_TYPES.map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setCheckinForm(f => ({ ...f, checkin_type: t.key }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        checkinForm.checkin_type === t.key
                          ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-200'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-lg">{t.icon}</div>
                      <div className="text-sm font-medium mt-1">{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Current Weight (kg)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 72.5"
                    value={checkinForm.weight_kg}
                    onChange={e => setCheckinForm(f => ({ ...f, weight_kg: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Compliance</label>
                  <select className="select" value={checkinForm.compliance} onChange={e => setCheckinForm(f => ({ ...f, compliance: e.target.value }))}>
                    <option value="">Select</option>
                    {COMPLIANCE_OPTIONS.map(o => (
                      <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Energy Level</label>
                <div className="flex gap-2">
                  {ENERGY_OPTIONS.map(o => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setCheckinForm(f => ({ ...f, energy_level: o }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                        checkinForm.energy_level === o
                          ? 'border-sky-300 bg-sky-50 text-sky-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {o === 'high' ? '⚡' : o === 'moderate' ? '🔋' : o === 'low' ? '🪫' : '😴'} {o.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="How is the client doing? Observations, food compliance, issues..."
                  value={checkinForm.notes}
                  onChange={e => setCheckinForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Next Check-in Date</label>
                <input
                  className="input"
                  type="date"
                  value={checkinForm.next_checkin_date}
                  onChange={e => setCheckinForm(f => ({ ...f, next_checkin_date: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">A reminder will be created automatically</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCheckinForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Check-in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left sidebar */}
        <div className="lg:col-span-4 space-y-4">

          {/* Edit Form */}
          {editing && (
            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 text-sm mb-3">Edit Client</h2>
              <div className="space-y-3">
                <div>
                  <label className="label">Status</label>
                  <select className="select" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {['admin','manager'].includes(user?.role) && (
                  <div>
                    <label className="label">Dietitian</label>
                    <select className="select" value={editForm.dietitian_id} onChange={e => setEditForm(f => ({ ...f, dietitian_id: e.target.value ? parseInt(e.target.value) : null }))}>
                      <option value="">Unassigned</option>
                      {dietitians.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">Program Type</label>
                  <input className="input" value={editForm.program_type} onChange={e => setEditForm(f => ({ ...f, program_type: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Start Date</label>
                    <input className="input" type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input className="input" type="date" value={editForm.end_date || ''} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Current Weight (kg)</label>
                    <input className="input" type="number" step="0.1" value={editForm.current_weight_kg} onChange={e => setEditForm(f => ({ ...f, current_weight_kg: e.target.value ? parseFloat(e.target.value) : null }))} />
                  </div>
                  <div>
                    <label className="label">Target Weight (kg)</label>
                    <input className="input" type="number" step="0.1" value={editForm.target_weight_kg} onChange={e => setEditForm(f => ({ ...f, target_weight_kg: e.target.value ? parseFloat(e.target.value) : null }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input resize-none" rows={3} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {/* Contact Info */}
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 mb-3">
              👤 Contact Info
            </h2>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label="Phone" value={
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`tel:${client.phone}`} className="text-sky-600 font-mono hover:underline">{client.phone}</a>
                  <WhatsAppBtn phone={client.phone} leadName={client.full_name} agentName={user?.name} leadId={client.lead_id} size="xs" showLabel={true} />
                </div>
              } />
              {client.email && <InfoRow label="Email" value={<a href={`mailto:${client.email}`} className="text-sky-600 hover:underline truncate">{client.email}</a>} />}
              {client.gender && <InfoRow label="Gender" value={<span className="capitalize">{client.gender}</span>} />}
              {client.age && <InfoRow label="Age" value={`${client.age} years`} />}
              {client.city && <InfoRow label="Location" value={client.city} />}
            </dl>
          </div>

          {/* Medical Summary */}
          {medical && (
            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 mb-3">
                🩺 Medical Info
              </h2>
              <div className="space-y-2.5">
                {medical.height_cm && medical.weight_kg && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-sky-50 rounded-lg py-2">
                      <div className="text-sm font-bold text-sky-700">{medical.height_cm}</div>
                      <div className="text-xs text-sky-500">cm</div>
                    </div>
                    <div className="bg-sky-50 rounded-lg py-2">
                      <div className="text-sm font-bold text-sky-700">{medical.weight_kg}</div>
                      <div className="text-xs text-sky-500">kg</div>
                    </div>
                    <div className="bg-sky-50 rounded-lg py-2">
                      <div className="text-sm font-bold text-green-700">{(medical.weight_kg / ((medical.height_cm / 100) ** 2)).toFixed(1)}</div>
                      <div className="text-xs text-sky-500">BMI</div>
                    </div>
                  </div>
                )}
                {medical.blood_group && <InfoRow label="Blood Group" value={<span className="badge bg-red-50 text-red-700 text-xs font-bold">{medical.blood_group}</span>} />}
                {medical.dietary_preference && <InfoRow label="Diet" value={<span className="capitalize">{medical.dietary_preference.replace('_', '-')}</span>} />}
                {medical.fitness_level && <InfoRow label="Fitness" value={<span className="capitalize">{medical.fitness_level}</span>} />}
                {(() => {
                  let conds = [];
                  try { conds = JSON.parse(medical.health_conditions || '[]'); } catch {}
                  return conds.length > 0 ? (
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">Conditions</p>
                      <div className="flex flex-wrap gap-1">
                        {conds.map(c => <span key={c} className="badge bg-orange-50 text-orange-700 text-xs capitalize">{c.replace(/_/g, ' ')}</span>)}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
              <Link to={`/leads/${client.lead_id}`} className="text-xs text-sky-600 hover:underline block mt-3">
                View lead profile →
              </Link>
            </div>
          )}

          {/* Client Details */}
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 mb-3">
              📋 Program Details
            </h2>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label="Program" value={<span className="capitalize">{(client.program_type || 'custom').replace(/_/g, ' ')}</span>} />
              <InfoRow label="Start" value={formatDate(client.start_date)} />
              {client.end_date && <InfoRow label="End" value={formatDate(client.end_date)} />}
              {client.notes && (
                <div className="border-t border-gray-100 pt-2.5">
                  <p className="text-xs text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-yellow-50 rounded-lg p-2.5 leading-relaxed">{client.notes}</p>
                </div>
              )}
            </dl>
          </div>

          {/* Delete (admin/manager only) */}
          {['admin', 'manager'].includes(user?.role) && (
            <div className="card p-4">
              <h2 className="font-semibold text-red-600 text-sm mb-2">Danger Zone</h2>
              {deleteConfirm ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">This will permanently remove this client and all check-ins.</p>
                  <div className="flex gap-2">
                    <button onClick={handleDelete} className="btn-danger flex-1 text-sm">Yes, Delete</button>
                    <button onClick={() => setDeleteConfirm(false)} className="btn-secondary text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(true)} className="text-xs text-red-500 hover:text-red-700 hover:underline">
                  Delete this client
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right main area */}
        <div className="lg:col-span-8 space-y-4">

          {/* Tabs */}
          <div className="card overflow-hidden">
            <div className="flex border-b border-gray-100 bg-gray-50 overflow-x-auto">
              {[
                ['overview', '📊 Overview'],
                ['checkins', `📋 Check-ins (${checkins.length})`],
                ['bsl', `🩸 BSL${bslData.readings.length > 0 ? ` (${bslData.readings.length})` : ''}`],
                ['measurements', `📏 Measurements${measurementsData.measurements.length > 0 ? ` (${measurementsData.measurements.length})` : ''}`],
                ['progress', '📈 Weight Progress'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 sm:px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === key ? 'border-sky-600 text-sky-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-5">

              {/* Overview Tab */}
              {tab === 'overview' && (
                <div className="space-y-5">
                  {/* Weight Progress Summary */}
                  {client.current_weight_kg && client.target_weight_kg && (
                    <div className="bg-gradient-to-r from-sky-50 to-teal-50 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Weight Journey</h3>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{client.current_weight_kg}</div>
                          <div className="text-xs text-gray-500">Current (kg)</div>
                        </div>
                        <div className="flex-1">
                          <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner">
                            {(() => {
                              const startW = medical?.weight_kg || client.current_weight_kg;
                              const targetW = client.target_weight_kg;
                              const currentW = client.current_weight_kg;
                              const totalDiff = Math.abs(startW - targetW);
                              const currentDiff = Math.abs(startW - currentW);
                              const pct = totalDiff > 0 ? Math.min(100, (currentDiff / totalDiff) * 100) : 0;
                              return (
                                <div
                                  className="h-full bg-gradient-to-r from-sky-400 to-teal-400 rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              );
                            })()}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-teal-600">{client.target_weight_kg}</div>
                          <div className="text-xs text-gray-500">Target (kg)</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recent Check-ins */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Check-ins</h3>
                    {checkins.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-gray-400 text-sm">No check-ins yet</p>
                        <button onClick={() => setShowCheckinForm(true)} className="text-sm text-sky-600 hover:underline mt-1">
                          Log the first check-in
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {checkins.slice(0, 5).map(c => {
                          const type = CHECKIN_TYPES.find(t => t.key === c.checkin_type);
                          return (
                            <div key={c.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                              <div className={`w-9 h-9 rounded-lg ${type?.color || 'bg-gray-100 text-gray-600'} flex items-center justify-center text-lg flex-shrink-0`}>
                                {type?.icon || '📋'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900">{type?.label || c.checkin_type}</span>
                                  <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {c.weight_kg && <span className="text-xs text-sky-600 font-medium">⚖️ {c.weight_kg}kg</span>}
                                  {c.compliance && <span className="text-xs text-purple-600 capitalize">📊 {c.compliance}</span>}
                                  {c.energy_level && <span className="text-xs text-orange-600 capitalize">⚡ {c.energy_level.replace('_',' ')}</span>}
                                </div>
                                {c.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.notes}</p>}
                                <p className="text-xs text-gray-400 mt-1">by {c.dietitian_name}</p>
                              </div>
                            </div>
                          );
                        })}
                        {checkins.length > 5 && (
                          <button onClick={() => setTab('checkins')} className="text-sm text-sky-600 hover:underline w-full text-center">
                            View all {checkins.length} check-ins →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Check-ins Tab */}
              {tab === 'checkins' && (
                <div className="space-y-3">
                  {checkins.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">📋</div>
                      <p className="text-gray-500 mb-2">No check-ins recorded yet</p>
                      <button onClick={() => setShowCheckinForm(true)} className="btn-primary text-sm">
                        Log First Check-in
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-gray-200" />

                      {checkins.map((c, i) => {
                        const type = CHECKIN_TYPES.find(t => t.key === c.checkin_type);
                        return (
                          <div key={c.id} className="relative flex gap-3 pb-4">
                            <div className={`w-9 h-9 rounded-full ${type?.color || 'bg-gray-100 text-gray-600'} flex items-center justify-center text-lg flex-shrink-0 z-10 border-2 border-white`}>
                              {type?.icon || '📋'}
                            </div>
                            <div className="flex-1 bg-gray-50 rounded-xl p-3">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
                                <span className="text-sm font-medium text-gray-900">{type?.label || c.checkin_type}</span>
                                <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {c.weight_kg && (
                                  <span className="badge bg-sky-50 text-sky-700">⚖️ {c.weight_kg} kg</span>
                                )}
                                {c.compliance && (
                                  <span className={`badge ${
                                    c.compliance === 'excellent' ? 'bg-green-100 text-green-700' :
                                    c.compliance === 'good' ? 'bg-sky-100 text-sky-700' :
                                    c.compliance === 'average' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    📊 {c.compliance}
                                  </span>
                                )}
                                {c.energy_level && (
                                  <span className="badge bg-orange-50 text-orange-700 capitalize">
                                    ⚡ {c.energy_level.replace('_', ' ')}
                                  </span>
                                )}
                              </div>
                              {c.notes && (
                                <p className="text-sm text-gray-600 mt-2 bg-white rounded-lg p-2.5">{c.notes}</p>
                              )}
                              <p className="text-xs text-gray-400 mt-2">by {c.dietitian_name}</p>
                              {c.next_checkin_date && (
                                <p className="text-xs text-sky-600 mt-1">Next check-in: {formatDate(c.next_checkin_date)}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* BSL Monitor Tab */}
              {tab === 'bsl' && (
                <BSLTab clientId={id} bslData={bslData} onRefresh={loadBSL} />
              )}

              {/* Measurements Tab */}
              {tab === 'measurements' && (
                <MeasurementsTab
                  clientId={id}
                  data={measurementsData}
                  onRefresh={loadMeasurements}
                  clientGender={client.gender}
                />
              )}

              {/* Weight Progress Tab */}
              {tab === 'progress' && (
                <div className="space-y-5">
                  {weightData.length < 2 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">📈</div>
                      <p className="text-gray-500 mb-2">Need at least 2 weight entries to show progress</p>
                      <p className="text-xs text-gray-400">Log check-ins with weight to track progress over time</p>
                    </div>
                  ) : (
                    <>
                      {/* Simple SVG weight chart */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Weight Trend</h3>
                        <div className="relative h-48">
                          <svg className="w-full h-full" viewBox={`0 0 ${Math.max(weightData.length * 80, 300)} 200`} preserveAspectRatio="none">
                            {/* Grid lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                              <line key={pct} x1="0" y1={pct * 180 + 10} x2="100%" y2={pct * 180 + 10}
                                stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
                            ))}
                            {/* Target line */}
                            {client.target_weight_kg && (
                              <line
                                x1="0" y1={((weightMax - client.target_weight_kg) / weightRange) * 180 + 10}
                                x2="100%" y2={((weightMax - client.target_weight_kg) / weightRange) * 180 + 10}
                                stroke="#14b8a6" strokeWidth="2" strokeDasharray="6 4"
                              />
                            )}
                            {/* Data line */}
                            <polyline
                              fill="none"
                              stroke="#0ea5e9"
                              strokeWidth="3"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                              points={weightData.map((d, i) => {
                                const x = (i / (weightData.length - 1)) * (Math.max(weightData.length * 80, 300) - 40) + 20;
                                const y = ((weightMax - d.weight) / weightRange) * 180 + 10;
                                return `${x},${y}`;
                              }).join(' ')}
                            />
                            {/* Data points */}
                            {weightData.map((d, i) => {
                              const x = (i / (weightData.length - 1)) * (Math.max(weightData.length * 80, 300) - 40) + 20;
                              const y = ((weightMax - d.weight) / weightRange) * 180 + 10;
                              return (
                                <g key={i}>
                                  <circle cx={x} cy={y} r="5" fill="#0ea5e9" stroke="white" strokeWidth="2" />
                                  <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fill="#374151" fontWeight="600">
                                    {d.weight}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                          {/* Y-axis labels */}
                          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-400 py-1">
                            <span>{weightMax.toFixed(0)}</span>
                            <span>{weightMin.toFixed(0)}</span>
                          </div>
                          {/* Target label */}
                          {client.target_weight_kg && (
                            <div className="absolute right-0 text-xs text-teal-600 font-medium"
                              style={{ top: `${((weightMax - client.target_weight_kg) / weightRange) * 90}%` }}>
                              Target: {client.target_weight_kg}kg
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Weight log table */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Weight Log</h3>
                        <div className="space-y-2">
                          {weightData.slice().reverse().map((d, i) => {
                            const prev = i < weightData.length - 1 ? weightData[weightData.length - 2 - i] : null;
                            const diff = prev ? (d.weight - prev.weight).toFixed(1) : null;
                            return (
                              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-600">{formatDate(d.date)}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-semibold text-gray-900">{d.weight} kg</span>
                                  {diff !== null && (
                                    <span className={`text-xs font-medium ${parseFloat(diff) < 0 ? 'text-green-600' : parseFloat(diff) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                      {parseFloat(diff) > 0 ? '+' : ''}{diff} kg
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <div className="text-lg">{icon}</div>
      <div className="text-sm font-bold text-gray-900 mt-1">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-700">{value}</span>
    </div>
  );
}

// ── BSL Helpers ─────────────────────────────────────────────────────────────

function classifyBSL(value, type) {
  if (value == null) return null;
  if (type === 'fasting') {
    if (value < 100) return 'normal';
    if (value < 126) return 'pre';
    return 'high';
  }
  // pp and random
  if (value < 140) return 'normal';
  if (value < 200) return 'pre';
  return 'high';
}

const BSL_CELL = {
  normal: 'text-green-700 bg-green-50',
  pre:    'text-yellow-700 bg-yellow-50',
  high:   'text-red-700 bg-red-50',
};

function classifyHbA1C(val) {
  if (val < 5.7) return { label: 'Normal',       color: 'bg-green-100 text-green-700',  border: 'border-green-200 bg-green-50' };
  if (val < 6.5) return { label: 'Pre-Diabetic', color: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200 bg-yellow-50' };
  return            { label: 'Diabetic',       color: 'bg-red-100 text-red-700',       border: 'border-red-200 bg-red-50' };
}

function fmtReadingDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function fmtFullDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function groupByMonth(readings) {
  const groups = {};
  readings.forEach(r => {
    const d = new Date(r.reading_date + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = { label, readings: [] };
    groups[key].readings.push(r);
  });
  return Object.keys(groups).sort().reverse().map(k => ({ key: k, ...groups[k] }));
}

// ── BSL Tab ─────────────────────────────────────────────────────────────────

function BSLTab({ clientId, bslData, onRefresh }) {
  const { readings, hba1c } = bslData;
  const today = istToday();

  const [form, setForm] = useState({
    reading_date: today, fasting_bsl: '', pp_bsl: '', random_bsl: '', comment: '',
  });
  const [hba1cForm, setHba1cForm] = useState({ test_date: '', hba1c_value: '', lab_name: '', notes: '' });
  const [showHba1cForm, setShowHba1cForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingHba1c, setSavingHba1c] = useState(false);
  const [error, setError] = useState('');

  const latestHba1c = hba1c.length > 0 ? hba1c[0] : null;
  const monthGroups = useMemo(() => groupByMonth(readings), [readings]);

  // Summary stats
  const fastingVals = readings.filter(r => r.fasting_bsl != null).map(r => r.fasting_bsl);
  const ppVals      = readings.filter(r => r.pp_bsl != null).map(r => r.pp_bsl);
  const avgFasting  = fastingVals.length > 0 ? Math.round(fastingVals.reduce((a, b) => a + b, 0) / fastingVals.length) : null;
  const avgPP       = ppVals.length > 0 ? Math.round(ppVals.reduce((a, b) => a + b, 0) / ppVals.length) : null;
  const normalCount = readings.filter(r => {
    const fOk = r.fasting_bsl == null || r.fasting_bsl < 100;
    const pOk = r.pp_bsl == null || r.pp_bsl < 140;
    return fOk && pOk;
  }).length;
  const pctNormal = readings.length > 0 ? Math.round((normalCount / readings.length) * 100) : null;

  const handleAddReading = async (e) => {
    e.preventDefault();
    if (!form.fasting_bsl && !form.pp_bsl && !form.random_bsl) {
      setError('Enter at least one value — Fasting, Post-Meal, or Random');
      return;
    }
    setSaving(true); setError('');
    try {
      await api.post(`/bsl/client/${clientId}/reading`, {
        reading_date: form.reading_date,
        fasting_bsl:  form.fasting_bsl  ? parseFloat(form.fasting_bsl)  : null,
        pp_bsl:       form.pp_bsl       ? parseFloat(form.pp_bsl)       : null,
        random_bsl:   form.random_bsl   ? parseFloat(form.random_bsl)   : null,
        comment: form.comment || null,
      });
      setForm(f => ({ ...f, fasting_bsl: '', pp_bsl: '', random_bsl: '', comment: '' }));
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save reading');
    } finally { setSaving(false); }
  };

  const handleAddHba1c = async (e) => {
    e.preventDefault();
    setSavingHba1c(true);
    try {
      await api.post(`/bsl/client/${clientId}/hba1c`, {
        test_date:   hba1cForm.test_date,
        hba1c_value: parseFloat(hba1cForm.hba1c_value),
        lab_name:    hba1cForm.lab_name || null,
        notes:       hba1cForm.notes || null,
      });
      setHba1cForm({ test_date: '', hba1c_value: '', lab_name: '', notes: '' });
      setShowHba1cForm(false);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save HbA1C');
    } finally { setSavingHba1c(false); }
  };

  const handleDeleteReading = async (rid) => {
    if (!window.confirm('Delete this reading?')) return;
    try { await api.delete(`/bsl/reading/${rid}`); onRefresh(); } catch {}
  };

  const handleDeleteHba1c = async (hid) => {
    if (!window.confirm('Delete this HbA1C record?')) return;
    try { await api.delete(`/bsl/hba1c/${hid}`); onRefresh(); } catch {}
  };

  return (
    <div className="space-y-5">

      {/* ── HbA1C Banner ── */}
      {latestHba1c ? (() => {
        const info = classifyHbA1C(latestHba1c.hba1c_value);
        return (
          <div className={`rounded-xl p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${info.border}`}>
            <div className="flex items-center gap-5">
              <div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Latest HbA1C</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">{latestHba1c.hba1c_value}%</span>
                  <span className={`badge text-xs font-semibold ${info.color}`}>{info.label}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Tested: {fmtFullDate(latestHba1c.test_date)}
                  {latestHba1c.lab_name && <span> · {latestHba1c.lab_name}</span>}
                </div>
              </div>
              <div className="hidden sm:block text-xs text-gray-400 space-y-0.5 border-l border-gray-200 pl-4">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>Normal: &lt; 5.7%</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"/>Pre-diabetic: 5.7–6.4%</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"/>Diabetic: ≥ 6.5%</div>
              </div>
            </div>
            <button onClick={() => setShowHba1cForm(v => !v)} className="btn-secondary text-xs whitespace-nowrap flex-shrink-0">
              + Update HbA1C
            </button>
          </div>
        );
      })() : (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-500 mb-1.5">No HbA1C result recorded</p>
          <button onClick={() => setShowHba1cForm(v => !v)} className="text-sm text-sky-600 hover:underline font-medium">
            + Add HbA1C Result
          </button>
        </div>
      )}

      {/* ── HbA1C Form ── */}
      {showHba1cForm && (
        <div className="border border-sky-200 bg-sky-50/60 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Add HbA1C Result</h4>
          <form onSubmit={handleAddHba1c} className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Test Date *</label>
              <input className="input" type="date" required value={hba1cForm.test_date}
                onChange={e => setHba1cForm(f => ({ ...f, test_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">HbA1C Value (%) *</label>
              <input className="input" type="number" step="0.1" min="3" max="20" required
                placeholder="e.g. 6.3" value={hba1cForm.hba1c_value}
                onChange={e => setHba1cForm(f => ({ ...f, hba1c_value: e.target.value }))} />
            </div>
            <div>
              <label className="label">Lab Name</label>
              <input className="input" placeholder="e.g. Dr. Lal PathLabs" value={hba1cForm.lab_name}
                onChange={e => setHba1cForm(f => ({ ...f, lab_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input" placeholder="Optional notes" value={hba1cForm.notes}
                onChange={e => setHba1cForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowHba1cForm(false)} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" className="btn-primary text-sm" disabled={savingHba1c}>
                {savingHba1c ? 'Saving...' : 'Save HbA1C'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Summary Stats ── */}
      {readings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-sky-50 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-sky-700">{avgFasting ?? '—'}</div>
            <div className="text-xs text-sky-500 mt-0.5">Avg Fasting</div>
            <div className="text-xs text-sky-400">mg/dL</div>
          </div>
          <div className="bg-violet-50 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-violet-700">{avgPP ?? '—'}</div>
            <div className="text-xs text-violet-500 mt-0.5">Avg Post-Meal</div>
            <div className="text-xs text-violet-400">mg/dL</div>
          </div>
          <div className={`rounded-xl p-3 text-center ${pctNormal >= 70 ? 'bg-green-50' : pctNormal >= 40 ? 'bg-yellow-50' : 'bg-red-50'}`}>
            <div className={`text-xl font-bold ${pctNormal >= 70 ? 'text-green-700' : pctNormal >= 40 ? 'text-yellow-700' : 'text-red-700'}`}>
              {pctNormal ?? '—'}%
            </div>
            <div className="text-xs text-gray-500 mt-0.5">In Normal Range</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-gray-700">{readings.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total Readings</div>
          </div>
        </div>
      )}

      {/* ── Add Reading Form ── */}
      <div className="border border-gray-200 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Add Reading</h4>
        {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">{error}</div>}
        <form onSubmit={handleAddReading}>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Date *</label>
              <input className="input" type="date" required value={form.reading_date}
                onChange={e => setForm(f => ({ ...f, reading_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Fasting <span className="text-gray-300 font-normal">(before meal)</span></label>
              <input className="input" type="number" min="40" max="600" placeholder="mg/dL"
                value={form.fasting_bsl} onChange={e => setForm(f => ({ ...f, fasting_bsl: e.target.value }))} />
            </div>
            <div>
              <label className="label">Post-Meal <span className="text-gray-300 font-normal">(2h after)</span></label>
              <input className="input" type="number" min="40" max="600" placeholder="mg/dL"
                value={form.pp_bsl} onChange={e => setForm(f => ({ ...f, pp_bsl: e.target.value }))} />
            </div>
            <div>
              <label className="label">Random <span className="text-gray-300 font-normal">(spot check)</span></label>
              <input className="input" type="number" min="40" max="600" placeholder="mg/dL"
                value={form.random_bsl} onChange={e => setForm(f => ({ ...f, random_bsl: e.target.value }))} />
            </div>
            <div>
              <label className="label">Comment</label>
              <select className="select" value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}>
                <option value="">Home</option>
                <option value="Lab / Clinic">Lab / Clinic</option>
                <option value="Post-exercise">Post-exercise</option>
                <option value="Cheat meal">Cheat meal</option>
                <option value="Sick day">Sick day</option>
                <option value="Fasting day">Fasting day</option>
                <option value="Stress day">Stress day</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              {saving ? 'Saving...' : '+ Add Reading'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Range Legend ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 px-1">
        <span className="font-medium text-gray-600">Fasting:</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-200 inline-block"/>Normal &lt;100</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-200 inline-block"/>Pre 100–125</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-200 inline-block"/>High ≥126</span>
        <span className="text-gray-300">|</span>
        <span className="font-medium text-gray-600">Post-Meal:</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-200 inline-block"/>&lt;140</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-200 inline-block"/>140–199</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-200 inline-block"/>≥200</span>
      </div>

      {/* ── Monthly Grouped Readings ── */}
      {readings.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-4xl mb-2">🩸</div>
          <p className="text-gray-400 text-sm">No readings yet. Use the form above to add the first one.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {monthGroups.map(group => {
            const mFastV = group.readings.filter(r => r.fasting_bsl != null).map(r => r.fasting_bsl);
            const mPPV   = group.readings.filter(r => r.pp_bsl != null).map(r => r.pp_bsl);
            const mAvgF  = mFastV.length > 0 ? Math.round(mFastV.reduce((a,b) => a+b,0)/mFastV.length) : null;
            const mAvgPP = mPPV.length > 0   ? Math.round(mPPV.reduce((a,b) => a+b,0)/mPPV.length) : null;

            return (
              <div key={group.key}>
                {/* Month Header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{group.label}</span>
                  <div className="h-px flex-1 bg-gray-200" />
                  <div className="flex items-center gap-2 text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    <span>{group.readings.length} readings</span>
                    {mAvgF  && <span>· F: <b className="text-gray-600">{mAvgF}</b></span>}
                    {mAvgPP && <span>· PP: <b className="text-gray-600">{mAvgPP}</b></span>}
                  </div>
                </div>

                {/* Table */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Date</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Fasting</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Post-Meal</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 hidden sm:table-cell">Random</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 hidden sm:table-cell">Comment</th>
                        <th className="px-2 py-2 w-6" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {group.readings.map(r => {
                        const fc = classifyBSL(r.fasting_bsl, 'fasting');
                        const pc = classifyBSL(r.pp_bsl, 'pp');
                        const rc = classifyBSL(r.random_bsl, 'random');
                        const alert = fc === 'high' || pc === 'high' || rc === 'high';
                        return (
                          <tr key={r.id} className={`transition-colors hover:bg-gray-50 ${alert ? 'bg-red-50/40' : ''}`}>
                            <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                              {fmtReadingDate(r.reading_date)}
                              {alert && <span className="ml-1 text-red-400 text-xs">⚠</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {r.fasting_bsl != null
                                ? <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${BSL_CELL[fc]}`}>{r.fasting_bsl}</span>
                                : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {r.pp_bsl != null
                                ? <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${BSL_CELL[pc]}`}>{r.pp_bsl}</span>
                                : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                              {r.random_bsl != null
                                ? <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${BSL_CELL[rc]}`}>{r.random_bsl}</span>
                                : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-400 hidden sm:table-cell">
                              {r.comment || 'Home'}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <button onClick={() => handleDeleteReading(r.id)}
                                className="text-gray-200 hover:text-red-400 transition-colors leading-none" title="Delete">✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── HbA1C History ── */}
      {hba1c.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-700">HbA1C History</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Test Date</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">HbA1C</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 hidden sm:table-cell">Lab</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 hidden sm:table-cell">Notes</th>
                  <th className="px-2 py-2 w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {hba1c.map(h => {
                  const info = classifyHbA1C(h.hba1c_value);
                  return (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{fmtFullDate(h.test_date)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-base font-bold text-gray-900">{h.hba1c_value}%</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`badge text-xs ${info.color}`}>{info.label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 hidden sm:table-cell">{h.lab_name || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 hidden sm:table-cell">{h.notes || '—'}</td>
                      <td className="px-2 py-2.5 text-center">
                        <button onClick={() => handleDeleteHba1c(h.id)}
                          className="text-gray-200 hover:text-red-400 transition-colors leading-none" title="Delete">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Measurement Helpers ──────────────────────────────────────────────────────

function classifyWaist(value, gender) {
  if (value == null) return null;
  if (gender === 'male') {
    if (value < 94)  return 'normal';
    if (value < 102) return 'risk';
    return 'high';
  }
  // female / unknown
  if (value < 80) return 'normal';
  if (value < 88) return 'risk';
  return 'high';
}

function classifyWHR(whr, gender) {
  if (whr == null) return null;
  if (gender === 'male') {
    if (whr < 0.90) return 'normal';
    if (whr < 0.95) return 'risk';
    return 'high';
  }
  // female / unknown
  if (whr < 0.80) return 'normal';
  if (whr < 0.85) return 'risk';
  return 'high';
}

const MEAS_CELL = {
  normal: 'text-green-700 bg-green-50',
  risk:   'text-yellow-700 bg-yellow-50',
  high:   'text-red-700 bg-red-50',
};

function groupMeasurementsByMonth(measurements) {
  const groups = {};
  measurements.forEach(m => {
    const d = new Date(m.measurement_date + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = { label, measurements: [] };
    groups[key].measurements.push(m);
  });
  return Object.keys(groups).sort().reverse().map(k => ({ key: k, ...groups[k] }));
}

// ── Measurements Tab ─────────────────────────────────────────────────────────

function MeasurementsTab({ clientId, data, onRefresh, clientGender }) {
  const { measurements } = data;
  const today = istToday();
  const gender = clientGender || 'female';

  const [form, setForm] = useState({
    measurement_date: today,
    waist_cm: '', hip_cm: '', chest_cm: '', arms_cm: '', thighs_cm: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const monthGroups = useMemo(() => groupMeasurementsByMonth(measurements), [measurements]);

  // Latest values for summary cards
  const latest    = measurements.length > 0 ? measurements[0] : null;
  const latestWaist = latest?.waist_cm ?? null;
  const latestHip   = latest?.hip_cm   ?? null;
  const latestWHR   = (latestWaist && latestHip) ? (latestWaist / latestHip).toFixed(2) : null;

  const handleAdd = async (e) => {
    e.preventDefault();
    const { waist_cm, hip_cm, chest_cm, arms_cm, thighs_cm } = form;
    if (!waist_cm && !hip_cm && !chest_cm && !arms_cm && !thighs_cm) {
      setError('Enter at least one measurement value');
      return;
    }
    setSaving(true); setError('');
    try {
      await api.post(`/measurements/client/${clientId}`, {
        measurement_date: form.measurement_date,
        waist_cm:   waist_cm   ? parseFloat(waist_cm)   : null,
        hip_cm:     hip_cm     ? parseFloat(hip_cm)     : null,
        chest_cm:   chest_cm   ? parseFloat(chest_cm)   : null,
        arms_cm:    arms_cm    ? parseFloat(arms_cm)    : null,
        thighs_cm:  thighs_cm  ? parseFloat(thighs_cm)  : null,
        notes: form.notes || null,
      });
      setForm(f => ({ ...f, waist_cm: '', hip_cm: '', chest_cm: '', arms_cm: '', thighs_cm: '', notes: '' }));
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save measurement');
    } finally { setSaving(false); }
  };

  const handleDelete = async (mid) => {
    if (!window.confirm('Delete this measurement entry?')) return;
    try { await api.delete(`/measurements/${mid}`); onRefresh(); } catch {}
  };

  const waistLabel = gender === 'male' ? 'Men' : 'Women';
  const waistNorm  = gender === 'male' ? '94'  : '80';
  const waistRisk  = gender === 'male' ? '94–101' : '80–87';
  const waistHigh  = gender === 'male' ? '102' : '88';
  const whrNorm    = gender === 'male' ? '0.90' : '0.80';

  return (
    <div className="space-y-5">

      {/* ── Summary Cards ── */}
      {measurements.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {latestWaist != null && (() => {
            const cls = classifyWaist(latestWaist, gender);
            const colors = { normal: 'bg-green-50 text-green-700', risk: 'bg-yellow-50 text-yellow-700', high: 'bg-red-50 text-red-700' };
            return (
              <div className={`rounded-xl p-3 text-center ${colors[cls] || 'bg-gray-50 text-gray-700'}`}>
                <div className="text-xl font-bold">{latestWaist}</div>
                <div className="text-xs font-medium mt-0.5">Waist (cm)</div>
                <div className="text-xs opacity-70 mt-0.5 capitalize">{cls}</div>
              </div>
            );
          })()}
          {latestHip != null && (
            <div className="bg-sky-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-sky-700">{latestHip}</div>
              <div className="text-xs text-sky-500 font-medium mt-0.5">Hip (cm)</div>
            </div>
          )}
          {latestWHR && (() => {
            const cls = classifyWHR(parseFloat(latestWHR), gender);
            const colors = { normal: 'bg-green-50 text-green-700', risk: 'bg-yellow-50 text-yellow-700', high: 'bg-red-50 text-red-700' };
            return (
              <div className={`rounded-xl p-3 text-center ${colors[cls] || 'bg-gray-50 text-gray-700'}`}>
                <div className="text-xl font-bold">{latestWHR}</div>
                <div className="text-xs font-medium mt-0.5">WHR</div>
                <div className="text-xs opacity-70 mt-0.5 capitalize">{cls}</div>
              </div>
            );
          })()}
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-gray-700">{measurements.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total Records</div>
          </div>
        </div>
      )}

      {/* ── Add Form ── */}
      <div className="border border-gray-200 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Add Measurements</h4>
        {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">{error}</div>}
        <form onSubmit={handleAdd}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Date *</label>
              <input className="input" type="date" required value={form.measurement_date}
                onChange={e => setForm(f => ({ ...f, measurement_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Waist (cm)</label>
              <input className="input" type="number" step="0.1" min="40" max="200" placeholder="e.g. 88"
                value={form.waist_cm} onChange={e => setForm(f => ({ ...f, waist_cm: e.target.value }))} />
            </div>
            <div>
              <label className="label">Hip (cm)</label>
              <input className="input" type="number" step="0.1" min="40" max="200" placeholder="e.g. 100"
                value={form.hip_cm} onChange={e => setForm(f => ({ ...f, hip_cm: e.target.value }))} />
            </div>
            <div>
              <label className="label">Chest (cm)</label>
              <input className="input" type="number" step="0.1" min="40" max="200" placeholder="e.g. 90"
                value={form.chest_cm} onChange={e => setForm(f => ({ ...f, chest_cm: e.target.value }))} />
            </div>
            <div>
              <label className="label">Arms (cm)</label>
              <input className="input" type="number" step="0.1" min="10" max="100" placeholder="e.g. 32"
                value={form.arms_cm} onChange={e => setForm(f => ({ ...f, arms_cm: e.target.value }))} />
            </div>
            <div>
              <label className="label">Thighs (cm)</label>
              <input className="input" type="number" step="0.1" min="20" max="120" placeholder="e.g. 58"
                value={form.thighs_cm} onChange={e => setForm(f => ({ ...f, thighs_cm: e.target.value }))} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="label">Notes</label>
              <input className="input" placeholder="Optional notes" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              {saving ? 'Saving...' : '+ Add Record'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Reference Legend ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 px-1">
        <span className="font-medium text-gray-600">Waist ({waistLabel}):</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-200 inline-block"/>Normal &lt;{waistNorm}cm</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-200 inline-block"/>At Risk {waistRisk}cm</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-200 inline-block"/>High ≥{waistHigh}cm</span>
        <span className="text-gray-300">|</span>
        <span className="font-medium text-gray-600">WHR:</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-200 inline-block"/>Normal &lt;{whrNorm}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-200 inline-block"/>High risk if above</span>
      </div>

      {/* ── Monthly Grouped Records ── */}
      {measurements.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-4xl mb-2">📏</div>
          <p className="text-gray-400 text-sm">No measurements yet. Use the form above to add the first record.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {monthGroups.map(group => (
            <div key={group.key}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{group.label}</span>
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{group.measurements.length} records</span>
              </div>

              <div className="border border-gray-100 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Date</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Waist</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Hip</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">WHR</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 hidden sm:table-cell">Chest</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 hidden sm:table-cell">Arms</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 hidden sm:table-cell">Thighs</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 hidden sm:table-cell">Notes</th>
                      <th className="px-2 py-2 w-6" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.measurements.map(m => {
                      const wc  = classifyWaist(m.waist_cm, gender);
                      const whr = (m.waist_cm && m.hip_cm) ? (m.waist_cm / m.hip_cm).toFixed(2) : null;
                      const whrCls = whr ? classifyWHR(parseFloat(whr), gender) : null;
                      return (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                            {fmtReadingDate(m.measurement_date)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {m.waist_cm != null
                              ? <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${MEAS_CELL[wc] || ''}`}>{m.waist_cm}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {m.hip_cm != null
                              ? <span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-sky-50 text-sky-700">{m.hip_cm}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {whr
                              ? <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${MEAS_CELL[whrCls] || ''}`}>{whr}</span>
                              : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                            {m.chest_cm != null ? <span className="text-xs text-gray-700">{m.chest_cm}</span> : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                            {m.arms_cm != null ? <span className="text-xs text-gray-700">{m.arms_cm}</span> : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                            {m.thighs_cm != null ? <span className="text-xs text-gray-700">{m.thighs_cm}</span> : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-400 hidden sm:table-cell">
                            {m.notes || '—'}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <button onClick={() => handleDelete(m.id)}
                              className="text-gray-200 hover:text-red-400 transition-colors leading-none" title="Delete">✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BackIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
}

function PlusIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
}
