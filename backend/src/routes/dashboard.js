const express = require('express');
const db = require('../config/db');
const { authenticate, requireCaseAccess } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', requireCaseAccess('viewer'), (req, res) => {
  const caseId = req.query.case_id;

  const assets = db.prepare('SELECT * FROM assets WHERE case_id = ?').all(caseId);
  const loans = db.prepare(`SELECT * FROM loans WHERE case_id = ?`).all(caseId);
  const claims = db.prepare('SELECT * FROM insurance_claims WHERE case_id = ?').all(caseId);
  const reminders = db.prepare(`SELECT * FROM reminders WHERE case_id = ? AND status = 'pending'`).all(caseId);
  const documents = db.prepare('SELECT * FROM documents WHERE case_id = ?').all(caseId);

  const totalAssetValue = assets.reduce((sum, a) => sum + (a.estimated_value || 0), 0);
  const totalLiabilities = loans.reduce((sum, l) => sum + (l.outstanding_amount || 0), 0);
  const totalClaimAmount = claims.reduce((sum, c) => sum + (c.claim_amount || 0), 0);

  const assetsByType = {};
  for (const a of assets) {
    assetsByType[a.asset_type] = (assetsByType[a.asset_type] || 0) + (a.estimated_value || 0);
  }

  const assetsByStatus = {};
  for (const a of assets) {
    assetsByStatus[a.status] = (assetsByStatus[a.status] || 0) + 1;
  }

  const claimsByStage = {};
  for (const c of claims) {
    claimsByStage[c.claim_stage] = (claimsByStage[c.claim_stage] || 0) + 1;
  }

  const remindersByPriority = { urgent: 0, high: 0, medium: 0, low: 0 };
  for (const r of reminders) remindersByPriority[r.priority] = (remindersByPriority[r.priority] || 0) + 1;

  res.json({
    summary: {
      total_asset_value: totalAssetValue,
      total_liabilities: totalLiabilities,
      net_estate_value: totalAssetValue - totalLiabilities,
      total_pending_claim_amount: totalClaimAmount,
      asset_count: assets.length,
      loan_count: loans.length,
      claim_count: claims.length,
      pending_reminders: reminders.length,
      documents_processed: documents.filter((d) => d.ocr_status === 'done').length,
      documents_total: documents.length,
      missing_nominees: assets.filter((a) => a.nominee_status === 'missing' || a.nominee_status === 'outdated').length,
      discovered_unverified: assets.filter((a) => a.status === 'discovered').length
    },
    charts: {
      assets_by_type: assetsByType,
      assets_by_status: assetsByStatus,
      claims_by_stage: claimsByStage,
      reminders_by_priority: remindersByPriority
    },
    urgent_reminders: reminders.filter((r) => r.priority === 'urgent' || r.priority === 'high').slice(0, 5)
  });
});

module.exports = router;
