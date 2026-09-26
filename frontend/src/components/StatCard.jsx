export default function StatCard({ label, value, sublabel, tone = 'default' }) {
  const toneClasses = {
    default: 'text-ink-900 border-l-4 border-l-ink-900',
    good: 'text-emerald-700 border-l-4 border-l-emerald-500',
    warn: 'text-amber-700 border-l-4 border-l-amber-500',
    bad: 'text-rose-700 border-l-4 border-l-rose-500'
  };
  return (
    <div className={`card relative overflow-hidden px-6 py-5 ${toneClasses[tone]}`}>
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-current to-transparent opacity-5 blur-2xl" />
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 font-serif text-3xl font-bold font-num tracking-tight text-ink-900">{value}</div>
      {sublabel && <div className="mt-1.5 text-xs font-medium text-slate-400">{sublabel}</div>}
    </div>
  );
}
