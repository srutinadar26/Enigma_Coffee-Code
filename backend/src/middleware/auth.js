const jwt = require('jsonwebtoken');
const db = require('../config/db');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Ensures the authenticated user has at least `minRole` access to the case
 * referenced by req.params.caseId (owner > editor > viewer).
 */
const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 };

function requireCaseAccess(minRole = 'viewer') {
  return (req, res, next) => {
    const caseId = req.params.caseId || req.body.case_id || req.query.case_id;
    if (!caseId) return res.status(400).json({ error: 'case_id is required' });

    const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId);
    if (!c) return res.status(404).json({ error: 'Case not found' });

    if (c.owner_user_id === req.user.id) {
      req.case = c;
      req.caseRole = 'owner';
      return next();
    }

    const access = db
      .prepare(`SELECT * FROM family_access WHERE case_id = ? AND user_id = ? AND status = 'active'`)
      .get(caseId, req.user.id);

    if (!access) return res.status(403).json({ error: 'You do not have access to this case' });

    if (ROLE_RANK[access.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: `Requires ${minRole} access or higher` });
    }

    req.case = c;
    req.caseRole = access.role;
    next();
  };
}

module.exports = { authenticate, requireCaseAccess };
