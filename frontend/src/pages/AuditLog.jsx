import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import client from '../api/client';
import { useCase } from '../context/CaseContext';

const ACTION_LABELS = {
  case_created: 'Case created', asset_created: 'Asset added', asset_updated: 'Asset updated', asset_deleted: 'Asset deleted',
  asset_account_revealed: 'Account number revealed', nominee_updated: 'Nominee updated', document_uploaded: 'Document uploaded',
  document_deleted: 'Document deleted', loan_created: 'Loan added', loan_updated: 'Loan updated', loan_deleted: 'Loan deleted',
  claim_created: 'Claim started', claim_updated: 'Claim updated', claim_deleted: 'Claim deleted',
  reminder_created: 'Reminder added', reminder_updated: 'Reminder updated', reminders_generated: 'Reminders auto-generated',
  family_member_invited: 'Family member invited', family_role_updated: 'Family role changed', family_member_removed: 'Family member removed',
  ai_question_asked: 'Asked AI assistant', will_instruction_added: 'Will/instruction added', will_instructions_viewed: 'Will/instructions viewed',
  user_login: 'Logged in', user_registered: 'Account created'
};

export default function AuditLog() {
  const { activeCase } = useCase();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!activeCase) return;
    setLoading(true);
    client.get('/audit', { params: { case_id: activeCase.id } })
      .then(({ data }) => setLogs(data.logs))
      .catch((err) => setError(err.response?.data?.error || 'Only the case owner can view the audit log.'))
      .finally(() => setLoading(false));
  }, [activeCase]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-ink-900">Audit Log</h1>
        <p className="text-sm text-black/50">Every sensitive action on this case, timestamped, for transparency and security.</p>
      </div>

      <div className="card">
        {loading ? (
          <p className="p-8 text-center text-sm text-black/40">Loading…</p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-black/40">{error}</p>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <ScrollText size={28} className="mx-auto mb-2 text-black/20" />
            <p className="text-sm text-black/40">No activity recorded yet.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="ledger-row flex items-center gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-ink-900">{ACTION_LABELS[log.action] || log.action}</span>
                <span className="ml-2 text-xs text-black/40">by {log.user_name || 'system'}</span>
              </div>
              <div className="shrink-0 text-xs text-black/40 font-num">{new Date(log.created_at).toLocaleString('en-IN')}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
