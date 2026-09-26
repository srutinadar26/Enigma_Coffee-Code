import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Check, X } from 'lucide-react';
import client from '../api/client';
import { useCase } from '../context/CaseContext';

const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 };

function ReminderForm({ caseId, onCreated, onClose }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '' });
  const [saving, setSaving] = useState(false);
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await client.post('/reminders', { ...form, case_id: caseId });
      onCreated(data.reminder);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg text-ink-900">Add reminder</h3>
          <button onClick={onClose}><X size={18} className="text-black/40" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={update('title')} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={update('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={update('priority')}>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="label">Due date</label>
              <input className="input" type="date" value={form.due_date} onChange={update('due_date')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Add reminder'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Reminders() {
  const { activeCase } = useCase();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const load = (status = 'pending') => client.get('/reminders', { params: { case_id: activeCase.id, status } }).then(({ data }) => setReminders(data.reminders));

  useEffect(() => {
    if (!activeCase) return;
    setLoading(true);
    load(showDone ? 'done' : 'pending').finally(() => setLoading(false));
  }, [activeCase, showDone]);

  const regenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await client.post('/reminders/generate', {}, { params: { case_id: activeCase.id } });
      setReminders(data.reminders);
    } finally {
      setGenerating(false);
    }
  };

  const complete = async (r) => {
    await client.patch(`/reminders/${r.id}`, { status: 'done' }, { params: { case_id: activeCase.id } });
    setReminders((rs) => rs.filter((x) => x.id !== r.id));
  };

  const dismiss = async (r) => {
    await client.patch(`/reminders/${r.id}`, { status: 'dismissed' }, { params: { case_id: activeCase.id } });
    setReminders((rs) => rs.filter((x) => x.id !== r.id));
  };

  const sorted = [...reminders].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl text-ink-900">Action Reminders</h1>
          <p className="text-sm text-black/50">Auto-generated from assets, loans, and claims, plus anything you add manually.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={regenerate} disabled={generating} className="btn-secondary">
            <RefreshCw size={15} className={generating ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Add reminder</button>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button onClick={() => setShowDone(false)} className={`rounded-full px-3 py-1 text-xs font-medium ${!showDone ? 'bg-ink-900 text-white' : 'bg-black/[0.05] text-black/60'}`}>Pending</button>
        <button onClick={() => setShowDone(true)} className={`rounded-full px-3 py-1 text-xs font-medium ${showDone ? 'bg-ink-900 text-white' : 'bg-black/[0.05] text-black/60'}`}>Completed</button>
      </div>

      <div className="card">
        {loading ? (
          <p className="p-8 text-center text-sm text-black/40">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="p-8 text-center text-sm text-black/40">{showDone ? 'Nothing completed yet.' : 'No pending actions — you\'re all caught up.'}</p>
        ) : (
          sorted.map((r) => (
            <div key={r.id} className="ledger-row flex items-start gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-900">{r.title}</span>
                  <span className={`pill pill-${r.priority}`}>{r.priority}</span>
                  {!!r.auto_generated && <span className="pill pill-low">auto</span>}
                </div>
                {r.description && <p className="mt-0.5 text-xs text-black/50">{r.description}</p>}
                {r.due_date && <p className="mt-0.5 text-xs text-black/40">Due {new Date(r.due_date).toLocaleDateString('en-IN')}</p>}
              </div>
              {!showDone && (
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => complete(r)} title="Mark done" className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50"><Check size={16} /></button>
                  <button onClick={() => dismiss(r)} title="Dismiss" className="rounded p-1.5 text-black/30 hover:bg-black/[0.04]"><X size={16} /></button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showForm && <ReminderForm caseId={activeCase.id} onCreated={(r) => setReminders((rs) => [r, ...rs])} onClose={() => setShowForm(false)} />}
    </div>
  );
}
