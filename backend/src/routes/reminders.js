const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { authenticate, requireCaseAccess } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');
const { generateReminders } = require('../utils/reminderEngine');

const router = express.Router();
router.use(authenticate);

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

router.get('/', requireCaseAccess('viewer'), (req, res) => {
  const status = req.query.status || 'pending';
  const rows = db
    .prepare(`SELECT * FROM reminders WHERE case_id = ? AND status = ? ORDER BY created_at DESC`)
    .all(req.query.case_id, status);
  rows.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  res.json({ reminders: rows });
});

// Re-runs the auto-generation engine against current case data
router.post('/generate', requireCaseAccess('editor'), (req, res) => {
  const createdIds = generateReminders(req.params.caseId || req.body.case_id || req.query.case_id);
  logAction({ caseId: req.case.id, userId: req.user.id, action: 'reminders_generated', details: { count: createdIds.length }, ip: req.ip });
  const reminders = db.prepare(`SELECT * FROM reminders WHERE case_id = ? AND status = 'pending' ORDER BY created_at DESC`).all(req.case.id);
  res.json({ created: createdIds.length, reminders });
});

router.post(
  '/',
  [body('case_id').notEmpty(), body('title').trim().notEmpty()],
  requireCaseAccess('editor'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { case_id, title, description, priority, due_date, related_type, related_id } = req.body;
    const id = uuidv4();
    db.prepare(
      `INSERT INTO reminders (id, case_id, title, description, related_type, related_id, priority, due_date, auto_generated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(id, case_id, title, description || null, related_type || 'general', related_id || null, priority || 'medium', due_date || null);
    logAction({ caseId: case_id, userId: req.user.id, action: 'reminder_created', entityType: 'reminder', entityId: id, ip: req.ip });
    res.status(201).json({ reminder: db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) });
  }
);

router.patch('/:id', requireCaseAccess('editor'), (req, res) => {
  const existing = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Reminder not found' });

  const allowed = ['title', 'description', 'priority', 'due_date', 'status'];
  const updates = []; const values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) { updates.push(`${key} = ?`); values.push(req.body[key]); }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  values.push(req.params.id);
  db.prepare(`UPDATE reminders SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  logAction({ caseId: existing.case_id, userId: req.user.id, action: 'reminder_updated', entityType: 'reminder', entityId: req.params.id, details: req.body, ip: req.ip });
  res.json({ reminder: db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', requireCaseAccess('editor'), (req, res) => {
  const existing = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Reminder not found' });
  db.prepare('DELETE FROM reminders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
