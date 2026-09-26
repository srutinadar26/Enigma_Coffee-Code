const express = require('express');
const db = require('../config/db');
const { authenticate, requireCaseAccess } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', requireCaseAccess('owner'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT al.*, u.name as user_name FROM audit_log al LEFT JOIN users u ON u.id = al.user_id
       WHERE al.case_id = ? ORDER BY al.created_at DESC LIMIT 200`
    )
    .all(req.query.case_id);
  res.json({
    logs: rows.map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null }))
  });
});

module.exports = router;
