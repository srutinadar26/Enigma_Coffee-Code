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
      <div className="hidden w-1/2 flex-col justify-between bg-ink-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent-gold/90 font-serif text-sm font-semibold text-ink-950">E</div>
          <span className="font-serif text-lg">Estate Assist</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-serif text-3xl leading-snug text-white">
            One dashboard for closing and managing a person's financial life after their death.
          </h1>
          <p className="mt-4 text-white/60">
            Organize bank accounts, insurance, EPF/PPF, loans and nominee details in one secure place,
            and know exactly what still needs to be done.
          </p>
        </div>
        <p className="text-xs text-white/40">Bank-grade AES-256 encryption for every sensitive field.</p>
      </div>

      <div className="flex w-full items-center justify-center bg-[#faf8f4] px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <h2 className="font-serif text-2xl text-ink-900">Welcome back</h2>
          <p className="mt-1 text-sm text-black/50">Sign in to continue managing your case.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-700">
            Demo login: <span className="font-num">demo@estateassist.app</span> / <span className="font-num">Demo@1234</span>
            <br />(run <code>npm run seed</code> in the backend first)
          </div>

          <p className="mt-6 text-center text-sm text-black/50">
            Don't have an account? <Link to="/register" className="font-medium text-brand-600 hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
