const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireCaseAccess } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', requireCaseAccess('viewer'), (req, res) => {
  const rows = db.prepare('SELECT * FROM loans WHERE case_id = ? ORDER BY created_at DESC').all(req.query.case_id);
  res.json({ loans: rows });
});

router.post(
  '/',
  [body('case_id').notEmpty(), body('lender_name').trim().notEmpty()],
  requireCaseAccess('editor'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { case_id, lender_name, loan_type, outstanding_amount, emi_amount, emi_due_day, co_borrower, insurance_linked, notes } = req.body;
    const id = uuidv4();
    db.prepare(
      `INSERT INTO loans (id, case_id, lender_name, loan_type, outstanding_amount, emi_amount, emi_due_day, co_borrower, insurance_linked, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, case_id, lender_name, loan_type || null, outstanding_amount || null, emi_amount || null, emi_due_day || null, co_borrower || null, insurance_linked ? 1 : 0, notes || null);

    logAction({ caseId: case_id, userId: req.user.id, action: 'loan_created', entityType: 'loan', entityId: id, ip: req.ip });
    res.status(201).json({ loan: db.prepare('SELECT * FROM loans WHERE id = ?').get(id) });
  }
);

router.patch('/:id', requireCaseAccess('editor'), (req, res) => {
  const existing = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Loan not found' });

  const allowed = ['lender_name', 'loan_type', 'outstanding_amount', 'emi_amount', 'emi_due_day', 'co_borrower', 'insurance_linked', 'status', 'notes'];
  const updates = []; const values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) { updates.push(`${key} = ?`); values.push(req.body[key]); }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  values.push(req.params.id);
  db.prepare(`UPDATE loans SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  logAction({ caseId: existing.case_id, userId: req.user.id, action: 'loan_updated', entityType: 'loan', entityId: req.params.id, details: req.body, ip: req.ip });
  res.json({ loan: db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', requireCaseAccess('editor'), (req, res) => {
  const existing = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Loan not found' });
  db.prepare('DELETE FROM loans WHERE id = ?').run(req.params.id);
  logAction({ caseId: existing.case_id, userId: req.user.id, action: 'loan_deleted', entityType: 'loan', entityId: req.params.id, ip: req.ip });
  res.json({ success: true });
});

module.exports = router;
