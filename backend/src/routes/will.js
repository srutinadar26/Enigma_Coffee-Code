const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireCaseAccess } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');
const { encryptField, decryptField } = require('../utils/crypto');

const router = express.Router();
router.use(authenticate);

function serialize(row) {
  return { id: row.id, case_id: row.case_id, title: row.title, content: decryptField(row.content_enc), created_at: row.created_at };
}

router.get('/', requireCaseAccess('viewer'), (req, res) => {
  const rows = db.prepare('SELECT * FROM will_instructions WHERE case_id = ? ORDER BY created_at DESC').all(req.query.case_id);
  logAction({ caseId: req.query.case_id, userId: req.user.id, action: 'will_instructions_viewed', ip: req.ip });
  res.json({ instructions: rows.map(serialize) });
});

router.post(
  '/',
  [body('case_id').notEmpty(), body('title').trim().notEmpty(), body('content').trim().notEmpty()],
  requireCaseAccess('editor'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { case_id, title, content } = req.body;
    const id = uuidv4();
    db.prepare('INSERT INTO will_instructions (id, case_id, title, content_enc) VALUES (?, ?, ?, ?)').run(id, case_id, title, encryptField(content));
    logAction({ caseId: case_id, userId: req.user.id, action: 'will_instruction_added', entityType: 'will_instructions', entityId: id, ip: req.ip });
    res.status(201).json({ instruction: serialize(db.prepare('SELECT * FROM will_instructions WHERE id = ?').get(id)) });
  }
);

router.delete('/:id', requireCaseAccess('owner'), (req, res) => {
  const existing = db.prepare('SELECT * FROM will_instructions WHERE id = ?').get(req.params.id);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM will_instructions WHERE id = ?').run(req.params.id);
  logAction({ caseId: existing.case_id, userId: req.user.id, action: 'will_instruction_deleted', entityType: 'will_instructions', entityId: req.params.id, ip: req.ip });
  res.json({ success: true });
});

module.exports = router;
