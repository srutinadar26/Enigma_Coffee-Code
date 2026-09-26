import { useEffect, useState } from 'react';
import { UserCheck, UserX, HelpCircle } from 'lucide-react';
import client from '../api/client';
import { useCase } from '../context/CaseContext';
import StatCard from '../components/StatCard';

const STATUS_META = {
  present: { icon: UserCheck, style: 'pill-done', label: 'Present' },
  missing: { icon: UserX, style: 'pill-urgent', label: 'Missing' },
  outdated: { icon: UserX, style: 'pill-high', label: 'Outdated' },
  unknown: { icon: HelpCircle, style: 'pill-medium', label: 'Unknown' }
};

export default function Nominees() {
  const { activeCase } = useCase();
  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nominee_name: '', nominee_relationship: '', nominee_status: 'present' });

  const load = () => client.get('/nominees', { params: { case_id: activeCase.id } }).then(({ data }) => { setAssets(data.assets); setSummary(data.summary); });

  useEffect(() => { if (activeCase) { setLoading(true); load().finally(() => setLoading(false)); } }, [activeCase]);

  const startEdit = (a) => {
    setEditing(a.id);
    setForm({ nominee_name: a.nominee_name || '', nominee_relationship: a.nominee_relationship || '', nominee_status: a.nominee_status });
  };

  const save = async (id) => {
    await client.patch(`/nominees/${id}`, form, { params: { case_id: activeCase.id } });
    setEditing(null);
    load();
  };

  if (loading || !summary) return <div className="text-sm text-black/40">Loading…</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-ink-900">Nominee Checker</h1>
        <p className="text-sm text-black/50">Missing or outdated nominees are the single biggest cause of delayed claims — resolve these first.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Present" value={summary.present} tone="good" />
        <StatCard label="Missing" value={summary.missing} tone={summary.missing > 0 ? 'bad' : 'default'} />
        <StatCard label="Outdated" value={summary.outdated} tone={summary.outdated > 0 ? 'warn' : 'default'} />
        <StatCard label="Unknown" value={summary.unknown} />
      </div>

      <div className="mt-6 card">
        {assets.length === 0 ? (
          <p className="p-8 text-center text-sm text-black/40">No assets to check yet — add some in the Asset Vault first.</p>
        ) : (
          assets.map((a) => {
            const meta = STATUS_META[a.nominee_status] || STATUS_META.unknown;
            const Icon = meta.icon;
            return (
              <div key={a.id} className="ledger-row px-5 py-4">
                <div className="flex items-center gap-4">
                  <Icon size={18} className="shrink-0 text-black/30" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink-900">{a.institution_name}</div>
                    <div className="text-xs text-black/50">
                      {a.asset_type} {a.nominee_name && `· Currently: ${a.nominee_name}${a.nominee_relationship ? ` (${a.nominee_relationship})` : ''}`}
                    </div>
                  </div>
                  <span className={`pill ${meta.style}`}>{meta.label}</span>
                  <button onClick={() => startEdit(a)} className="btn-secondary text-xs">Update</button>
                </div>

                {editing === a.id && (
                  <div className="mt-3 grid grid-cols-1 gap-2 rounded-md bg-black/[0.02] p-3 sm:grid-cols-4">
                    <input className="input" placeholder="Nominee name" value={form.nominee_name} onChange={(e) => setForm((f) => ({ ...f, nominee_name: e.target.value }))} />
                    <input className="input" placeholder="Relationship" value={form.nominee_relationship} onChange={(e) => setForm((f) => ({ ...f, nominee_relationship: e.target.value }))} />
                    <select className="input" value={form.nominee_status} onChange={(e) => setForm((f) => ({ ...f, nominee_status: e.target.value }))}>
                      <option value="present">Present</option>
                      <option value="missing">Missing</option>
                      <option value="outdated">Outdated</option>
                      <option value="unknown">Unknown</option>
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => save(a.id)} className="btn-primary flex-1 text-xs">Save</button>
                      <button onClick={() => setEditing(null)} className="btn-secondary text-xs">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
