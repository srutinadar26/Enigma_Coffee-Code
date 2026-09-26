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
    <aside className="flex h-full w-64 shrink-0 flex-col bg-ink-950 text-white/90">
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent-gold/90 font-serif text-sm font-semibold text-ink-950">E</div>
          <span className="font-serif text-lg tracking-tight text-white">Estate Assist</span>
        </div>
      </div>

      <div className="relative mx-4 mb-4">
        <button
          onClick={() => setSwitcherOpen((s) => !s)}
          className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm hover:bg-white/[0.07]"
        >
          <div className="min-w-0">
            <div className="truncate text-white/60 text-xs">Case</div>
            <div className="truncate font-medium">{activeCase ? activeCase.deceased_name : 'No case yet'}</div>
          </div>
          <ChevronDown size={16} className="shrink-0 text-white/50" />
        </button>
        {switcherOpen && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-black/10 bg-white py-1 text-ink-900 shadow-lg">
            {cases.map((c) => (
              <button
                key={c.id}
                onClick={() => { selectCase(c); setSwitcherOpen(false); }}
                className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-black/[0.04]"
              >
                {c.deceased_name}
              </button>
            ))}
            <NavLink
              to="/cases/new"
              onClick={() => setSwitcherOpen(false)}
              className="block border-t border-black/[0.06] px-3 py-2 text-left text-sm font-medium text-brand-600 hover:bg-black/[0.04]"
            >
              + New case
            </NavLink>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                isActive ? 'bg-white/10 text-white font-medium' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'
              }`
            }
          >
            <Icon size={17} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 mb-4 mt-2 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between px-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-white/50">{user?.email}</div>
          </div>
          <button onClick={logout} title="Log out" className="rounded p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
