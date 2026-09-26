const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireCaseAccess } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

// Create a new estate case
router.post(
  '/',
  [
    body('deceased_name').trim().notEmpty().withMessage('Deceased person\'s name is required'),
    body('date_of_death').optional({ checkFalsy: true }).isISO8601()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { deceased_name, date_of_death, death_certificate_number, relationship_to_owner } = req.body;
    const id = uuidv4();
    db.prepare(
      `INSERT INTO cases (id, owner_user_id, deceased_name, date_of_death, death_certificate_number, relationship_to_owner)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, req.user.id, deceased_name, date_of_death || null, death_certificate_number || null, relationship_to_owner || null);

    logAction({ caseId: id, userId: req.user.id, action: 'case_created', entityType: 'case', entityId: id, ip: req.ip });

    const created = db.prepare('SELECT * FROM cases WHERE id = ?').get(id);
    res.status(201).json({ case: created });
  }
);

// List cases the user owns or has family access to
router.get('/', (req, res) => {
  const owned = db.prepare("SELECT *, 'owner' as my_role FROM cases WHERE owner_user_id = ?").all(req.user.id);
  const shared = db
    .prepare(
      `SELECT c.*, fa.role as my_role FROM cases c
       JOIN family_access fa ON fa.case_id = c.id
       WHERE fa.user_id = ? AND fa.status = 'active'`
    )
    .all(req.user.id);
  res.json({ cases: [...owned, ...shared] });
});

router.get('/:caseId', requireCaseAccess('viewer'), (req, res) => {
  res.json({ case: req.case, my_role: req.caseRole });
});

router.patch('/:caseId', requireCaseAccess('editor'), (req, res) => {
  const allowed = ['deceased_name', 'date_of_death', 'death_certificate_number', 'relationship_to_owner', 'status'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  values.push(req.params.caseId);
  db.prepare(`UPDATE cases SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  logAction({ caseId: req.params.caseId, userId: req.user.id, action: 'case_updated', entityType: 'case', entityId: req.params.caseId, details: req.body, ip: req.ip });
  res.json({ case: db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.caseId) });
});

module.exports = router;
