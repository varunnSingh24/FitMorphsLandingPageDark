import React, { useEffect, useState, useCallback } from 'react';
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
const PIPELINE = ['new','contacted','interested','follow_up','negotiation','converted'];

const HEALTH_CONDITIONS = [
  { key: 'type2_diabetes',    label: 'Type 2 Diabetes',       color: 'bg-red-100 text-red-700' },
  { key: 'pre_diabetes',      label: 'Pre-Diabetes',           color: 'bg-orange-100 text-orange-700' },
  { key: 'hypertension',      label: 'Hypertension (High BP)', color: 'bg-red-100 text-red-800' },
  { key: 'heart_disease',     label: 'Heart Disease',          color: 'bg-red-100 text-red-900' },
  { key: 'thyroid',           label: 'Thyroid Issues',         color: 'bg-purple-100 text-purple-700' },
  { key: 'pcod_pcos',         label: 'PCOD / PCOS',            color: 'bg-pink-100 text-pink-700' },
  { key: 'arthritis',         label: 'Arthritis / Joint Pain', color: 'bg-yellow-100 text-yellow-700' },
  { key: 'asthma',            label: 'Asthma',                 color: 'bg-blue-100 text-blue-700' },
  { key: 'obesity',           label: 'Obesity',                color: 'bg-orange-100 text-orange-800' },
  { key: 'high_cholesterol',  label: 'High Cholesterol',       color: 'bg-amber-100 text-amber-700' },
  { key: 'kidney_issues',     label: 'Kidney Issues',          color: 'bg-indigo-100 text-indigo-700' },
  { key: 'fatty_liver',       label: 'Fatty Liver',            color: 'bg-green-100 text-green-700' },
  { key: 'sleep_apnea',       label: 'Sleep Apnea',            color: 'bg-slate-100 text-slate-600' },
  { key: 'anxiety_depression',label: 'Anxiety / Depression',   color: 'bg-violet-100 text-violet-700' },
  { key: 'other',             label: 'Other',                  color: 'bg-gray-100 text-gray-600' },
];

const AVATAR_COLORS = ['bg-blue-500','bg-violet-500','bg-pink-500','bg-teal-500','bg-orange-500','bg-indigo-500'];
const avatarColor = (id) => AVATAR_COLORS[(id || 0) % AVATAR_COLORS.length];
const calcBMI = (w, h) => h && w ? (w / ((h / 100) ** 2)).toFixed(1) : null;
const bmiLabel = (bmi) => {
  if (!bmi) return null;
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-600' };
  if (bmi < 25) return  { label: 'Normal',       color: 'text-green-600' };
  if (bmi < 30) return  { label: 'Overweight',   color: 'text-orange-500' };
  return                { label: 'Obese',         color: 'text-red-600' };
};

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lead, setLead]           = useState(null);
  const [activities, setActivities] = useState([]);
  const [callLogs, setCallLogs]   = useState([]);
  const [medical, setMedical]     = useState(null);
  const [users, setUsers]         = useState([]);
  const [tab, setTab]             = useState('timeline');
  const [modal, setModal]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [editForm, setEditForm]   = useState({});
  const [savingStatus, setSavingStatus] = useState(false);
  const [editMedical, setEditMedical] = useState(false);

  const load = useCallback(async () => {
    try {
      const [leadRes, actRes, callRes, medRes] = await Promise.all([
        api.get(`/leads/${id}`),
        api.get(`/activities/lead/${id}`),
        api.get(`/call-logs/lead/${id}`),
        api.get(`/leads/${id}/medical`),
      ]);
      setLead(leadRes.data.lead);
      setEditForm(leadRes.data.lead);
      setActivities(actRes.data.activities);
      setCallLogs(callRes.data.callLogs);
      setMedical(medRes.data.medical);
    } catch (e) {
      if (e.response?.status === 404) navigate('/leads');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (['admin','manager'].includes(user?.role)) {
      api.get('/users').then(r => setUsers(r.data.users));
    }
  }, [user]);

  const handleStatusChange = async (status) => {
    setSavingStatus(true);
    try { await api.put(`/leads/${id}/status`, { status }); load(); }
    finally { setSavingStatus(false); }
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center text-gray-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"/>
        Loading lead...
      </div>
    </div>
  );
  if (!lead) return null;

  const pipelineIdx = PIPELINE.indexOf(lead.status);

  return (
    <div className="space-y-5 max-w-7xl">

      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {/* gradient bar */}
        <div className="h-2 bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500" />

        <div className="p-5">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate(-1)} className="mt-1 text-gray-400 hover:text-gray-600 p-1 rounded flex-shrink-0">
              <BackIcon className="w-5 h-5"/>
            </button>

            {/* Avatar */}
            <div className={`w-14 h-14 rounded-2xl ${avatarColor(lead.id)} flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow`}>
              {lead.full_name?.[0]?.toUpperCase()}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{lead.full_name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className={`badge ${STATUS_COLORS[lead.status]} font-medium`}>{STATUS_LABELS[lead.status]}</span>
                <span className={`badge ${PRIORITY_COLORS[lead.priority]}`}>{lead.priority === 'hot' ? '🔥' : lead.priority === 'warm' ? '🌤' : '❄️'} {lead.priority}</span>
                {lead.interested_in && <span className="badge bg-indigo-50 text-indigo-700">{INTEREST_LABELS[lead.interested_in]}</span>}
                <span className="text-gray-300">|</span>
                <a href={`tel:${lead.phone}`} className="text-sm font-mono text-blue-600 hover:underline">{lead.phone}</a>
                {lead.city && <span className="text-xs text-gray-400">📍 {lead.city}</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setModal('call')} className="btn-primary flex items-center gap-1.5 text-sm">
                <PhoneIcon className="w-3.5 h-3.5"/> Log Call
              </button>
              <button onClick={() => setModal('note')} className="btn-secondary flex items-center gap-1.5 text-sm">
                <NoteIcon className="w-3.5 h-3.5"/> Note
              </button>
              <button onClick={() => setModal('followup')} className="btn-secondary flex items-center gap-1.5 text-sm">
                <CalendarIcon className="w-3.5 h-3.5"/> Follow-Up
              </button>
            </div>
          </div>

          {/* Pipeline bar */}
          {lead.status !== 'lost' && lead.status !== 'junk' && (
            <div className="mt-5 flex items-center gap-1">
              {PIPELINE.map((s, i) => (
                <React.Fragment key={s}>
                  <button
                    onClick={() => handleStatusChange(s)}
                    disabled={savingStatus}
                    className={`flex-1 text-center text-xs py-1.5 rounded-lg font-medium transition-all ${
                      i <= pipelineIdx
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                  {i < PIPELINE.length - 1 && (
                    <svg className={`w-3 h-3 flex-shrink-0 ${i < pipelineIdx ? 'text-blue-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                    </svg>
                  )}
                </React.Fragment>
              ))}
              <button
                onClick={() => handleStatusChange('lost')}
                className="ml-2 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors"
              >
                Lost
              </button>
            </div>
          )}
          {(lead.status === 'lost' || lead.status === 'junk') && (
            <div className="mt-4 flex items-center gap-2">
              <span className={`badge text-sm px-3 py-1.5 ${lead.status === 'lost' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                {lead.status === 'lost' ? '❌ Lost' : '🗑 Junk'}
              </span>
              <button onClick={() => handleStatusChange('new')} className="text-xs text-blue-600 hover:underline">Reopen as New</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-5">

        {/* Left sidebar */}
        <div className="col-span-4 space-y-4">

          {/* Contact Info */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                <ContactIcon className="w-4 h-4 text-blue-500"/> Contact Info
              </h2>
              <button onClick={() => setEditing(!editing)} className="text-xs text-blue-600 hover:underline">
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editing ? (
              <EditForm form={editForm} setForm={setEditForm} onSave={handleSaveEdit} onCancel={() => setEditing(false)}/>
            ) : (
              <dl className="space-y-2.5">
                <InfoRow icon="📞" label="Phone" value={<a href={`tel:${lead.phone}`} className="text-blue-600 font-mono hover:underline">{lead.phone}</a>}/>
                {lead.secondary_phone && <InfoRow icon="📱" label="Alt Phone" value={<span className="font-mono">{lead.secondary_phone}</span>}/>}
                {lead.email && <InfoRow icon="📧" label="Email" value={<a href={`mailto:${lead.email}`} className="text-blue-600 truncate hover:underline">{lead.email}</a>}/>}
                <div className="border-t border-gray-100 pt-2.5 space-y-2.5">
                  {lead.gender && <InfoRow icon="👤" label="Gender" value={<span className="capitalize">{lead.gender}</span>}/>}
                  {lead.age && <InfoRow icon="🎂" label="Age" value={`${lead.age} years`}/>}
                  {lead.city && <InfoRow icon="📍" label="Location" value={`${lead.locality ? lead.locality + ', ' : ''}${lead.city}`}/>}
                </div>
                <div className="border-t border-gray-100 pt-2.5 space-y-2.5">
                  <InfoRow icon="🔗" label="Source" value={SOURCE_LABELS[lead.source] || lead.source || '—'}/>
                  {lead.source_detail && <InfoRow icon="" label="Detail" value={lead.source_detail}/>}
                </div>
                {lead.notes && (
                  <div className="border-t border-gray-100 pt-2.5">
                    <p className="text-xs text-gray-400 mb-1">Notes</p>
                    <p className="text-sm text-gray-700 bg-yellow-50 rounded-lg p-2.5 leading-relaxed">{lead.notes}</p>
                  </div>
                )}
              </dl>
            )}
          </div>

          {/* Assign */}
          {['admin','manager'].includes(user?.role) && (
            <div className="card p-4">
              <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 mb-3">
                <TeamIcon className="w-4 h-4 text-purple-500"/> Assignment
              </h2>
              <select className="select text-sm" value={lead.assigned_to || ''} onChange={e => handleAssign(e.target.value)}>
                <option value="">Unassigned</option>
                {users.filter(u => ['sales_agent','manager'].includes(u.role)).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              {lead.assigned_name && (
                <p className="text-xs text-gray-500 mt-2">
                  Assigned to <Link to={`/profile/${lead.assigned_to}`} className="font-medium text-blue-600 hover:underline">{lead.assigned_name}</Link>
                </p>
              )}
            </div>
          )}

          {/* Medical Summary Card */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                🩺 Medical Info
              </h2>
              <button
                onClick={() => { setTab('medical'); setEditMedical(!medical); }}
                className="text-xs text-blue-600 hover:underline"
              >
                {medical ? 'Edit' : '+ Add'}
              </button>
            </div>

            {medical ? (() => {
              const mBMI = calcBMI(medical.weight_kg, medical.height_cm);
              const mBMIInfo = bmiLabel(mBMI);
              let conds = [];
              try { conds = JSON.parse(medical.health_conditions || '[]'); } catch {}
              return (
                <div className="space-y-3">
                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {medical.height_cm && (
                      <div className="bg-blue-50 rounded-lg py-2">
                        <div className="text-sm font-bold text-blue-700">{medical.height_cm}</div>
                        <div className="text-xs text-blue-500">cm</div>
                      </div>
                    )}
                    {medical.weight_kg && (
                      <div className="bg-blue-50 rounded-lg py-2">
                        <div className="text-sm font-bold text-blue-700">{medical.weight_kg}</div>
                        <div className="text-xs text-blue-500">kg</div>
                      </div>
                    )}
                    {mBMI && (
                      <div className="bg-blue-50 rounded-lg py-2">
                        <div className={`text-sm font-bold ${mBMIInfo?.color}`}>{mBMI}</div>
                        <div className="text-xs text-blue-500">BMI</div>
                      </div>
                    )}
                  </div>
                  {/* Blood Group */}
                  {medical.blood_group && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-20">Blood Group</span>
                      <span className="badge bg-red-50 text-red-700 text-xs font-bold">{medical.blood_group}</span>
                    </div>
                  )}
                  {/* Conditions */}
                  {conds.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1.5">Conditions</p>
                      <div className="flex flex-wrap gap-1">
                        {conds.slice(0, 4).map(key => {
                          const c = HEALTH_CONDITIONS.find(h => h.key === key);
                          return c ? <span key={key} className={`badge text-xs ${c.color}`}>{c.label}</span> : null;
                        })}
                        {conds.length > 4 && <span className="badge bg-gray-100 text-gray-500 text-xs">+{conds.length - 4} more</span>}
                      </div>
                    </div>
                  )}
                  {/* Lifestyle row */}
                  {(medical.fitness_level || medical.dietary_preference) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {medical.fitness_level && <span className="badge bg-purple-50 text-purple-700">💪 {medical.fitness_level}</span>}
                      {medical.dietary_preference && <span className="badge bg-green-50 text-green-700">🥗 {medical.dietary_preference.replace('_','-')}</span>}
                    </div>
                  )}
                  {/* Doctor clearance */}
                  {medical.doctor_clearance && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-20">Clearance</span>
                      <span className={`text-xs font-medium ${medical.doctor_clearance === 'yes' ? 'text-green-600' : medical.doctor_clearance === 'no' ? 'text-red-600' : 'text-gray-500'}`}>
                        {medical.doctor_clearance === 'yes' ? '✅ Cleared' : medical.doctor_clearance === 'no' ? '❌ Not cleared' : 'Not required'}
                      </span>
                    </div>
                  )}
                  <button onClick={() => setTab('medical')} className="text-xs text-blue-600 hover:underline w-full text-center pt-1">
                    View full medical history →
                  </button>
                </div>
              );
            })() : (
              <div className="text-center py-4">
                <p className="text-xs text-gray-400 mb-2">No medical history recorded</p>
                <button
                  onClick={() => { setTab('medical'); setEditMedical(true); }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Add medical history
                </button>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="card p-4">
            <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 mb-3">
              <ClockIcon className="w-4 h-4 text-gray-400"/> Timeline
            </h2>
            <dl className="space-y-2">
              <InfoRow icon="📅" label="Created" value={formatDate(lead.created_at)}/>
              <InfoRow icon="🔄" label="Updated" value={timeAgo(lead.updated_at)}/>
              <InfoRow icon="📞" label="Total Calls" value={`${callLogs.length} call${callLogs.length !== 1 ? 's' : ''}`}/>
            </dl>
          </div>
        </div>

        {/* Right main area */}
        <div className="col-span-8 card overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50">
            {[
              ['timeline', '🕐 Timeline', activities.length],
              ['calls',    '📞 Calls',    callLogs.length],
              ['medical',  '🩺 Medical History', null],
            ].map(([key, label, count]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === key ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
                {count != null && count > 0 && (
                  <span className="ml-1.5 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-5 max-h-[65vh] overflow-y-auto">
            {tab === 'timeline' && (
              activities.length === 0
                ? <EmptyState icon="📋" text="No activity yet. Log a call or add a note to get started."/>
                : <div className="relative">
                    <div className="absolute left-[19px] top-4 bottom-4 w-px bg-gray-200"/>
                    <div className="space-y-4">
                      {activities.map(a => <TimelineItem key={a.id} activity={a}/>)}
                    </div>
                  </div>
            )}

            {tab === 'calls' && (
              callLogs.length === 0
                ? <EmptyState icon="📞" text="No calls logged yet. Use the 'Log Call' button to record your first call."/>
                : <div className="space-y-3">
                    {callLogs.map(c => <CallLogItem key={c.id} log={c}/>)}
                  </div>
            )}

            {tab === 'medical' && (
              <MedicalHistory
                medical={medical}
                leadId={id}
                editMode={editMedical}
                setEditMode={setEditMedical}
                onSave={() => { setEditMedical(false); load(); }}
              />
            )}
          </div>
        </div>
      </div>

      {modal === 'call'     && <LogCallModal lead={lead} onClose={() => setModal(null)} onSuccess={() => { setModal(null); load(); }}/>}
      {modal === 'note'     && <AddNoteModal lead={lead} onClose={() => setModal(null)} onSuccess={() => { setModal(null); load(); }}/>}
      {modal === 'followup' && <ScheduleFollowUpModal lead={lead} onClose={() => setModal(null)} onSuccess={() => { setModal(null); load(); }}/>}
    </div>
  );
}

// ── Medical History ─────────────────────────────────────────────────────────
function MedicalHistory({ medical, leadId, editMode, setEditMode, onSave }) {
  const emptyForm = {
    height_cm: '', weight_kg: '', blood_group: '', health_conditions: [],
    past_surgeries: '', current_medications: '', allergies: '',
    fitness_level: '', dietary_preference: '', smoking: '', alcohol: '',
    doctor_name: '', doctor_clearance: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
    additional_notes: '',
  };

  const [form, setForm] = useState(() => {
    if (!medical) return emptyForm;
    let conds = [];
    try { conds = JSON.parse(medical.health_conditions || '[]'); } catch {}
    return { ...emptyForm, ...medical, health_conditions: conds };
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!medical) { setForm(emptyForm); return; }
    let conds = [];
    try { conds = JSON.parse(medical.health_conditions || '[]'); } catch {}
    setForm({ ...emptyForm, ...medical, health_conditions: conds });
  }, [medical]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleCondition = (key) =>
    setForm(f => ({
      ...f,
      health_conditions: f.health_conditions.includes(key)
        ? f.health_conditions.filter(c => c !== key)
        : [...f.health_conditions, key],
    }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/leads/${leadId}/medical`, form);
      onSave();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const bmi = calcBMI(form.weight_kg, form.height_cm);
  const bmiInfo = bmiLabel(bmi);
  const conditions = (() => { try { return JSON.parse(medical?.health_conditions || '[]'); } catch { return []; } })();

  if (!editMode) {
    // ── Read-only view ──
    if (!medical) return (
      <div className="text-center py-14">
        <div className="text-5xl mb-3">🩺</div>
        <p className="text-gray-500 font-medium mb-1">No medical history recorded yet</p>
        <p className="text-gray-400 text-sm mb-5">Adding health details helps design a better fitness plan for this lead.</p>
        <button onClick={() => setEditMode(true)} className="btn-primary">+ Add Medical History</button>
      </div>
    );

    const m = medical;
    const mBMI = calcBMI(m.weight_kg, m.height_cm);
    const mBMIInfo = bmiLabel(mBMI);

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            🩺 Medical History
            <span className="text-xs text-gray-400 font-normal">Last updated {formatDate(m.updated_at)}</span>
          </h3>
          <button onClick={() => setEditMode(true)} className="btn-secondary text-xs py-1.5">Edit</button>
        </div>

        {/* Physical stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Height', value: m.height_cm ? `${m.height_cm} cm` : '—' },
            { label: 'Weight', value: m.weight_kg ? `${m.weight_kg} kg` : '—' },
            { label: 'BMI', value: mBMI ? <span className={mBMIInfo?.color}>{mBMI} <span className="text-xs">({mBMIInfo?.label})</span></span> : '—' },
            { label: 'Blood Group', value: m.blood_group || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-blue-700">{value}</div>
              <div className="text-xs text-blue-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Health conditions */}
        {conditions.length > 0 && (
          <MedSection title="🏥 Health Conditions">
            <div className="flex flex-wrap gap-2">
              {conditions.map(key => {
                const c = HEALTH_CONDITIONS.find(h => h.key === key);
                return c ? <span key={key} className={`badge text-xs px-2.5 py-1 ${c.color}`}>{c.label}</span> : null;
              })}
            </div>
          </MedSection>
        )}

        {/* Lifestyle */}
        {(m.fitness_level || m.dietary_preference || m.smoking || m.alcohol) && (
          <MedSection title="🏃 Lifestyle">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {m.fitness_level && <InfoRow icon="💪" label="Fitness Level" value={<span className="capitalize">{m.fitness_level}</span>}/>}
              {m.dietary_preference && <InfoRow icon="🥗" label="Diet" value={m.dietary_preference.replace('_', '-')}/>}
              {m.smoking && <InfoRow icon="🚬" label="Smoking" value={<span className="capitalize">{m.smoking}</span>}/>}
              {m.alcohol && <InfoRow icon="🍷" label="Alcohol" value={<span className="capitalize">{m.alcohol}</span>}/>}
            </div>
          </MedSection>
        )}

        {/* Medical details */}
        {(m.past_surgeries || m.current_medications || m.allergies || m.doctor_name) && (
          <MedSection title="💊 Medical Details">
            <div className="space-y-2.5">
              {m.past_surgeries     && <InfoRow icon="🔪" label="Past Surgeries / Injuries" value={m.past_surgeries}/>}
              {m.current_medications && <InfoRow icon="💊" label="Current Medications" value={m.current_medications}/>}
              {m.allergies          && <InfoRow icon="⚠️" label="Allergies" value={m.allergies}/>}
              {m.doctor_name        && <InfoRow icon="👨‍⚕️" label="Doctor" value={m.doctor_name}/>}
              {m.doctor_clearance   && (
                <InfoRow icon="✅" label="Doctor's Clearance" value={
                  <span className={m.doctor_clearance === 'yes' ? 'text-green-600 font-medium' : m.doctor_clearance === 'no' ? 'text-red-600 font-medium' : 'text-gray-500'}>
                    {m.doctor_clearance === 'yes' ? '✅ Cleared' : m.doctor_clearance === 'no' ? '❌ Not Cleared' : 'Not Required'}
                  </span>
                }/>
              )}
            </div>
          </MedSection>
        )}

        {/* Emergency contact */}
        {m.emergency_contact_name && (
          <MedSection title="🚨 Emergency Contact">
            <div className="space-y-2">
              <InfoRow icon="👤" label="Name" value={m.emergency_contact_name}/>
              {m.emergency_contact_phone && <InfoRow icon="📞" label="Phone" value={<span className="font-mono">{m.emergency_contact_phone}</span>}/>}
              {m.emergency_contact_relation && <InfoRow icon="❤️" label="Relation" value={m.emergency_contact_relation}/>}
            </div>
          </MedSection>
        )}

        {m.additional_notes && (
          <MedSection title="📝 Additional Notes">
            <p className="text-sm text-gray-700 bg-yellow-50 rounded-lg p-3 leading-relaxed">{m.additional_notes}</p>
          </MedSection>
        )}
      </div>
    );
  }

  // ── Edit form ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">🩺 Edit Medical History</h3>
        <button onClick={() => setEditMode(false)} className="text-xs text-gray-400 hover:text-gray-600">✕ Cancel</button>
      </div>

      {/* Physical Stats */}
      <FormSection title="Physical Stats" icon="📊">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Height (cm)</label>
            <input className="input" type="number" placeholder="e.g. 165" value={form.height_cm} onChange={e => set('height_cm', e.target.value)}/>
          </div>
          <div>
            <label className="label">Weight (kg)</label>
            <input className="input" type="number" placeholder="e.g. 72" value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)}/>
          </div>
          <div>
            <label className="label">Blood Group</label>
            <select className="select" value={form.blood_group} onChange={e => set('blood_group', e.target.value)}>
              <option value="">Select</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex items-end pb-0.5">
            {bmi && <div className={`text-sm font-semibold ${bmiInfo?.color}`}>
              BMI: {bmi} <span className="font-normal text-xs">({bmiInfo?.label})</span>
            </div>}
          </div>
        </div>
      </FormSection>

      {/* Health Conditions */}
      <FormSection title="Health Conditions" icon="🏥">
        <div className="grid grid-cols-2 gap-2">
          {HEALTH_CONDITIONS.map(({ key, label, color }) => (
            <label key={key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-xs ${
              form.health_conditions.includes(key) ? `${color} border-current` : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
              <input type="checkbox" className="rounded"
                checked={form.health_conditions.includes(key)}
                onChange={() => toggleCondition(key)}
              />
              {label}
            </label>
          ))}
        </div>
      </FormSection>

      {/* Lifestyle */}
      <FormSection title="Lifestyle" icon="🏃">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Fitness Level</label>
            <select className="select" value={form.fitness_level} onChange={e => set('fitness_level', e.target.value)}>
              <option value="">Select</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="label">Dietary Preference</label>
            <select className="select" value={form.dietary_preference} onChange={e => set('dietary_preference', e.target.value)}>
              <option value="">Select</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="non_vegetarian">Non-Vegetarian</option>
              <option value="eggetarian">Eggetarian</option>
              <option value="jain">Jain</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Smoking</label>
            <select className="select" value={form.smoking} onChange={e => set('smoking', e.target.value)}>
              <option value="">Select</option>
              <option value="no">No</option>
              <option value="yes">Yes</option>
              <option value="occasionally">Occasionally</option>
            </select>
          </div>
          <div>
            <label className="label">Alcohol</label>
            <select className="select" value={form.alcohol} onChange={e => set('alcohol', e.target.value)}>
              <option value="">Select</option>
              <option value="no">No</option>
              <option value="yes">Yes</option>
              <option value="occasionally">Occasionally</option>
            </select>
          </div>
        </div>
      </FormSection>

      {/* Medical Details */}
      <FormSection title="Medical Details" icon="💊">
        <div className="space-y-3">
          <div>
            <label className="label">Past Surgeries / Injuries</label>
            <textarea className="input resize-none" rows={2} placeholder="e.g. Appendix surgery in 2019, knee ligament tear" value={form.past_surgeries} onChange={e => set('past_surgeries', e.target.value)}/>
          </div>
          <div>
            <label className="label">Current Medications</label>
            <textarea className="input resize-none" rows={2} placeholder="e.g. Metformin 500mg, Thyronorm 50mcg" value={form.current_medications} onChange={e => set('current_medications', e.target.value)}/>
          </div>
          <div>
            <label className="label">Known Allergies</label>
            <input className="input" placeholder="e.g. Penicillin, Peanuts, Latex" value={form.allergies} onChange={e => set('allergies', e.target.value)}/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Doctor / Physician Name</label>
              <input className="input" placeholder="Dr. Sharma" value={form.doctor_name} onChange={e => set('doctor_name', e.target.value)}/>
            </div>
            <div>
              <label className="label">Doctor's Clearance for Exercise</label>
              <select className="select" value={form.doctor_clearance} onChange={e => set('doctor_clearance', e.target.value)}>
                <option value="">Select</option>
                <option value="yes">✅ Yes — Cleared</option>
                <option value="no">❌ No — Not Cleared</option>
                <option value="not_required">Not Required</option>
              </select>
            </div>
          </div>
        </div>
      </FormSection>

      {/* Emergency Contact */}
      <FormSection title="Emergency Contact" icon="🚨">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" placeholder="Contact name" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)}/>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" placeholder="9876543210" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)}/>
          </div>
          <div>
            <label className="label">Relation</label>
            <input className="input" placeholder="e.g. Spouse, Parent" value={form.emergency_contact_relation} onChange={e => set('emergency_contact_relation', e.target.value)}/>
          </div>
        </div>
      </FormSection>

      {/* Additional Notes */}
      <FormSection title="Additional Notes" icon="📝">
        <textarea className="input resize-none" rows={3}
          placeholder="Any other relevant health information, fitness goals, doctor's recommendations..."
          value={form.additional_notes} onChange={e => set('additional_notes', e.target.value)}
        />
      </FormSection>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button className="btn-secondary" onClick={() => setEditMode(false)}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : '💾 Save Medical History'}
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function MedSection({ title, children }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function FormSection({ title, icon, children }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100 flex items-center gap-1.5">
        <span>{icon}</span>{title}
      </h4>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex gap-2 items-start">
      {icon && <span className="text-sm mt-0.5 flex-shrink-0 w-5">{icon}</span>}
      <dt className="text-xs text-gray-400 w-28 flex-shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm text-gray-900 flex-1 min-w-0">{value || '—'}</dd>
    </div>
  );
}

function TimelineItem({ activity }) {
  const meta = {
    call:             { icon: '📞', bg: 'bg-blue-100',   dot: 'bg-blue-500' },
    email:            { icon: '📧', bg: 'bg-gray-100',   dot: 'bg-gray-400' },
    whatsapp:         { icon: '💬', bg: 'bg-green-100',  dot: 'bg-green-500' },
    meeting:          { icon: '🤝', bg: 'bg-purple-100', dot: 'bg-purple-500' },
    note:             { icon: '📝', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
    status_change:    { icon: '🔄', bg: 'bg-orange-100', dot: 'bg-orange-400' },
    assignment_change:{ icon: '👤', bg: 'bg-indigo-100', dot: 'bg-indigo-500' },
  }[activity.activity_type] || { icon: '📌', bg: 'bg-gray-100', dot: 'bg-gray-400' };

  return (
    <div className="flex gap-3 relative">
      <div className={`w-9 h-9 rounded-full ${meta.bg} flex items-center justify-center text-base flex-shrink-0 z-10 border-2 border-white`}>
        {meta.icon}
      </div>
      <div className="flex-1 pb-4">
        <div className="bg-white border border-gray-100 rounded-xl px-3.5 py-2.5 shadow-sm">
          <p className="text-sm text-gray-700 leading-relaxed">{activity.description}</p>
          <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5">
            <span className="font-medium text-gray-500">{activity.user_name}</span>
            <span>·</span>
            {formatDateTime(activity.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

function CallLogItem({ log }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${log.call_type === 'inbound' ? 'text-green-700' : 'text-blue-700'}`}>
            {log.call_type === 'inbound' ? '↙ Inbound' : '↗ Outbound'} Call
          </span>
          <span className={`badge text-xs ${OUTCOME_COLORS[log.call_outcome] || 'bg-gray-100 text-gray-600'}`}>
            {log.call_outcome?.replace(/_/g, ' ')}
          </span>
        </div>
        <span className="text-xs text-gray-400 font-mono flex-shrink-0 bg-gray-50 px-2 py-1 rounded-lg">
          ⏱ {formatDuration(log.call_duration_seconds)}
        </span>
      </div>

      {log.summary && (
        <p className="text-sm text-gray-600 mt-2.5 leading-relaxed bg-gray-50 rounded-lg px-3 py-2">{log.summary}</p>
      )}

      {log.follow_up_date && (
        <div className="text-xs text-blue-600 mt-2 flex items-center gap-1">
          📅 Follow-up scheduled: <span className="font-medium">{formatDate(log.follow_up_date)}</span>
        </div>
      )}

      <div className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
        <span className="font-medium text-gray-500">{log.caller_name}</span>
        <span>·</span>
        {formatDateTime(log.created_at)}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="text-center py-14">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-gray-400 text-sm max-w-xs mx-auto">{text}</p>
    </div>
  );
}

const SOURCES_OPTS = ['walk_in','instagram','facebook','google_ads','referral','website','phone_inquiry','other'];
const INTERESTS    = ['weight_loss','muscle_gain','yoga','crossfit','personal_training','group_classes','diet_plan','other'];

function EditForm({ form, setForm, onSave, onCancel }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="space-y-3">
      <div><label className="label">Full Name</label><input className="input" value={form.full_name || ''} onChange={e => set('full_name', e.target.value)}/></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => set('phone', e.target.value)}/></div>
        <div><label className="label">Age</label><input className="input" type="number" value={form.age || ''} onChange={e => set('age', e.target.value)}/></div>
      </div>
      <div><label className="label">Email</label><input className="input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)}/></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">City</label><input className="input" value={form.city || ''} onChange={e => set('city', e.target.value)}/></div>
        <div><label className="label">Locality</label><input className="input" value={form.locality || ''} onChange={e => set('locality', e.target.value)}/></div>
      </div>
      <div>
        <label className="label">Source</label>
        <select className="select" value={form.source || ''} onChange={e => set('source', e.target.value)}>
          <option value="">Select</option>
          {SOURCES_OPTS.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Interested In</label>
        <select className="select" value={form.interested_in || ''} onChange={e => set('interested_in', e.target.value)}>
          <option value="">Select</option>
          {INTERESTS.map(i => <option key={i} value={i}>{INTEREST_LABELS[i]}</option>)}
        </select>
      </div>
      <div><label className="label">Notes</label><textarea className="input resize-none" rows={3} value={form.notes || ''} onChange={e => set('notes', e.target.value)}/></div>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={onSave}>Save</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────
function BackIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>;
}
function PhoneIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>;
}
function NoteIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
}
function CalendarIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>;
}
function ContactIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>;
}
function TeamIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>;
}
function ClockIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
}
