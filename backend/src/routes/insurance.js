const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireCaseAccess } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');
const { encryptField, decryptField } = require('../utils/crypto');

const router = express.Router();
router.use(authenticate);

const DEFAULT_REQUIRED_DOCS = [
  'Original policy document',
  'Original death certificate',
  'Claim form (insurer-specific)',
  'Claimant ID & address proof',
  'Claimant bank account details (cancelled cheque/passbook)',
  'Nominee/legal heir proof'
];

function serialize(row, revealFull = false) {
  return {
    id: row.id,
    case_id: row.case_id,
    asset_id: row.asset_id,
    insurer_name: row.insurer_name,
    policy_number: revealFull ? decryptField(row.policy_number_enc) : (row.policy_number_enc ? '••••••••' : null),
    claim_stage: row.claim_stage,
    required_documents: row.required_documents ? JSON.parse(row.required_documents) : DEFAULT_REQUIRED_DOCS,
    submitted_documents: row.submitted_documents ? JSON.parse(row.submitted_documents) : [],
    claim_amount: row.claim_amount,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.get('/', requireCaseAccess('viewer'), (req, res) => {
  const rows = db.prepare('SELECT * FROM insurance_claims WHERE case_id = ? ORDER BY created_at DESC').all(req.query.case_id);
  res.json({ claims: rows.map((r) => serialize(r)) });
});

router.post(
  '/',
  [body('case_id').notEmpty(), body('insurer_name').trim().notEmpty()],
  requireCaseAccess('editor'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { case_id, asset_id, insurer_name, policy_number, claim_amount, notes } = req.body;
    const id = uuidv4();
    db.prepare(
      `INSERT INTO insurance_claims (id, case_id, asset_id, insurer_name, policy_number_enc, required_documents, submitted_documents, claim_amount, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, case_id, asset_id || null, insurer_name, policy_number ? encryptField(policy_number) : null,
      JSON.stringify(DEFAULT_REQUIRED_DOCS), JSON.stringify([]), claim_amount || null, notes || null);

    logAction({ caseId: case_id, userId: req.user.id, action: 'claim_created', entityType: 'insurance_claim', entityId: id, ip: req.ip });
    res.status(201).json({ claim: serialize(db.prepare('SELECT * FROM insurance_claims WHERE id = ?').get(id)) });
  }
);

router.patch('/:id', requireCaseAccess('editor'), (req, res) => {
  const existing = db.prepare('SELECT * FROM insurance_claims WHERE id = ?').get(req.params.id);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Claim not found' });

  const allowed = ['insurer_name', 'claim_stage', 'claim_amount', 'notes'];
  const updates = []; const values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) { updates.push(`${key} = ?`); values.push(req.body[key]); }
  }
  if (req.body.policy_number !== undefined) {
    updates.push('policy_number_enc = ?'); values.push(encryptField(req.body.policy_number));
  }
  if (req.body.submitted_documents !== undefined) {
    updates.push('submitted_documents = ?'); values.push(JSON.stringify(req.body.submitted_documents));
  }
  updates.push("updated_at = datetime('now')");
  if (updates.length === 1) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(req.params.id);
  db.prepare(`UPDATE insurance_claims SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  logAction({ caseId: existing.case_id, userId: req.user.id, action: 'claim_updated', entityType: 'insurance_claim', entityId: req.params.id, details: req.body, ip: req.ip });
  res.json({ claim: serialize(db.prepare('SELECT * FROM insurance_claims WHERE id = ?').get(req.params.id)) });
});

router.delete('/:id', requireCaseAccess('editor'), (req, res) => {
  const existing = db.prepare('SELECT * FROM insurance_claims WHERE id = ?').get(req.params.id);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Claim not found' });
  db.prepare('DELETE FROM insurance_claims WHERE id = ?').run(req.params.id);
  logAction({ caseId: existing.case_id, userId: req.user.id, action: 'claim_deleted', entityType: 'insurance_claim', entityId: req.params.id, ip: req.ip });
  res.json({ success: true });
});

module.exports = router;
