const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, requireCaseAccess } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');
const { answerQuestion } = require('../utils/aiAssistant');

const router = express.Router();
router.use(authenticate);

router.post(
  '/ask',
  [body('question').trim().notEmpty()],
  requireCaseAccess('viewer'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { question, history } = req.body;
    try {
      const result = await answerQuestion(req.case.id, question, Array.isArray(history) ? history : []);
      logAction({ caseId: req.case.id, userId: req.user.id, action: 'ai_question_asked', details: { question, source: result.source }, ip: req.ip });
      res.json(result);
    } catch (err) {
      console.error('AI assistant error:', err);
      res.status(500).json({ error: 'The AI assistant failed to respond. Please try again.' });
    }
  }
);

module.exports = router;
