const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { scorePriority } = require('./discovery');

const insertReminder = db.prepare(`
  INSERT INTO reminders (id, case_id, title, description, related_type, related_id, priority, due_date, auto_generated)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
`);

const existingAutoReminder = db.prepare(`
  SELECT id FROM reminders WHERE case_id = ? AND related_type = ? AND related_id = ? AND status = 'pending'
`);

function daysFromNow(dateStr) {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  const now = new Date();
  return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
}

/**
 * Regenerates the auto-generated pending reminders for a case by inspecting
 * loans, assets, and insurance claims for missing information or approaching
 * deadlines. Idempotent: skips creating a duplicate for the same entity
 * while a pending one already exists.
 */
function generateReminders(caseId) {
  const created = [];

  // 1. Missing/outdated nominees on assets
  const assets = db.prepare(`SELECT * FROM assets WHERE case_id = ?`).all(caseId);
  for (const a of assets) {
    if (a.nominee_status === 'missing' || a.nominee_status === 'outdated') {
      if (existingAutoReminder.get(caseId, 'asset', a.id)) continue;
      const { bucket } = scorePriority({ type: 'nominee_update', isMissingNominee: true, financialImpact: a.estimated_value || 0 });
      const id = uuidv4();
      insertReminder.run(
        id, caseId,
        `Update nominee details: ${a.institution_name}`,
        `Nominee information for this ${a.asset_type} account is ${a.nominee_status}. Contact ${a.institution_name} to update records before proceeding with claims.`,
        'asset', a.id, bucket, null
      );
      created.push(id);
    }
    if (a.status === 'discovered' && a.source === 'discovery_engine') {
      if (existingAutoReminder.get(caseId, 'asset_verify', a.id)) continue;
      const { bucket } = scorePriority({ type: 'asset_verification', financialImpact: a.estimated_value || 0 });
      const id = uuidv4();
      insertReminder.run(
        id, caseId,
        `Verify potential asset: ${a.institution_name}`,
        `This ${a.asset_type} account was detected from an uploaded document but hasn't been confirmed yet. Reach out to ${a.institution_name} to verify.`,
        'asset_verify', a.id, bucket, null
      );
      created.push(id);
    }
  }

  // 2. Loans / EMIs approaching due dates or unresolved
  const loans = db.prepare(`SELECT * FROM loans WHERE case_id = ? AND status = 'active'`).all(caseId);
  for (const l of loans) {
    if (existingAutoReminder.get(caseId, 'loan', l.id)) continue;
    let due = null;
    let overdue = false;
    if (l.emi_due_day) {
      const now = new Date();
      due = new Date(now.getFullYear(), now.getMonth(), l.emi_due_day);
      if (due < now) overdue = true;
    }
    const { bucket } = scorePriority({
      type: 'loan_emi',
      daysUntilDue: due ? daysFromNow(due.toISOString()) : null,
      financialImpact: l.outstanding_amount || 0,
      isOverdue: overdue
    });
    const id = uuidv4();
    insertReminder.run(
      id, caseId,
      `Resolve active EMI: ${l.lender_name}`,
      `${l.loan_type || 'Loan'} with ${l.lender_name} has an outstanding balance${l.outstanding_amount ? ` of ₹${l.outstanding_amount.toLocaleString('en-IN')}` : ''}. Contact the lender about death intimation, moratoriums, or loan insurance claims.`,
      'loan', l.id, bucket, due ? due.toISOString().slice(0, 10) : null
    );
    created.push(id);
  }

  // 3. Insurance claims not yet started/submitted
  const claims = db.prepare(`SELECT * FROM insurance_claims WHERE case_id = ? AND claim_stage NOT IN ('paid','rejected')`).all(caseId);
  for (const c of claims) {
    if (existingAutoReminder.get(caseId, 'claim', c.id)) continue;
    const { bucket } = scorePriority({ type: 'insurance_claim', financialImpact: c.claim_amount || 0 });
    const id = uuidv4();
    insertReminder.run(
      id, caseId,
      `Progress insurance claim: ${c.insurer_name}`,
      `Claim with ${c.insurer_name} is currently "${c.claim_stage.replace(/_/g, ' ')}". Check required documents and submit the next set of paperwork.`,
      'claim', c.id, bucket, null
    );
    created.push(id);
  }

  return created;
}

module.exports = { generateReminders };
