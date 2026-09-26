import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@estateassist.app');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-ink-950 via-ink-900 to-slate-900 p-12 text-white lg:flex relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] mix-blend-overlay"></div>
        <div className="absolute top-1/4 -right-20 h-96 w-96 rounded-full bg-accent-gold opacity-10 blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-gold to-yellow-600 shadow-lg font-serif text-lg font-bold text-ink-950">E</div>
          <span className="font-serif text-xl font-medium tracking-tight text-white drop-shadow-sm">Estate Assist</span>
        </div>
        <div className="relative z-10 max-w-md">
          <h1 className="font-serif text-4xl font-semibold leading-[1.15] text-white tracking-tight drop-shadow-sm">
            Closing a financial life, <span className="text-accent-gold italic font-light">simplified.</span>
          </h1>
          <p className="mt-6 text-lg text-slate-300 leading-relaxed font-light">
            Organize bank accounts, insurance, EPF, loans and nominee details in one secure place. Know exactly what needs to be done.
          </p>
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
            <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-300">Bank-grade AES-256 Encryption</p>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-slate-50 px-6 lg:w-1/2 relative">
        <div className="absolute inset-0 bg-white opacity-50 backdrop-blur-3xl pointer-events-none"></div>
        <div className="w-full max-w-md relative z-10">
          <div className="lg:hidden mb-10 flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-950 to-slate-900 shadow-lg font-serif text-xl font-bold text-accent-gold">E</div>
            <span className="font-serif text-2xl font-medium tracking-tight text-ink-900">Estate Assist</span>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
            <h2 className="font-serif text-3xl font-semibold text-ink-900 text-center">Welcome back</h2>
            <p className="mt-2 text-sm text-slate-500 text-center">Sign in to securely access your case.</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div>
                <label className="label">Email address</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter your email" />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" />
              </div>
              {error && <p className="text-sm font-medium text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base shadow-lg shadow-slate-900/20 mt-2">
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-4 text-center">
              <p className="text-xs font-medium text-slate-500 mb-1">Demo Credentials</p>
              <div className="text-sm text-slate-700">
                <span className="font-num font-medium bg-white px-2 py-1 rounded shadow-sm border border-slate-200">demo@estateassist.app</span>
                <span className="mx-2 text-slate-400">/</span>
                <span className="font-num font-medium bg-white px-2 py-1 rounded shadow-sm border border-slate-200">Demo@1234</span>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-slate-500">
              Don't have an account? <Link to="/register" className="font-medium text-ink-900 hover:text-accent-gold transition-colors">Create one</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
