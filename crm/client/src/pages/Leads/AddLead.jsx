import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const SOURCES = ['walk_in','instagram','facebook','google_ads','referral','website','phone_inquiry','other'];
const STATUSES = ['new','contacted','interested','follow_up','negotiation','converted','lost'];
const INTERESTS = ['weight_loss','muscle_gain','yoga','crossfit','personal_training','group_classes','diet_plan','other'];
const SOURCE_LABELS = { walk_in:'Walk-in', instagram:'Instagram', facebook:'Facebook', google_ads:'Google Ads', referral:'Referral', website:'Website', phone_inquiry:'Phone Inquiry', other:'Other' };
const INTEREST_LABELS = { weight_loss:'Weight Loss', muscle_gain:'Muscle Gain', yoga:'Yoga', crossfit:'CrossFit', personal_training:'Personal Training', group_classes:'Group Classes', diet_plan:'Diet Plan', other:'Other' };

export default function AddLead() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', secondary_phone: '',
    gender: '', age: '', source: '', source_detail: '',
    status: 'new', assigned_to: '', priority: 'warm',
    interested_in: '', notes: '', city: '', locality: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (['admin','manager'].includes(user?.role)) {
      api.get('/users').then(r => {
        const agents = r.data.users.filter(u => ['sales_agent','manager'].includes(u.role));
        setUsers(agents);
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setError('Name is required'); return; }
    if (!form.phone.trim()) { setError('Phone is required'); return; }

    setLoading(true);
    setError('');
    try {
      const payload = { ...form, age: form.age ? parseInt(form.age) : null, assigned_to: form.assigned_to || undefined };
      const res = await api.post('/leads', payload);
      navigate(`/leads/${res.data.lead.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 p-1 rounded">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Add New Lead</h1>
      </div>

      <div className="card p-6">
        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Section title="Personal Info">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Full Name *</label>
                <input className="input" placeholder="Rajesh Kumar" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
              </div>
              <div>
                <label className="label">Phone *</label>
                <input className="input" placeholder="9876543210" value={form.phone} onChange={e => set('phone', e.target.value)} required />
              </div>
              <div>
                <label className="label">Alt Phone</label>
                <input className="input" placeholder="Optional" value={form.secondary_phone} onChange={e => set('secondary_phone', e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="email@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Gender</label>
                <select className="select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Age</label>
                <input className="input" type="number" min="10" max="100" value={form.age} onChange={e => set('age', e.target.value)} />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" placeholder="Mumbai" value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div>
                <label className="label">Locality</label>
                <input className="input" placeholder="Andheri West" value={form.locality} onChange={e => set('locality', e.target.value)} />
              </div>
            </div>
          </Section>

          <Section title="Lead Info">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Source</label>
                <select className="select" value={form.source} onChange={e => set('source', e.target.value)}>
                  <option value="">Select Source</option>
                  {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Source Detail</label>
                <input className="input" placeholder="e.g. Instagram Reel Ad" value={form.source_detail} onChange={e => set('source_detail', e.target.value)} />
              </div>
              <div>
                <label className="label">Interested In</label>
                <select className="select" value={form.interested_in} onChange={e => set('interested_in', e.target.value)}>
                  <option value="">Select Interest</option>
                  {INTERESTS.map(i => <option key={i} value={i}>{INTEREST_LABELS[i]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  <option value="hot">🔥 Hot</option>
                  <option value="warm">🌤 Warm</option>
                  <option value="cold">❄️ Cold</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>)}
                </select>
              </div>
              {['admin','manager'].includes(user?.role) && (
                <div>
                  <label className="label">Assign To</label>
                  <select className="select" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                    <option value="">Auto-assign to me</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={3} placeholder="Any additional details about the lead..." value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          </Section>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">{title}</h3>
      {children}
    </div>
  );
}
