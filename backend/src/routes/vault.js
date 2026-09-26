const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireCaseAccess } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');
const { encryptField, decryptField, last4 } = require('../utils/crypto');

const router = express.Router();
router.use(authenticate);

function serializeAsset(row, revealFull = false) {
  return {
    id: row.id,
    case_id: row.case_id,
    asset_type: row.asset_type,
    institution_name: row.institution_name,
    account_number_masked: row.account_number_last4 ? `••••${row.account_number_last4}` : null,
    account_number_full: revealFull ? decryptField(row.account_number_enc) : undefined,
    estimated_value: row.estimated_value,
    currency: row.currency,
    nominee_name: row.nominee_name,
    nominee_relationship: row.nominee_relationship,
    nominee_status: row.nominee_status,
    status: row.status,
    source: row.source,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.get('/', requireCaseAccess('viewer'), (req, res) => {
  const rows = db.prepare('SELECT * FROM assets WHERE case_id = ? ORDER BY created_at DESC').all(req.query.case_id);
  res.json({ assets: rows.map((r) => serializeAsset(r)) });
});

router.get('/:id/reveal', requireCaseAccess('viewer'), (req, res) => {
  // account number is only decrypted on this explicit endpoint, and access is audited
  const row = db.prepare('SELECT * FROM assets WHERE id = ? AND case_id = ?').get(req.params.id, req.query.case_id);
  if (!row) return res.status(404).json({ error: 'Asset not found' });
  logAction({ caseId: req.query.case_id, userId: req.user.id, action: 'asset_account_revealed', entityType: 'asset', entityId: row.id, ip: req.ip });
  res.json({ asset: serializeAsset(row, true) });
});

router.post(
  '/',
  [
    body('case_id').notEmpty(),
    body('asset_type').isIn(['bank', 'insurance', 'epf', 'ppf', 'investment', 'property', 'other']),
    body('institution_name').trim().notEmpty()
  ],
  requireCaseAccess('editor'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      case_id, asset_type, institution_name, account_number, estimated_value, currency,
      nominee_name, nominee_relationship, nominee_status, notes
    } = req.body;

    const id = uuidv4();
    db.prepare(
      `INSERT INTO assets
       (id, case_id, asset_type, institution_name, account_number_enc, account_number_last4,
        estimated_value, currency, nominee_name, nominee_relationship, nominee_status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, case_id, asset_type, institution_name,
      account_number ? encryptField(account_number) : null,
      account_number ? last4(account_number) : null,
      estimated_value || null, currency || 'INR',
      nominee_name || null, nominee_relationship || null, nominee_status || 'unknown',
      notes || null
    );

    logAction({ caseId: case_id, userId: req.user.id, action: 'asset_created', entityType: 'asset', entityId: id, ip: req.ip });
    const created = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    res.status(201).json({ asset: serializeAsset(created) });
  }
);

router.patch('/:id', requireCaseAccess('editor'), (req, res) => {
  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Asset not found' });

  const allowed = ['institution_name', 'estimated_value', 'currency', 'nominee_name', 'nominee_relationship', 'nominee_status', 'status', 'notes'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (req.body.account_number !== undefined) {
    updates.push('account_number_enc = ?', 'account_number_last4 = ?');
    values.push(encryptField(req.body.account_number), last4(req.body.account_number));
  }
  updates.push("updated_at = datetime('now')");
  if (updates.length === 1) return res.status(400).json({ error: 'No valid fields to update' });

  values.push(req.params.id);
  db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  logAction({ caseId: existing.case_id, userId: req.user.id, action: 'asset_updated', entityType: 'asset', entityId: req.params.id, details: req.body, ip: req.ip });

  const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  res.json({ asset: serializeAsset(updated) });
});

router.delete('/:id', requireCaseAccess('editor'), (req, res) => {
  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Asset not found' });
  db.prepare('DELETE FROM assets WHERE id = ?').run(req.params.id);
  logAction({ caseId: existing.case_id, userId: req.user.id, action: 'asset_deleted', entityType: 'asset', entityId: req.params.id, ip: req.ip });
  res.json({ success: true });
});

module.exports = router;
