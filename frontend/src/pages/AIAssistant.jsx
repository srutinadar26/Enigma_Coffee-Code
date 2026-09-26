import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send } from 'lucide-react';
import client from '../api/client';
import { useCase } from '../context/CaseContext';

const SUGGESTIONS = [
  'What documents do I need for an insurance claim?',
  'How do I claim a bank account with no nominee?',
  'What happens to a home loan after death?',
  'How do I withdraw EPF after a death?'
];

export default function AIAssistant() {
  const { activeCase } = useCase();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "I'm here to help you navigate closing out this estate. Ask me about claims, nominees, loans, or what to do next." }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (question) => {
    const q = question || input;
    if (!q.trim() || sending) return;
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setSending(true);
    try {
      const history = messages.slice(1).map((m) => ({ role: m.role, content: m.content }));
      const { data } = await client.post('/ai/ask', { question: q, history }, { params: { case_id: activeCase.id } });
      setMessages((m) => [...m, { role: 'assistant', content: data.answer, source: data.source }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, I ran into an issue answering that. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4">
        <h1 className="font-serif text-2xl text-ink-900">AI Assistant</h1>
        <p className="text-sm text-black/50">Grounded in Indian financial-closure practice, and aware of {activeCase.deceased_name}'s case.</p>
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border border-black/[0.07] bg-white p-5">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-ink-900 text-white' : 'bg-black/[0.04] text-ink-900'}`}>
                {m.role === 'assistant' && i === 0 && <Sparkles size={14} className="mb-1 text-accent-gold" />}
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-black/[0.04] px-4 py-2.5 text-sm text-black/40">Thinking…</div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-black/60 hover:bg-black/[0.03]">
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2">
        <input className="input flex-1" placeholder="Ask about claims, nominees, loans…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit" disabled={sending} className="btn-primary"><Send size={16} /></button>
      </form>
    </div>
  );
}
