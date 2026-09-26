import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import client from '../api/client';
import { useCase } from '../context/CaseContext';

const CATEGORY_LABELS = {
  bank_statement: 'Bank statement', insurance_policy: 'Insurance policy', epf: 'EPF document',
  ppf: 'PPF document', death_certificate: 'Death certificate', identity: 'Identity document', other: 'Other'
};
const STATUS_STYLE = { pending: 'pill-medium', processing: 'pill-high', done: 'pill-done', failed: 'pill-urgent' };

function DocumentRow({ doc, caseId, onDeleted }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);

  const toggle = async () => {
    if (!expanded && !detail && doc.ocr_status === 'done') {
      const { data } = await client.get(`/documents/${doc.id}`, { params: { case_id: caseId } });
      setDetail(data.document);
    }
    setExpanded((e) => !e);
  };

  const remove = async () => {
    if (!confirm('Delete this document?')) return;
    await client.delete(`/documents/${doc.id}`, { params: { case_id: caseId } });
    onDeleted(doc.id);
  };

  const entities = detail?.extracted_json?.entities;

  return (
    <div className="ledger-row">
      <div className="flex items-center gap-4 px-5 py-4">
        <FileText size={18} className="shrink-0 text-black/30" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink-900">{doc.original_filename}</div>
          <div className="text-xs text-black/45">{CATEGORY_LABELS[doc.doc_category] || 'Uncategorized'} · {new Date(doc.created_at).toLocaleDateString('en-IN')}</div>
        </div>
        <span className={`pill ${STATUS_STYLE[doc.ocr_status]}`}>{doc.ocr_status}</span>
        {doc.ocr_status === 'done' && (
          <button onClick={toggle} className="rounded p-1.5 text-black/40 hover:bg-black/[0.04]">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
        <button onClick={remove} className="rounded p-1.5 text-black/30 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
      </div>
      {expanded && detail && (
        <div className="mx-5 mb-4 rounded-md bg-black/[0.02] p-4 text-xs">
          {entities ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {entities.institution && <Field label="Institution" value={entities.institution} />}
              {entities.account_numbers?.length > 0 && <Field label="Account #(s)" value={entities.account_numbers.join(', ')} />}
              {entities.policy_numbers?.length > 0 && <Field label="Policy #(s)" value={entities.policy_numbers.join(', ')} />}
              {entities.ifsc && <Field label="IFSC" value={entities.ifsc} />}
              {entities.nominee_name && <Field label="Nominee mentioned" value={entities.nominee_name} />}
              {entities.max_amount && <Field label="Largest amount found" value={`₹${entities.max_amount.toLocaleString('en-IN')}`} />}
              {entities.dates?.length > 0 && <Field label="Dates found" value={entities.dates.slice(0, 3).join(', ')} />}
              {entities.uan && <Field label="UAN" value={entities.uan} />}
            </div>
          ) : (
            <p className="text-black/40">No structured data could be extracted from this document.</p>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-black/50">View raw OCR text</summary>
            <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-black/60">{detail.ocr_text || '(no text extracted)'}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-black/40">{label}</div>
      <div className="mt-0.5 font-medium text-ink-900">{value}</div>
    </div>
  );
}

export default function Documents() {
  const { activeCase } = useCase();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef(null);
  const pollRef = useRef(null);

  const load = () => client.get('/documents', { params: { case_id: activeCase.id } }).then(({ data }) => setDocs(data.documents));

  useEffect(() => {
    if (!activeCase) return;
    setLoading(true);
    load().finally(() => setLoading(false));
    pollRef.current = setInterval(() => {
      setDocs((prev) => {
        if (prev.some((d) => d.ocr_status === 'processing' || d.ocr_status === 'pending')) load();
        return prev;
      });
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [activeCase]);

  const onFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('case_id', activeCase.id);
    try {
      await client.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl text-ink-900">Documents & OCR</h1>
          <p className="text-sm text-black/50">Upload statements, policies, and certificates — we'll extract the useful details automatically.</p>
        </div>
        <div>
          <input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" onChange={onFileChange} className="hidden" id="doc-upload" />
          <label htmlFor="doc-upload" className={`btn-primary cursor-pointer ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
            {uploading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Uploading…' : 'Upload document'}
          </label>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <div className="card">
        {loading ? (
          <p className="p-8 text-center text-sm text-black/40">Loading…</p>
        ) : docs.length === 0 ? (
          <div className="p-10 text-center">
            <FileText size={28} className="mx-auto mb-2 text-black/20" />
            <p className="text-sm text-black/40">No documents uploaded yet. Start with a bank statement or an insurance policy PDF.</p>
          </div>
        ) : (
          docs.map((doc) => <DocumentRow key={doc.id} doc={doc} caseId={activeCase.id} onDeleted={(id) => setDocs((d) => d.filter((x) => x.id !== id))} />)
        )}
      </div>
    </div>
  );
}
