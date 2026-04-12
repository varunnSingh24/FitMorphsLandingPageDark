import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_SOURCES = [
  { key: 'walk_in', label: 'Walk-in' }, { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' }, { key: 'google_ads', label: 'Google Ads' },
  { key: 'referral', label: 'Referral' }, { key: 'website', label: 'Website' },
  { key: 'phone_inquiry', label: 'Phone Inquiry' }, { key: 'other', label: 'Other' },
];
const STATUSES = ['new','contacted','interested','follow_up','negotiation','converted','lost'];
const INTERESTS = ['weight_loss','muscle_gain','yoga','crossfit','personal_training','group_classes','diet_plan','other'];
const INTEREST_LABELS = { weight_loss:'Weight Loss', muscle_gain:'Muscle Gain', yoga:'Yoga', crossfit:'CrossFit', personal_training:'Personal Training', group_classes:'Group Classes', diet_plan:'Diet Plan', other:'Other' };

const HEALTH_CONDITIONS = [
  { key: 'type2_diabetes',    label: 'Type 2 Diabetes' },
  { key: 'pre_diabetes',      label: 'Pre-Diabetes' },
  { key: 'hypertension',      label: 'Hypertension (High BP)' },
  { key: 'heart_disease',     label: 'Heart Disease' },
  { key: 'thyroid',           label: 'Thyroid Issues' },
  { key: 'pcod_pcos',         label: 'PCOD / PCOS' },
  { key: 'arthritis',         label: 'Arthritis / Joint Pain' },
  { key: 'asthma',            label: 'Asthma' },
  { key: 'obesity',           label: 'Obesity' },
  { key: 'high_cholesterol',  label: 'High Cholesterol' },
  { key: 'kidney_issues',     label: 'Kidney Issues' },
  { key: 'fatty_liver',       label: 'Fatty Liver' },
  { key: 'sleep_apnea',       label: 'Sleep Apnea' },
  { key: 'anxiety_depression',label: 'Anxiety / Depression' },
  { key: 'other',             label: 'Other' },
];

const calcBMI = (w, h) => h && w ? (parseFloat(w) / ((parseFloat(h) / 100) ** 2)).toFixed(1) : null;
const bmiLabel = (bmi) => {
  if (!bmi) return null;
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-sky-600' };
  if (bmi < 25)   return { label: 'Normal',       color: 'text-green-600' };
  if (bmi < 30)   return { label: 'Overweight',   color: 'text-orange-500' };
  return                  { label: 'Obese',         color: 'text-red-600' };
};

export default function AddLead() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMedical, setShowMedical] = useState(false);

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', secondary_phone: '',
    gender: '', age: '', source: '', source_detail: '',
    status: 'new', assigned_to: '', priority: 'warm',
    interested_in: '', notes: '', city: '', locality: '',
  });

  const [medical, setMedical] = useState({
    height_cm: '', weight_kg: '', blood_group: '', health_conditions: [],
    past_surgeries: '', current_medications: '', allergies: '',
    fitness_level: '', dietary_preference: '', smoking: '', alcohol: '',
    doctor_name: '', doctor_clearance: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
    additional_notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setMed = (k, v) => setMedical(m => ({ ...m, [k]: v }));
  const toggleCondition = (key) =>
    setMedical(m => ({
      ...m,
      health_conditions: m.health_conditions.includes(key)
        ? m.health_conditions.filter(c => c !== key)
        : [...m.health_conditions, key],
    }));

  useEffect(() => {
    // Fetch dynamic sources from settings
    api.get('/settings/lead_sources').then(r => {
      if (r.data.value && Array.isArray(r.data.value)) setSources(r.data.value);
    }).catch(() => {});

    if (['admin','manager'].includes(user?.role)) {
      api.get('/users').then(r => {
        setUsers(r.data.users.filter(u => ['sales_agent','manager','dietician'].includes(u.role)));
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setError('Name is required'); return; }
    if (!form.phone.trim())     { setError('Phone is required'); return; }

    setLoading(true);
    setError('');
    try {
      const payload = { ...form, age: form.age ? parseInt(form.age) : null, assigned_to: form.assigned_to || undefined };
      const res = await api.post('/leads', payload);
      const leadId = res.data.lead.id;

      // Save medical history if any field filled
      const hasMedical = medical.height_cm || medical.weight_kg || medical.health_conditions.length > 0 ||
        medical.past_surgeries || medical.current_medications || medical.emergency_contact_name;
      if (hasMedical) {
        await api.put(`/leads/${leadId}/medical`, medical);
      }

      navigate(`/leads/${leadId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  const bmi = calcBMI(medical.weight_kg, medical.height_cm);
  const bmiInfo = bmiLabel(bmi);

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Add New Lead</h1>
          <p className="text-sm text-gray-400">Fill in the details to create a new lead</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Section 1: Personal Info ── */}
        <div className="card p-5">
          <SectionHeader number="1" title="Personal Information" icon="👤"/>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="sm:col-span-2">
              <label className="label">Full Name *</label>
              <input className="input" placeholder="e.g. Rajesh Kumar" value={form.full_name} onChange={e => set('full_name', e.target.value)} required/>
            </div>
            <div>
              <label className="label">Phone Number *</label>
              <input className="input" placeholder="9876543210" value={form.phone} onChange={e => set('phone', e.target.value)} required/>
            </div>
            <div>
              <label className="label">Alternate Phone</label>
              <input className="input" placeholder="Optional" value={form.secondary_phone} onChange={e => set('secondary_phone', e.target.value)}/>
            </div>
            <div>
              <label className="label">Email Address</label>
              <input className="input" type="email" placeholder="email@example.com" value={form.email} onChange={e => set('email', e.target.value)}/>
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Age</label>
              <input className="input" type="number" min="10" max="100" placeholder="e.g. 34" value={form.age} onChange={e => set('age', e.target.value)}/>
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" placeholder="e.g. Mumbai" value={form.city} onChange={e => set('city', e.target.value)}/>
            </div>
            <div>
              <label className="label">Locality / Area</label>
              <input className="input" placeholder="e.g. Andheri West" value={form.locality} onChange={e => set('locality', e.target.value)}/>
            </div>
          </div>
        </div>

        {/* ── Section 2: Lead Info ── */}
        <div className="card p-5">
          <SectionHeader number="2" title="Lead Details" icon="📋"/>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="label">Lead Source</label>
              <select className="select" value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="">Select source</option>
                {sources.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Source Detail</label>
              <input className="input" placeholder="e.g. Instagram Reel Ad" value={form.source_detail} onChange={e => set('source_detail', e.target.value)}/>
            </div>
            <div>
              <label className="label">Interested In</label>
              <select className="select" value={form.interested_in} onChange={e => set('interested_in', e.target.value)}>
                <option value="">Select interest</option>
                {INTERESTS.map(i => <option key={i} value={i}>{INTEREST_LABELS[i]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="hot">🔥 Hot — Act now</option>
                <option value="warm">🌤 Warm — Follow up</option>
                <option value="cold">❄️ Cold — Low urgency</option>
              </select>
            </div>
            <div>
              <label className="label">Initial Status</label>
              <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>)}
              </select>
            </div>
            {['admin','manager'].includes(user?.role) && (
              <div>
                <label className="label">Assign To</label>
                <select className="select" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                  <option value="">Assign to me</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={3} placeholder="Any details about this lead — health goals, budget, timing, special requirements..." value={form.notes} onChange={e => set('notes', e.target.value)}/>
            </div>
          </div>
        </div>

        {/* ── Section 3: Medical History (collapsible) ── */}
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowMedical(v => !v)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <SectionNumber number="3"/>
              <div className="text-left">
                <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  🩺 Medical History
                  <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Optional</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Health conditions, physical stats, emergency contact</p>
              </div>
            </div>
            <span className={`text-gray-400 transition-transform ${showMedical ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </span>
          </button>

          {showMedical && (
            <div className="px-5 pb-5 border-t border-gray-100 space-y-5">
              {/* Physical stats */}
              <div className="pt-5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">📊 Physical Stats</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Height (cm)</label>
                    <input className="input" type="number" placeholder="165" value={medical.height_cm} onChange={e => setMed('height_cm', e.target.value)}/>
                  </div>
                  <div>
                    <label className="label">Weight (kg)</label>
                    <input className="input" type="number" placeholder="72" value={medical.weight_kg} onChange={e => setMed('weight_kg', e.target.value)}/>
                  </div>
                  <div>
                    <label className="label">Blood Group</label>
                    <select className="select" value={medical.blood_group} onChange={e => setMed('blood_group', e.target.value)}>
                      <option value="">Select</option>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  {bmi && (
                    <div className="col-span-2 sm:col-span-3">
                      <div className={`text-sm font-medium ${bmiInfo?.color} bg-gray-50 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg`}>
                        <span>BMI: {bmi}</span>
                        <span className="font-normal text-xs">({bmiInfo?.label})</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Health conditions */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🏥 Health Conditions</h4>
                <div className="grid grid-cols-2 gap-2">
                  {HEALTH_CONDITIONS.map(({ key, label }) => (
                    <label key={key} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-xs ${
                      medical.health_conditions.includes(key)
                        ? 'bg-sky-50 border-sky-300 text-sky-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                      <input type="checkbox" className="rounded text-sky-600"
                        checked={medical.health_conditions.includes(key)}
                        onChange={() => toggleCondition(key)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Lifestyle */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🏃 Lifestyle</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Fitness Level</label>
                    <select className="select" value={medical.fitness_level} onChange={e => setMed('fitness_level', e.target.value)}>
                      <option value="">Select</option>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Dietary Preference</label>
                    <select className="select" value={medical.dietary_preference} onChange={e => setMed('dietary_preference', e.target.value)}>
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
                    <select className="select" value={medical.smoking} onChange={e => setMed('smoking', e.target.value)}>
                      <option value="">Select</option>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                      <option value="occasionally">Occasionally</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Alcohol</label>
                    <select className="select" value={medical.alcohol} onChange={e => setMed('alcohol', e.target.value)}>
                      <option value="">Select</option>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                      <option value="occasionally">Occasionally</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Medical details */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">💊 Medical Details</h4>
                <div className="space-y-3">
                  <div>
                    <label className="label">Past Surgeries / Injuries</label>
                    <textarea className="input resize-none" rows={2} placeholder="e.g. Appendix surgery in 2019, ACL tear" value={medical.past_surgeries} onChange={e => setMed('past_surgeries', e.target.value)}/>
                  </div>
                  <div>
                    <label className="label">Current Medications</label>
                    <textarea className="input resize-none" rows={2} placeholder="e.g. Metformin 500mg, Thyronorm 50mcg" value={medical.current_medications} onChange={e => setMed('current_medications', e.target.value)}/>
                  </div>
                  <div>
                    <label className="label">Known Allergies</label>
                    <input className="input" placeholder="e.g. Penicillin, Peanuts" value={medical.allergies} onChange={e => setMed('allergies', e.target.value)}/>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Doctor / Physician</label>
                      <input className="input" placeholder="Dr. Sharma" value={medical.doctor_name} onChange={e => setMed('doctor_name', e.target.value)}/>
                    </div>
                    <div>
                      <label className="label">Doctor's Exercise Clearance</label>
                      <select className="select" value={medical.doctor_clearance} onChange={e => setMed('doctor_clearance', e.target.value)}>
                        <option value="">Select</option>
                        <option value="yes">✅ Yes — Cleared</option>
                        <option value="no">❌ No — Not Cleared</option>
                        <option value="not_required">Not Required</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">🚨 Emergency Contact</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Full Name</label>
                    <input className="input" placeholder="Contact name" value={medical.emergency_contact_name} onChange={e => setMed('emergency_contact_name', e.target.value)}/>
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input className="input" placeholder="9876543210" value={medical.emergency_contact_phone} onChange={e => setMed('emergency_contact_phone', e.target.value)}/>
                  </div>
                  <div>
                    <label className="label">Relation</label>
                    <input className="input" placeholder="e.g. Spouse, Parent" value={medical.emergency_contact_relation} onChange={e => setMed('emergency_contact_relation', e.target.value)}/>
                  </div>
                </div>
              </div>

              {/* Additional notes */}
              <div>
                <label className="label">Additional Health Notes</label>
                <textarea className="input resize-none" rows={2}
                  placeholder="Doctor's recommendations, specific fitness goals, any other relevant health info..."
                  value={medical.additional_notes} onChange={e => setMed('additional_notes', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Submit ── */}
        <div className="flex items-center justify-between pt-1">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
          <button type="submit" className="btn-primary px-8" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Creating...</span>
            ) : '✓ Create Lead'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SectionNumber({ number }) {
  return (
    <div className="w-7 h-7 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
      {number}
    </div>
  );
}

function SectionHeader({ number, title, icon }) {
  return (
    <div className="flex items-center gap-3">
      <SectionNumber number={number}/>
      <h3 className="text-sm font-semibold text-gray-900">{icon} {title}</h3>
    </div>
  );
}
