import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(form);
      navigate('/cases/new');
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      setError(apiErrors?.[0]?.msg || err.response?.data?.error || 'Registration failed.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-white opacity-50 backdrop-blur-3xl pointer-events-none"></div>
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-accent-gold opacity-10 blur-3xl pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="mb-10 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-950 to-slate-900 shadow-lg font-serif text-xl font-bold text-accent-gold">E</div>
          <span className="font-serif text-2xl font-medium tracking-tight text-ink-900">Estate Assist</span>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
          <h2 className="font-serif text-3xl font-semibold text-ink-900 text-center">Create your account</h2>
          <p className="mt-2 text-sm text-slate-500 text-center">Start organizing a family member's financial affairs.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={form.name} onChange={update('name')} required placeholder="e.g. Priya Sharma" />
            </div>
            <div>
              <label className="label">Email address</label>
              <input className="input" type="email" value={form.email} onChange={update('email')} required placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input className="input" value={form.phone} onChange={update('phone')} placeholder="+91" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" minLength={8} value={form.password} onChange={update('password')} required placeholder="Minimum 8 characters" />
            </div>
            {error && <p className="text-sm font-medium text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base shadow-lg shadow-slate-900/20 mt-2">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Already have an account? <Link to="/login" className="font-medium text-ink-900 hover:text-accent-gold transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
