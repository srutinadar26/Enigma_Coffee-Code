const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

const insertStmt = db.prepare(`
  INSERT INTO audit_log (id, case_id, user_id, action, entity_type, entity_id, details, ip_address)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

function logAction({ caseId, userId, action, entityType, entityId, details, ip }) {
  try {
    insertStmt.run(
      uuidv4(),
      caseId || null,
      userId || null,
      action,
      entityType || null,
      entityId || null,
      details ? JSON.stringify(details) : null,
      ip || null
    );
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAction };
