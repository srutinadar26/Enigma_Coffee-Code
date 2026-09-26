import { useEffect, useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import client from '../api/client';
import { useCase } from '../context/CaseContext';

const STAGES = ['not_started', 'documents_pending', 'submitted', 'under_review', 'approved', 'rejected', 'paid'];
const STAGE_LABELS = {
  not_started: 'Not started', documents_pending: 'Documents pending', submitted: 'Submitted',
  under_review: 'Under review', approved: 'Approved', rejected: 'Rejected', paid: 'Paid'
};
const STAGE_STYLE = {
  not_started: 'pill-low', documents_pending: 'pill-high', submitted: 'pill-medium',
  under_review: 'pill-medium', approved: 'pill-done', rejected: 'pill-urgent', paid: 'pill-done'
};
const INR = (n) => (n ? `₹${Math.round(n).toLocaleString('en-IN')}` : '—');

function ClaimForm({ caseId, onCreated, onClose }) {
  const [form, setForm] = useState({ insurer_name: '', policy_number: '', claim_amount: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await client.post('/insurance-claims', { ...form, case_id: caseId, claim_amount: form.claim_amount ? Number(form.claim_amount) : null });
      onCreated(data.claim);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg text-ink-900">Start a claim</h3>
          <button onClick={onClose}><X size={18} className="text-black/40" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Insurer</label>
            <input className="input" value={form.insurer_name} onChange={update('insurer_name')} required placeholder="e.g. LIC" />
          </div>
          <div>
            <label className="label">Policy number</label>
            <input className="input" value={form.policy_number} onChange={update('policy_number')} placeholder="Encrypted at rest" />
          </div>
          <div>
            <label className="label">Claim amount (₹)</label>
            <input className="input" type="number" value={form.claim_amount} onChange={update('claim_amount')} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={update('notes')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Start claim'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClaimCard({ claim, caseId, onUpdated, onDeleted }) {
  const toggleDoc = async (docName) => {
    const submitted = claim.submitted_documents.includes(docName)
      ? claim.submitted_documents.filter((d) => d !== docName)
      : [...claim.submitted_documents, docName];
    const { data } = await client.patch(`/insurance-claims/${claim.id}`, { submitted_documents: submitted }, { params: { case_id: caseId } });
    onUpdated(data.claim);
  };

  const setStage = async (stage) => {
    const { data } = await client.patch(`/insurance-claims/${claim.id}`, { claim_stage: stage }, { params: { case_id: caseId } });
    onUpdated(data.claim);
  };

  const remove = async () => {
    if (!confirm('Delete this claim?')) return;
    await client.delete(`/insurance-claims/${claim.id}`, { params: { case_id: caseId } });
    onDeleted(claim.id);
  };

  const progress = Math.round((claim.submitted_documents.length / Math.max(claim.required_documents.length, 1)) * 100);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg text-ink-900">{claim.insurer_name}</span>
            <span className={`pill ${STAGE_STYLE[claim.claim_stage]}`}>{STAGE_LABELS[claim.claim_stage]}</span>
          </div>
          <div className="mt-0.5 text-xs text-black/50">Claim amount: <span className="font-num font-medium">{INR(claim.claim_amount)}</span></div>
        </div>
        <div className="flex items-center gap-2">
          <select value={claim.claim_stage} onChange={(e) => setStage(e.target.value)} className="input w-40 text-xs">
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
          <button onClick={remove} className="rounded p-1.5 text-black/30 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-black/50">
          <span>Document checklist</span>
          <span>{claim.submitted_documents.length}/{claim.required_documents.length} complete</span>
        </div>
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {claim.required_documents.map((doc) => (
            <label key={doc} className="flex items-center gap-2 text-sm text-ink-800">
              <input type="checkbox" checked={claim.submitted_documents.includes(doc)} onChange={() => toggleDoc(doc)} />
              {doc}
            </label>
          ))}
        </div>
      </div>
      {claim.notes && <p className="mt-3 text-xs italic text-black/40">{claim.notes}</p>}
    </div>
  );
}

export default function Claims() {
  const { activeCase } = useCase();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!activeCase) return;
    setLoading(true);
    client.get('/insurance-claims', { params: { case_id: activeCase.id } }).then(({ data }) => setClaims(data.claims)).finally(() => setLoading(false));
  }, [activeCase]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl text-ink-900">Insurance Claim Assistant</h1>
          <p className="text-sm text-black/50">Track each claim's stage and required documents.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Start claim</button>
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-black/40">Loading…</p>
      ) : claims.length === 0 ? (
        <div className="card p-10 text-center text-sm text-black/40">No claims started yet.</div>
      ) : (
        <div className="space-y-4">
          {claims.map((c) => (
            <ClaimCard
              key={c.id}
              claim={c}
              caseId={activeCase.id}
              onUpdated={(updated) => setClaims((cs) => cs.map((x) => (x.id === updated.id ? updated : x)))}
              onDeleted={(id) => setClaims((cs) => cs.filter((x) => x.id !== id))}
            />
          ))}
        </div>
      )}

      {showForm && <ClaimForm caseId={activeCase.id} onCreated={(c) => setClaims((cs) => [c, ...cs])} onClose={() => setShowForm(false)} />}
    </div>
  );
}
