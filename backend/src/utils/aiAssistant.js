const db = require('../config/db');

/**
 * FAQ knowledge base used by the offline fallback assistant, and also fed
 * to the online LLM as grounding context so answers stay on-topic and
 * India-specific even when a live API key is configured.
 */
const KNOWLEDGE_BASE = [
  {
    q: 'How do I claim a bank account after death without a nominee?',
    a: 'If there is no registered nominee, the bank will require a Succession Certificate (for movable assets) or Legal Heir Certificate from a civil court/tehsildar, along with the death certificate, KYC of legal heirs, and an indemnity bond. For balances under the bank\'s threshold (often ₹1-5 lakh depending on the bank), a simplified legal heir process without a court certificate may be available - ask the branch directly.'
  },
  {
    q: 'What documents are needed for an insurance claim after death?',
    a: 'Typically: original policy document, original death certificate, claim form (available from insurer), NEFT/bank details of the claimant, ID and address proof of the claimant/nominee, and for non-nominee claims, a Succession or Legal Heir Certificate. If death occurred within 3 years of policy start, insurers may also request medical records (early claim investigation).'
  },
  {
    q: 'What happens to a home loan or EMI after the borrower dies?',
    a: 'The lender should be notified immediately. If the loan had loan-cover term insurance, the insurer settles the outstanding balance. Otherwise, co-borrowers/guarantors remain liable, or legal heirs may need to continue payments or the bank may initiate recovery against the mortgaged asset. Ask about a temporary moratorium while the process is arranged.'
  },
  {
    q: 'How do I transfer or withdraw EPF after death?',
    a: 'The nominee (or legal heir if no nominee/nomination is invalid) files Form 20 (PF final settlement), Form 10D (pension), and Form 5-IF (EDLI insurance) with the EPFO, along with the death certificate, succession certificate (if no nominee), and bank details. This can usually be done online via the EPFO member portal.'
  },
  {
    q: 'How do I close or transfer a PPF account after death?',
    a: 'The nominee or legal heir applies at the bank/post office branch holding the PPF account with the death certificate, nomination/succession proof, passbook, and a claim form. PPF cannot be transferred to legal heirs\' own PPF account balance-wise beyond their own limit; it is paid out and the account is closed.'
  },
  {
    q: 'What if there is no nominee registered anywhere?',
    a: 'Without nominees, institutions generally require a Succession Certificate (movable assets like bank/FD/shares) or, for larger/immovable estates, Letters of Administration or Probate depending on whether there was a will. This is the single biggest reason estate closure gets delayed - update nominees on all accounts as a preventive step for other family members too.'
  },
  {
    q: 'How long does the whole process usually take?',
    a: 'Simple cases with clear nominees and small balances can close in 2-6 weeks per institution. Cases requiring a Succession Certificate can take 3-6 months via court. Insurance claims are typically settled within 30 days of complete documentation (IRDAI mandate), longer if investigation is triggered.'
  },
  {
    q: 'What should I do first after someone passes away, financially?',
    a: 'Priority order: (1) obtain multiple copies of the death certificate, (2) list every bank/insurer/EPF/loan the person may have had, (3) notify each institution in writing to freeze fraudulent activity and start the claim/transfer process, (4) gather nominee and KYC documents for legal heirs, (5) check for autopay subscriptions to cancel.'
  }
];

function tokenize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Simple TF-IDF-ish cosine similarity over the small FAQ corpus. This has no
 * external dependencies and runs instantly, so the AI Assistant tab always
 * works even with zero internet access or no API key configured.
 */
function offlineAnswer(question, caseContext) {
  const qTokens = tokenize(question);
  if (qTokens.length === 0) {
    return { answer: "Could you rephrase your question? I couldn't find enough to go on.", source: 'offline', matchedFaq: null };
  }

  let best = { score: -1, item: null };
  for (const item of KNOWLEDGE_BASE) {
    const faqTokens = new Set(tokenize(item.q + ' ' + item.a));
    let overlap = 0;
    for (const t of qTokens) if (faqTokens.has(t)) overlap += 1;
    const score = overlap / Math.sqrt(qTokens.length * faqTokens.size);
    if (score > best.score) best = { score, item };
  }

  if (!best.item || best.score < 0.05) {
    return {
      answer:
        "I don't have a confident offline answer for that specific question. Based on general estate-closure practice: contact the relevant institution directly, quoting the death certificate, and ask what their specific nominee/succession requirements are — these vary by bank/insurer. You can also check the case dashboard for open action items.",
      source: 'offline',
      matchedFaq: null
    };
  }

  let answer = best.item.a;
  if (caseContext) {
    answer += `\n\nBased on this case, you currently have ${caseContext.pendingReminders} pending action item(s) and ${caseContext.missingNominees} account(s) with missing/outdated nominee info — worth checking the Reminders and Nominee Checker tabs.`;
  }
  return { answer, source: 'offline', matchedFaq: best.item.q };
}

async function callAnthropic(question, caseContext, history = []) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `You are a helpful assistant embedded in a "Digital Estate & Financial Closure" app used by grieving Indian families to organize a deceased relative's financial affairs (bank accounts, insurance, EPF/PPF, loans, nominees). Be concise, practical, and empathetic. Ground answers in Indian financial/legal process norms. Reference this knowledge base where relevant:\n\n${KNOWLEDGE_BASE.map((k) => `Q: ${k.q}\nA: ${k.a}`).join('\n\n')}\n\nCurrent case snapshot: ${JSON.stringify(caseContext)}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: systemPrompt,
        messages: [...history, { role: 'user', content: question }]
      })
    });
    if (!resp.ok) {
      console.error('Anthropic API error status:', resp.status);
      return null;
    }
    const data = await resp.json();
    const text = (data.content || []).map((b) => b.text || '').join('\n').trim();
    return text || null;
  } catch (err) {
    console.error('Anthropic API call failed, falling back to offline:', err.message);
    return null;
  }
}

/**
 * Builds a small snapshot of the case used to ground both the offline and
 * online assistant so answers are specific rather than generic.
 */
function buildCaseContext(caseId) {
  const pendingReminders = db
    .prepare(`SELECT COUNT(*) c FROM reminders WHERE case_id = ? AND status = 'pending'`)
    .get(caseId).c;
  const missingNominees = db
    .prepare(`SELECT COUNT(*) c FROM assets WHERE case_id = ? AND nominee_status IN ('missing','outdated')`)
    .get(caseId).c;
  const totalAssets = db.prepare(`SELECT COUNT(*) c FROM assets WHERE case_id = ?`).get(caseId).c;
  const activeLoans = db.prepare(`SELECT COUNT(*) c FROM loans WHERE case_id = ? AND status = 'active'`).get(caseId).c;
  return { pendingReminders, missingNominees, totalAssets, activeLoans };
}

async function answerQuestion(caseId, question, history = []) {
  const caseContext = caseId ? buildCaseContext(caseId) : null;
  const online = await callAnthropic(question, caseContext, history);
  if (online) return { answer: online, source: 'anthropic-api' };
  return offlineAnswer(question, caseContext);
}

module.exports = { answerQuestion, KNOWLEDGE_BASE };
