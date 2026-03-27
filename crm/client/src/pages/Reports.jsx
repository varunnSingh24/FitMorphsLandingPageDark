import React, { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import api from '../utils/api';
import { SOURCE_LABELS, STATUS_LABELS } from '../utils/helpers';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#f97316','#14b8a6','#6b7280'];

export default function Reports() {
  const [sourceData, setSourceData] = useState([]);
  const [agentData, setAgentData] = useState([]);
  const [funnelData, setFunnelData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('source');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    try {
      const [srcRes, agentRes, funnelRes] = await Promise.all([
        api.get('/reports/source', { params }),
        api.get('/reports/agent-performance', { params }),
        api.get('/reports/funnel', { params }),
      ]);
      setSourceData(srcRes.data.data);
      setAgentData(agentRes.data.agents);
      setFunnelData(funnelRes.data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  const pieData = sourceData.map(d => ({ name: SOURCE_LABELS[d.source] || d.source, value: d.total }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <div className="flex items-center gap-3">
          <input className="input w-36 text-xs" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" />
          <input className="input w-36 text-xs" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" />
          {(dateFrom || dateTo) && <button className="btn-secondary text-xs" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[['source','Lead Sources'],['agents','Agent Performance'],['funnel','Conversion Funnel']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">Loading reports...</div>
      ) : (
        <>
          {tab === 'source' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="card p-4">
                <h2 className="font-semibold text-gray-900 text-sm mb-4">Leads by Source</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900 text-sm">Source Breakdown</h2>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-th">Source</th>
                      <th className="table-th text-right">Total</th>
                      <th className="table-th text-right">Converted</th>
                      <th className="table-th text-right">Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sourceData.map((d, i) => (
                      <tr key={d.source}>
                        <td className="table-td">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                            {SOURCE_LABELS[d.source] || d.source}
                          </div>
                        </td>
                        <td className="table-td text-right font-medium">{d.total}</td>
                        <td className="table-td text-right text-green-600">{d.converted}</td>
                        <td className="table-td text-right">
                          <span className={`font-medium ${d.conversion_rate > 20 ? 'text-green-600' : d.conversion_rate > 10 ? 'text-orange-600' : 'text-red-600'}`}>
                            {d.conversion_rate || 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'agents' && (
            <div className="space-y-4">
              <div className="card p-4">
                <h2 className="font-semibold text-gray-900 text-sm mb-4">Calls This Month by Agent</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={agentData} margin={{ bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="calls_this_month" name="Calls (Month)" fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="conversions" name="Conversions" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="table-th">Agent</th>
                      <th className="table-th text-right">Total Leads</th>
                      <th className="table-th text-right">Calls (Week)</th>
                      <th className="table-th text-right">Calls (Month)</th>
                      <th className="table-th text-right">Conversions</th>
                      <th className="table-th text-right">Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {agentData.map(a => (
                      <tr key={a.id}>
                        <td className="table-td font-medium">{a.name}</td>
                        <td className="table-td text-right">{a.total_leads}</td>
                        <td className="table-td text-right">{a.calls_this_week}</td>
                        <td className="table-td text-right">{a.calls_this_month}</td>
                        <td className="table-td text-right text-green-600 font-medium">{a.conversions}</td>
                        <td className="table-td text-right">
                          <span className={`font-medium ${(a.conversion_rate||0) > 20 ? 'text-green-600' : (a.conversion_rate||0) > 10 ? 'text-orange-600' : 'text-red-500'}`}>
                            {a.conversion_rate || 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'funnel' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="card p-4">
                <h2 className="font-semibold text-gray-900 text-sm mb-4">Pipeline Funnel</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 80, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} tickFormatter={s => STATUS_LABELS[s]} width={80} />
                    <Tooltip formatter={(v, _, p) => [v, STATUS_LABELS[p.payload.status]]} />
                    <Bar dataKey="count" radius={[0,4,4,0]}>
                      {funnelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900 text-sm">Stage Breakdown</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {funnelData.map((d, i) => (
                    <div key={d.status} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{STATUS_LABELS[d.status]}</span>
                          <span className="text-sm font-medium text-gray-900">{d.count}</span>
                        </div>
                        <div className="mt-1.5 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${d.percentage}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 w-10 text-right">{d.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
