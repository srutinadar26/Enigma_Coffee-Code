import { useEffect, useState } from 'react';
import { UserPlus, Trash2, X } from 'lucide-react';
import client from '../api/client';
import { useCase } from '../context/CaseContext';

function InviteForm({ caseId, onCreated, onClose }) {
  const [form, setForm] = useState({ email: '', role: 'viewer' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await client.post('/family/invite', { ...form, case_id: caseId });
      onCreated(data.member);
      if (data.note) setNote(data.note);
      else onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send invite.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg text-ink-900">Invite a family member</h3>
          <button onClick={onClose}><X size={18} className="text-black/40" /></button>
        </div>
        {note ? (
          <div>
            <p className="text-sm text-emerald-700">{note}</p>
            <button onClick={onClose} className="btn-primary mt-4 w-full">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Email address</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Access level</label>
              <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="viewer">Viewer — can see everything, can't edit</option>
                <option value="editor">Editor — can add and update records</option>
              </select>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Sending…' : 'Send invite'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Family() {
  const { activeCase } = useCase();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = () => client.get('/family', { params: { case_id: activeCase.id } }).then(({ data }) => setMembers(data.members));

  useEffect(() => { if (activeCase) { setLoading(true); load().finally(() => setLoading(false)); } }, [activeCase]);

  const changeRole = async (m, role) => {
    await client.patch(`/family/${m.id}`, { role }, { params: { case_id: activeCase.id } });
    load();
  };

  const remove = async (m) => {
    if (!confirm(`Remove ${m.invited_email}'s access?`)) return;
    await client.delete(`/family/${m.id}`, { params: { case_id: activeCase.id } });
    setMembers((ms) => ms.filter((x) => x.id !== m.id));
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl text-ink-900">Family Access</h1>
          <p className="text-sm text-black/50">Invite trusted family members to view or help manage this case.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><UserPlus size={16} /> Invite member</button>
      </div>

      <div className="card">
        {loading ? (
          <p className="p-8 text-center text-sm text-black/40">Loading…</p>
        ) : members.length === 0 ? (
          <p className="p-8 text-center text-sm text-black/40">Only you have access to this case right now.</p>
        ) : (
          members.map((m) => (
            <div key={m.id} className="ledger-row flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink-900">{m.user_name || m.invited_email}</div>
                <div className="text-xs text-black/50">{m.invited_email}</div>
              </div>
              <span className={`pill ${m.status === 'active' ? 'pill-done' : 'pill-medium'}`}>{m.status}</span>
              <select value={m.role} onChange={(e) => changeRole(m, e.target.value)} className="input w-28 text-xs">
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button onClick={() => remove(m)} className="rounded p-1.5 text-black/30 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
            </div>
          ))
        )}
      </div>

      {showForm && <InviteForm caseId={activeCase.id} onCreated={(m) => setMembers((ms) => [m, ...ms])} onClose={() => { setShowForm(false); load(); }} />}
    </div>
  );
}
