import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useCase } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';

export default function CaseSetup() {
  const { refreshCases, selectCase, cases } = useCase();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    deceased_name: '', date_of_death: '', death_certificate_number: '', relationship_to_owner: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await client.post('/cases', form);
      await refreshCases();
      selectCase(data.case);
      navigate('/dashboard');
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      setError(apiErrors?.[0]?.msg || err.response?.data?.error || 'Could not create case.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf8f4] px-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-accent-gold/90 font-serif text-sm font-semibold text-white">E</div>
            <span className="font-serif text-lg text-ink-900">Estate Assist</span>
          </div>
          {cases.length > 0 && (
            <button onClick={() => navigate('/dashboard')} className="text-sm text-black/50 hover:underline">Back to dashboard</button>
          )}
        </div>

        <div className="card p-8">
          <h2 className="font-serif text-2xl text-ink-900">Start a new case</h2>
          <p className="mt-1 text-sm text-black/50">
            Tell us a little about your family member so we can set up their financial closure workspace.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Their full name</label>
              <input className="input" value={form.deceased_name} onChange={update('deceased_name')} required placeholder="e.g. Ramesh Sharma" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date of death</label>
                <input className="input" type="date" value={form.date_of_death} onChange={update('date_of_death')} />
              </div>
              <div>
                <label className="label">Your relationship to them</label>
                <input className="input" value={form.relationship_to_owner} onChange={update('relationship_to_owner')} placeholder="e.g. Daughter" />
              </div>
            </div>
            <div>
              <label className="label">Death certificate number (if available)</label>
              <input className="input" value={form.death_certificate_number} onChange={update('death_certificate_number')} placeholder="Optional — you can add this later" />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Creating case…' : 'Create case & continue'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-black/40">
          You can invite other family members for shared access once the case is created.
          {' '}<button onClick={logout} className="underline">Log out</button>
        </p>
      </div>
    </div>
  );
}
