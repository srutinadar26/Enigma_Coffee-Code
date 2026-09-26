const express = require('express');
const db = require('../config/db');
const { authenticate, requireCaseAccess } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

// Aggregated nominee status across every asset in the case
router.get('/', requireCaseAccess('viewer'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, asset_type, institution_name, nominee_name, nominee_relationship, nominee_status, estimated_value
       FROM assets WHERE case_id = ? ORDER BY
       CASE nominee_status WHEN 'missing' THEN 0 WHEN 'outdated' THEN 1 WHEN 'unknown' THEN 2 ELSE 3 END`
    )
    .all(req.query.case_id);

  const summary = {
    total: rows.length,
    present: rows.filter((r) => r.nominee_status === 'present').length,
    missing: rows.filter((r) => r.nominee_status === 'missing').length,
    outdated: rows.filter((r) => r.nominee_status === 'outdated').length,
    unknown: rows.filter((r) => r.nominee_status === 'unknown').length
  };

  res.json({ assets: rows, summary });
});

router.patch('/:assetId', requireCaseAccess('editor'), (req, res) => {
  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.assetId);
  if (!existing || existing.case_id !== req.case.id) return res.status(404).json({ error: 'Asset not found' });

  const { nominee_name, nominee_relationship, nominee_status } = req.body;
  if (!nominee_status) return res.status(400).json({ error: 'nominee_status is required' });

  db.prepare(
    `UPDATE assets SET nominee_name = ?, nominee_relationship = ?, nominee_status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(nominee_name || existing.nominee_name, nominee_relationship || existing.nominee_relationship, nominee_status, req.params.assetId);

  logAction({ caseId: existing.case_id, userId: req.user.id, action: 'nominee_updated', entityType: 'asset', entityId: req.params.assetId, details: req.body, ip: req.ip });
  res.json({ asset: db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.assetId) });
});

module.exports = router;
