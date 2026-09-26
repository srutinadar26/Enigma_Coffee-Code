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
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-ink-900">{activeCase.deceased_name}'s estate</h1>
        <p className="text-sm text-black/50">
          {activeCase.relationship_to_owner ? `Managed as ${activeCase.relationship_to_owner.toLowerCase()}` : 'Estate overview'}
          {activeCase.date_of_death && ` · Passed ${new Date(activeCase.date_of_death).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Net estate value" value={INR(summary.net_estate_value)} sublabel={`${summary.asset_count} assets tracked`} />
        <StatCard label="Total liabilities" value={INR(summary.total_liabilities)} sublabel={`${summary.loan_count} active loans/EMIs`} tone={summary.total_liabilities > 0 ? 'warn' : 'default'} />
        <StatCard label="Pending actions" value={summary.pending_reminders} sublabel="across all categories" tone={summary.pending_reminders > 0 ? 'warn' : 'good'} />
        <StatCard label="Missing nominees" value={summary.missing_nominees} sublabel="need attention" tone={summary.missing_nominees > 0 ? 'bad' : 'good'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-medium text-ink-800">Assets by type</h3>
          {pieData.length === 0 ? (
            <p className="py-10 text-center text-sm text-black/40">No assets added yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => INR(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-black/60">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 lg:col-span-3">
          <h3 className="mb-3 text-sm font-medium text-ink-800">Assets vs liabilities</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => INR(v)} />
              <Bar dataKey="value" fill="#194f9e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-800">
          <AlertTriangle size={16} className="text-amber-600" /> High-priority action items
        </h3>
        {urgent_reminders.length === 0 ? (
          <p className="py-4 text-center text-sm text-black/40">No urgent items right now — nice work.</p>
        ) : (
          <div>
            {urgent_reminders.map((r) => (
              <div key={r.id} className="ledger-row flex items-start justify-between gap-4 py-3">
                <div>
                  <div className="text-sm font-medium text-ink-900">{r.title}</div>
                  <div className="text-xs text-black/50">{r.description}</div>
                </div>
                <span className={`pill pill-${r.priority} shrink-0`}>{r.priority}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-xs text-black/50">
        <div>{summary.documents_processed}/{summary.documents_total} documents processed by OCR</div>
        <div>{summary.discovered_unverified} potentially forgotten assets awaiting verification</div>
        <div>{summary.claim_count} insurance claim(s) in progress</div>
      </div>
    </div>
  );
}
