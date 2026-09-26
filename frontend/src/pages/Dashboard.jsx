import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { AlertTriangle } from 'lucide-react';
import client from '../api/client';
import { useCase } from '../context/CaseContext';
import StatCard from '../components/StatCard';

const INR = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const PIE_COLORS = ['#194f9e', '#c9a24b', '#2b6777', '#a3554a', '#6b7280', '#8a9a5b'];
const ASSET_LABELS = { bank: 'Bank', insurance: 'Insurance', epf: 'EPF', ppf: 'PPF', investment: 'Investments', property: 'Property', other: 'Other' };

export default function Dashboard() {
  const { activeCase } = useCase();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCase) return;
    setLoading(true);
    client.get('/dashboard', { params: { case_id: activeCase.id } })
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  }, [activeCase]);

  if (loading || !data) return <div className="text-sm text-black/40">Loading dashboard…</div>;

  const { summary, charts, urgent_reminders } = data;
  const pieData = Object.entries(charts.assets_by_type).map(([type, value]) => ({ name: ASSET_LABELS[type] || type, value }));
  const barData = [
    { name: 'Assets', value: summary.total_asset_value },
    { name: 'Liabilities', value: summary.total_liabilities },
    { name: 'Net estate', value: summary.net_estate_value }
  ];

  return (
    <div className="pb-10">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink-900 drop-shadow-sm">{activeCase.deceased_name}'s Estate</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {activeCase.relationship_to_owner ? `Managed as ${activeCase.relationship_to_owner.toLowerCase()}` : 'Estate overview'}
            {activeCase.date_of_death && ` · Passed ${new Date(activeCase.date_of_death).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StatCard label="Net Estate Value" value={INR(summary.net_estate_value)} sublabel={`${summary.asset_count} assets tracked`} />
        <StatCard label="Total Liabilities" value={INR(summary.total_liabilities)} sublabel={`${summary.loan_count} active loans/EMIs`} tone={summary.total_liabilities > 0 ? 'warn' : 'default'} />
        <StatCard label="Pending Actions" value={summary.pending_reminders} sublabel="across all categories" tone={summary.pending_reminders > 0 ? 'warn' : 'good'} />
        <StatCard label="Missing Nominees" value={summary.missing_nominees} sublabel="need attention" tone={summary.missing_nominees > 0 ? 'bad' : 'good'} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="card lg:col-span-2">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="font-serif text-lg font-medium text-ink-900">Assets by Category</h3>
          </div>
          <div className="p-6">
            {pieData.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No assets added yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={4}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />)}
                    </Pie>
                    <Tooltip formatter={(v) => INR(v)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card flex flex-col lg:col-span-3">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="font-serif text-lg font-medium text-ink-900">Assets vs Liabilities</h3>
          </div>
          <div className="flex-1 p-6">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B', fontWeight: 500 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip formatter={(v) => INR(v)} cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="value" fill="#0F172A" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 card overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="flex items-center gap-2 font-serif text-lg font-medium text-ink-900">
            <AlertTriangle size={18} className="text-amber-500 drop-shadow-sm" /> High-Priority Action Items
          </h3>
        </div>
        <div>
          {urgent_reminders.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-slate-400">No urgent items right now — nice work.</p>
          ) : (
            <div>
              {urgent_reminders.map((r) => (
                <div key={r.id} className="ledger-row flex items-center justify-between gap-6 px-6 py-4">
                  <div>
                    <div className="text-sm font-semibold text-ink-900">{r.title}</div>
                    <div className="mt-1 text-xs text-slate-500 leading-relaxed max-w-3xl">{r.description}</div>
                  </div>
                  <span className={`pill pill-${r.priority} shrink-0`}>{r.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-8 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span> {summary.documents_processed}/{summary.documents_total} documents processed by OCR</div>
        <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span> {summary.discovered_unverified} assets awaiting verification</div>
        <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> {summary.claim_count} claims in progress</div>
      </div>
    </div>
  );
}
