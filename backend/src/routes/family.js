const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireCaseAccess } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', requireCaseAccess('viewer'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT fa.id, fa.invited_email, fa.role, fa.status, fa.created_at, u.name as user_name
       FROM family_access fa LEFT JOIN users u ON u.id = fa.user_id
       WHERE fa.case_id = ? ORDER BY fa.created_at DESC`
    )
    .all(req.query.case_id);
  res.json({ members: rows });
});

// Only the owner can invite family members
router.post(
  '/invite',
  [body('case_id').notEmpty(), body('email').isEmail().normalizeEmail(), body('role').isIn(['editor', 'viewer'])],
  requireCaseAccess('owner'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { case_id, email, role } = req.body;
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    const id = uuidv4();
    const status = existingUser ? 'active' : 'pending';

    db.prepare(
      `INSERT INTO family_access (id, case_id, invited_email, user_id, role, status) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, case_id, email, existingUser ? existingUser.id : null, role, status);

    logAction({ caseId: case_id, userId: req.user.id, action: 'family_member_invited', entityType: 'family_access', entityId: id, details: { email, role }, ip: req.ip });
    res.status(201).json({
      member: db.prepare('SELECT * FROM family_access WHERE id = ?').get(id),
      note: existingUser ? undefined : 'This email has no account yet — access activates automatically once they register with this email.'
    });
  }
);

router.patch('/:id', requireCaseAccess('owner'), (req, res) => {
  const existing = db.prepare('SELECT * FROM family_access WHERE id = ?').get(req.params.id);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Family member not found' });
  if (req.body.role) db.prepare('UPDATE family_access SET role = ? WHERE id = ?').run(req.body.role, req.params.id);
  logAction({ caseId: existing.case_id, userId: req.user.id, action: 'family_role_updated', entityType: 'family_access', entityId: req.params.id, details: req.body, ip: req.ip });
  res.json({ member: db.prepare('SELECT * FROM family_access WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', requireCaseAccess('owner'), (req, res) => {
  const existing = db.prepare('SELECT * FROM family_access WHERE id = ?').get(req.params.id);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Family member not found' });
  db.prepare('DELETE FROM family_access WHERE id = ?').run(req.params.id);
  logAction({ caseId: existing.case_id, userId: req.user.id, action: 'family_member_removed', entityType: 'family_access', entityId: req.params.id, ip: req.ip });
  res.json({ success: true });
});

// Activates any pending invites that match this user's email — called on login/register
function activatePendingInvites(userId, email) {
  db.prepare(`UPDATE family_access SET user_id = ?, status = 'active' WHERE invited_email = ? AND status = 'pending'`).run(userId, email);
}

module.exports = router;
module.exports.activatePendingInvites = activatePendingInvites;
