export default function StatCard({ label, value, sublabel, tone = 'default' }) {
  const toneClasses = {
    default: 'text-ink-900',
    good: 'text-emerald-700',
    warn: 'text-amber-700',
    bad: 'text-rose-700'
  };
  return (
    <div className="card px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-black/40">{label}</div>
      <div className={`mt-1 font-serif text-2xl font-semibold font-num ${toneClasses[tone]}`}>{value}</div>
      {sublabel && <div className="mt-0.5 text-xs text-black/45">{sublabel}</div>}
    </div>
  );
}
