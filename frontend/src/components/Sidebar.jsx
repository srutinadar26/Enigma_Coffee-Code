import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Vault, FileStack, Landmark, ShieldCheck, UserCheck,
  BellRing, Users, Sparkles, ScrollText, ChevronDown, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCase } from '../context/CaseContext';
import { useState } from 'react';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/vault', label: 'Asset Vault', icon: Vault },
  { to: '/documents', label: 'Documents & OCR', icon: FileStack },
  { to: '/loans', label: 'Loans & EMIs', icon: Landmark },
  { to: '/claims', label: 'Insurance Claims', icon: ShieldCheck },
  { to: '/nominees', label: 'Nominee Checker', icon: UserCheck },
  { to: '/reminders', label: 'Reminders', icon: BellRing },
  { to: '/family', label: 'Family Access', icon: Users },
  { to: '/assistant', label: 'AI Assistant', icon: Sparkles },
  { to: '/audit', label: 'Audit Log', icon: ScrollText }
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { cases, activeCase, selectCase } = useCase();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-gradient-to-b from-ink-950 to-ink-900 text-slate-300 shadow-xl border-r border-ink-800/50 relative">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
      <div className="px-6 pt-8 pb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-gold to-yellow-600 shadow-lg font-serif text-lg font-bold text-ink-950">E</div>
          <span className="font-serif text-xl font-medium tracking-tight text-white drop-shadow-sm">Estate Assist</span>
        </div>
      </div>

      <div className="relative mx-4 mb-6 z-10">
        <button
          onClick={() => setSwitcherOpen((s) => !s)}
          className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left text-sm transition-all hover:bg-white/[0.06] hover:border-white/10 shadow-sm backdrop-blur-sm"
        >
          <div className="min-w-0">
            <div className="truncate text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-0.5">Active Case</div>
            <div className="truncate font-medium text-white">{activeCase ? activeCase.deceased_name : 'No case yet'}</div>
          </div>
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        </button>
        {switcherOpen && (
          <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white py-1.5 text-slate-700 shadow-xl backdrop-blur-lg">
            {cases.map((c) => (
              <button
                key={c.id}
                onClick={() => { selectCase(c); setSwitcherOpen(false); }}
                className="block w-full truncate px-4 py-2.5 text-left text-sm transition hover:bg-slate-50 hover:text-ink-900 font-medium"
              >
                {c.deceased_name}
              </button>
            ))}
            <NavLink
              to="/cases/new"
              onClick={() => setSwitcherOpen(false)}
              className="block border-t border-slate-100 mt-1 pt-1 px-4 py-2.5 text-left text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
            >
              + Start new case
            </NavLink>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 relative z-10">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive ? 'bg-white/10 text-white shadow-sm border border-white/5' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
              }`
            }
          >
            <Icon size={18} strokeWidth={2} className={`transition-colors ${
              // eslint-disable-next-line react/prop-types
              window.location.pathname === to ? 'text-accent-gold' : 'text-slate-500 group-hover:text-slate-300'
            }`} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mx-4 mb-6 mt-4 relative z-10">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-3">
              <div className="truncate text-sm font-semibold text-white">{user?.name}</div>
              <div className="truncate text-xs text-slate-400 mt-0.5">{user?.email}</div>
            </div>
            <button onClick={logout} title="Log out" className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white bg-white/5">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
