import { useEffect, useState } from 'react';
import { Plus, Eye, Trash2, X } from 'lucide-react';
import client from '../api/client';
import { useCase } from '../context/CaseContext';

const TYPE_LABELS = { bank: 'Bank account', insurance: 'Insurance policy', epf: 'EPF', ppf: 'PPF', investment: 'Investment', property: 'Property', other: 'Other' };
const STATUS_STYLE = {
  discovered: 'pill-medium', verified: 'pill-done', claim_initiated: 'pill-high', closed: 'pill-low'
};
const INR = (n) => (n ? `₹${Math.round(n).toLocaleString('en-IN')}` : '—');

function AssetForm({ caseId, onCreated, onClose }) {
  const [form, setForm] = useState({
    asset_type: 'bank', institution_name: '', account_number: '', estimated_value: '',
    nominee_name: '', nominee_relationship: '', nominee_status: 'unknown', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await client.post('/assets', { ...form, case_id: caseId, estimated_value: form.estimated_value ? Number(form.estimated_value) : null });
      onCreated(data.asset);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save asset.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg text-ink-900">Add asset to vault</h3>
          <button onClick={onClose}><X size={18} className="text-black/40" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.asset_type} onChange={update('asset_type')}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Institution name</label>
              <input className="input" value={form.institution_name} onChange={update('institution_name')} required placeholder="e.g. HDFC Bank" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Account / policy number</label>
              <input className="input" value={form.account_number} onChange={update('account_number')} placeholder="Encrypted at rest" />
            </div>
            <div>
              <label className="label">Estimated value (₹)</label>
              <input className="input" type="number" value={form.estimated_value} onChange={update('estimated_value')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Nominee name</label>
              <input className="input" value={form.nominee_name} onChange={update('nominee_name')} />
            </div>
            <div>
              <label className="label">Relationship</label>
              <input className="input" value={form.nominee_relationship} onChange={update('nominee_relationship')} />
            </div>
            <div>
              <label className="label">Nominee status</label>
              <select className="input" value={form.nominee_status} onChange={update('nominee_status')}>
                <option value="unknown">Unknown</option>
                <option value="present">Present</option>
                <option value="missing">Missing</option>
                <option value="outdated">Outdated</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={update('notes')} />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Add asset'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Vault() {
  const { activeCase } = useCase();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [revealed, setRevealed] = useState({});
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    client.get('/assets', { params: { case_id: activeCase.id } }).then(({ data }) => setAssets(data.assets)).finally(() => setLoading(false));
  };

  useEffect(() => { if (activeCase) load(); }, [activeCase]);

  const reveal = async (id) => {
    const { data } = await client.get(`/assets/${id}/reveal`, { params: { case_id: activeCase.id } });
    setRevealed((r) => ({ ...r, [id]: data.asset.account_number_full || 'Not on file' }));
  };

  const remove = async (id) => {
    if (!confirm('Remove this asset from the vault?')) return;
    await client.delete(`/assets/${id}`, { params: { case_id: activeCase.id } });
    setAssets((a) => a.filter((x) => x.id !== id));
  };

  const totalValue = assets.reduce((s, a) => s + (a.estimated_value || 0), 0);
  const visible = filter === 'all' ? assets : assets.filter((a) => a.asset_type === filter);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl text-ink-900">Financial Asset Vault</h1>
          <p className="text-sm text-black/50">{assets.length} assets tracked · {INR(totalValue)} total estimated value</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Add asset</button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {['all', ...Object.keys(TYPE_LABELS)].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === t ? 'bg-ink-900 text-white' : 'bg-black/[0.05] text-black/60 hover:bg-black/[0.08]'}`}
          >
            {t === 'all' ? 'All' : TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <p className="p-8 text-center text-sm text-black/40">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-black/40">No assets in this category yet.</p>
        ) : (
          visible.map((a) => (
            <div key={a.id} className="ledger-row flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900">{a.institution_name}</span>
                  <span className={`pill ${STATUS_STYLE[a.status] || 'pill-medium'}`}>{a.status.replace('_', ' ')}</span>
                  {a.source === 'discovery_engine' && <span className="pill pill-medium">auto-discovered</span>}
                </div>
                <div className="mt-0.5 text-xs text-black/50">
                  {TYPE_LABELS[a.asset_type]} · {a.account_number_masked ? (
                    <span className="font-num">{revealed[a.id] || a.account_number_masked}</span>
                  ) : 'No account number on file'}
                  {a.account_number_masked && !revealed[a.id] && (
                    <button onClick={() => reveal(a.id)} className="ml-1.5 inline-flex items-center gap-0.5 text-brand-600 hover:underline">
                      <Eye size={12} /> reveal
                    </button>
                  )}
                </div>
                {a.notes && <div className="mt-1 text-xs italic text-black/40">{a.notes}</div>}
              </div>
              <div className="w-32 shrink-0 text-right">
                <div className="font-num text-sm font-medium text-ink-900">{INR(a.estimated_value)}</div>
                <div className="text-xs text-black/45">
                  Nominee: {a.nominee_status === 'present' ? <span className="text-emerald-700">{a.nominee_name}</span> : <span className="text-rose-600">{a.nominee_status}</span>}
                </div>
              </div>
              <button onClick={() => remove(a.id)} className="shrink-0 rounded p-1.5 text-black/30 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <AssetForm
          caseId={activeCase.id}
          onCreated={(asset) => setAssets((a) => [asset, ...a])}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
