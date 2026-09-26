const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { KNOWN_BANKS, KNOWN_INSURERS } = require('./extraction');

/**
 * Asset Discovery Engine.
 *
 * Scans OCR'd text of all documents in a case for mentions of financial
 * institutions that do NOT already have a corresponding entry in the
 * Financial Asset Vault. This surfaces "potentially forgotten" assets -
 * e.g. a bank statement that references a second bank as a fund-transfer
 * counterparty, which the family may not have known about.
 *
 * Returns candidate assets it hasn't seen before; callers can choose to
 * auto-insert them as `status = 'discovered'`.
 */
function runDiscovery(caseId) {
  const docs = db
    .prepare(`SELECT id, ocr_text, doc_category FROM documents WHERE case_id = ? AND ocr_text IS NOT NULL`)
    .all(caseId);

  const existingAssets = db
    .prepare(`SELECT institution_name FROM assets WHERE case_id = ?`)
    .all(caseId)
    .map((a) => a.institution_name.toLowerCase());

  const candidates = new Map(); // institution -> { institution, type, mentions, sourceDocIds }
  const allInstitutions = [
    ...KNOWN_BANKS.map((n) => ({ name: n, type: 'bank' })),
    ...KNOWN_INSURERS.map((n) => ({ name: n, type: 'insurance' }))
  ];

  for (const doc of docs) {
    if (!doc.ocr_text) continue;
    const text = doc.ocr_text;
    for (const inst of allInstitutions) {
      const re = new RegExp(`\\b${inst.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(text) && !existingAssets.includes(inst.name.toLowerCase())) {
        const key = inst.name.toLowerCase();
        if (!candidates.has(key)) {
          candidates.set(key, { institution: inst.name, asset_type: inst.type, mentions: 0, sourceDocIds: [] });
        }
        const c = candidates.get(key);
        c.mentions += 1;
        c.sourceDocIds.push(doc.id);
      }
    }
  }

  return Array.from(candidates.values());
}

const insertAsset = db.prepare(`
  INSERT INTO assets (id, case_id, asset_type, institution_name, status, source, notes)
  VALUES (?, ?, ?, ?, 'discovered', 'discovery_engine', ?)
`);

function persistDiscoveries(caseId, candidates) {
  const created = [];
  for (const c of candidates) {
    const id = uuidv4();
    insertAsset.run(
      id,
      caseId,
      c.asset_type,
      c.institution,
      `Auto-discovered from ${c.mentions} document mention(s). Verify before relying on this.`
    );
    created.push({ id, ...c });
  }
  return created;
}

/**
 * Priority scoring for reminders/actions. Combines urgency signals:
 * overdue EMIs, missing nominees, unclaimed insurance, stale discovered assets.
 * Returns a score 0-100 and a bucket (low/medium/high/urgent).
 */
function scorePriority({ type, daysUntilDue, financialImpact = 0, isMissingNominee = false, isOverdue = false }) {
  let score = 20;

  if (type === 'loan_emi') score += 25;
  if (type === 'insurance_claim') score += 20;
  if (type === 'nominee_update') score += 15;
  if (type === 'asset_verification') score += 10;

  if (isOverdue) score += 30;
  if (isMissingNominee) score += 15;

  if (typeof daysUntilDue === 'number') {
    if (daysUntilDue < 0) score += 25;
    else if (daysUntilDue <= 3) score += 20;
    else if (daysUntilDue <= 7) score += 10;
  }

  if (financialImpact > 500000) score += 15;
  else if (financialImpact > 100000) score += 8;

  score = Math.min(100, score);

  let bucket = 'low';
  if (score >= 80) bucket = 'urgent';
  else if (score >= 60) bucket = 'high';
  else if (score >= 35) bucket = 'medium';

  return { score, bucket };
}

module.exports = { runDiscovery, persistDiscoveries, scorePriority };
