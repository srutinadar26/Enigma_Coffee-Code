import { useEffect, useState } from 'react';
import { Plus, Trash2, X, ShieldCheck } from 'lucide-react';
import client from '../api/client';
import { useCase } from '../context/CaseContext';

const LOAN_TYPES = { home: 'Home loan', auto: 'Auto loan', personal: 'Personal loan', credit_card: 'Credit card', education: 'Education loan' };
const INR = (n) => (n ? `₹${Math.round(n).toLocaleString('en-IN')}` : '—');

function LoanForm({ caseId, onCreated, onClose }) {
  const [form, setForm] = useState({ lender_name: '', loan_type: 'home', outstanding_amount: '', emi_amount: '', emi_due_day: '', co_borrower: '', insurance_linked: false, notes: '' });
  const [saving, setSaving] = useState(false);
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await client.post('/loans', {
        ...form, case_id: caseId,
        outstanding_amount: form.outstanding_amount ? Number(form.outstanding_amount) : null,
        emi_amount: form.emi_amount ? Number(form.emi_amount) : null,
        emi_due_day: form.emi_due_day ? Number(form.emi_due_day) : null
      });
      onCreated(data.loan);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg text-ink-900">Add loan / EMI</h3>
          <button onClick={onClose}><X size={18} className="text-black/40" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Lender</label>
              <input className="input" value={form.lender_name} onChange={update('lender_name')} required placeholder="e.g. Axis Bank" />
            </div>
            <div>
              <label className="label">Loan type</label>
              <select className="input" value={form.loan_type} onChange={update('loan_type')}>
                {Object.entries(LOAN_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Outstanding (₹)</label>
              <input className="input" type="number" value={form.outstanding_amount} onChange={update('outstanding_amount')} />
            </div>
            <div>
              <label className="label">EMI amount (₹)</label>
              <input className="input" type="number" value={form.emi_amount} onChange={update('emi_amount')} />
            </div>
            <div>
              <label className="label">EMI due day</label>
              <input className="input" type="number" min={1} max={31} value={form.emi_due_day} onChange={update('emi_due_day')} placeholder="1-31" />
            </div>
          </div>
          <div>
            <label className="label">Co-borrower / guarantor (optional)</label>
            <input className="input" value={form.co_borrower} onChange={update('co_borrower')} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-800">
            <input type="checkbox" checked={form.insurance_linked} onChange={update('insurance_linked')} />
            This loan has loan-cover / credit-life insurance linked
          </label>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={update('notes')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Add loan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Loans() {
  const { activeCase } = useCase();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!activeCase) return;
    setLoading(true);
    client.get('/loans', { params: { case_id: activeCase.id } }).then(({ data }) => setLoans(data.loans)).finally(() => setLoading(false));
  }, [activeCase]);

  const updateStatus = async (loan, status) => {
    const { data } = await client.patch(`/loans/${loan.id}`, { status }, { params: { case_id: activeCase.id } });
    setLoans((ls) => ls.map((l) => (l.id === loan.id ? data.loan : l)));
  };

  const remove = async (id) => {
    if (!confirm('Remove this loan record?')) return;
    await client.delete(`/loans/${id}`, { params: { case_id: activeCase.id } });
    setLoans((ls) => ls.filter((l) => l.id !== id));
  };

  const totalOutstanding = loans.filter((l) => l.status === 'active').reduce((s, l) => s + (l.outstanding_amount || 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl text-ink-900">Loans & EMI Tracker</h1>
          <p className="text-sm text-black/50">{loans.length} loans on record · {INR(totalOutstanding)} active outstanding balance</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Add loan</button>
      </div>

      <div className="card">
        {loading ? (
          <p className="p-8 text-center text-sm text-black/40">Loading…</p>
        ) : loans.length === 0 ? (
          <p className="p-8 text-center text-sm text-black/40">No loans or EMIs recorded yet.</p>
        ) : (
          loans.map((l) => (
            <div key={l.id} className="ledger-row flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900">{l.lender_name}</span>
                  <span className={`pill ${l.status === 'active' ? 'pill-high' : l.status === 'settled' || l.status === 'closed' ? 'pill-done' : 'pill-medium'}`}>{l.status.replace('_', ' ')}</span>
                  {!!l.insurance_linked && <span className="pill pill-done"><ShieldCheck size={11} /> insured</span>}
                </div>
                <div className="mt-0.5 text-xs text-black/50">
                  {LOAN_TYPES[l.loan_type] || l.loan_type}
                  {l.emi_amount ? ` · EMI ₹${Math.round(l.emi_amount).toLocaleString('en-IN')}/mo` : ''}
                  {l.emi_due_day ? ` (due ${l.emi_due_day}${['th','st','nd','rd'][((l.emi_due_day%100)/10|0)===1?0:l.emi_due_day%10] || 'th'} monthly)` : ''}
                  {l.co_borrower ? ` · Co-borrower: ${l.co_borrower}` : ''}
                </div>
                {l.notes && <div className="mt-1 text-xs italic text-black/40">{l.notes}</div>}
              </div>
              <div className="w-32 shrink-0 text-right font-num text-sm font-medium text-ink-900">{INR(l.outstanding_amount)}</div>
              {l.status === 'active' && (
                <select value={l.status} onChange={(e) => updateStatus(l, e.target.value)} className="input w-32 text-xs">
                  <option value="active">Active</option>
                  <option value="under_review">Under review</option>
                  <option value="settled">Settled</option>
                  <option value="closed">Closed</option>
                </select>
              )}
              <button onClick={() => remove(l.id)} className="shrink-0 rounded p-1.5 text-black/30 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
            </div>
          ))
        )}
      </div>

      {showForm && <LoanForm caseId={activeCase.id} onCreated={(l) => setLoans((ls) => [l, ...ls])} onClose={() => setShowForm(false)} />}
    </div>
  );
}
