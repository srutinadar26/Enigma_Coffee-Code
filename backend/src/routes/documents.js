const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { authenticate, requireCaseAccess } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');
const { extractText } = require('../utils/ocr');
const { extractEntities, detectCategory } = require('../utils/extraction');
const { runDiscovery, persistDiscoveries } = require('../utils/discovery');
const { generateReminders } = require('../utils/reminderEngine');

const router = express.Router();
router.use(authenticate);

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'];
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) return cb(new Error('Unsupported file type'));
    cb(null, true);
  }
});

router.get('/', requireCaseAccess('viewer'), (req, res) => {
  const rows = db
    .prepare('SELECT id, case_id, original_filename, mime_type, doc_category, ocr_status, created_at FROM documents WHERE case_id = ? ORDER BY created_at DESC')
    .all(req.query.case_id);
  res.json({ documents: rows });
});

router.get('/:id', requireCaseAccess('viewer'), (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND case_id = ?').get(req.params.id, req.query.case_id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json({
    document: {
      ...doc,
      extracted_json: doc.extracted_json ? JSON.parse(doc.extracted_json) : null
    }
  });
});

router.post('/upload', requireCaseAccess('editor'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const caseId = req.body.case_id;
  const id = uuidv4();

  db.prepare(
    `INSERT INTO documents (id, case_id, original_filename, stored_path, mime_type, doc_category, ocr_status, uploaded_by)
     VALUES (?, ?, ?, ?, ?, 'other', 'processing', ?)`
  ).run(id, caseId, req.file.originalname, req.file.path, req.file.mimetype, req.user.id);

  logAction({ caseId, userId: req.user.id, action: 'document_uploaded', entityType: 'document', entityId: id, ip: req.ip });

  // Respond immediately with "processing" status; OCR runs async and the
  // client polls GET /:id or GET / to see it flip to "done".
  res.status(202).json({ document_id: id, status: 'processing' });

  processDocumentAsync(id, req.file.path, req.file.mimetype, caseId).catch((err) => {
    console.error('Async document processing failed:', err);
    db.prepare(`UPDATE documents SET ocr_status = 'failed' WHERE id = ?`).run(id);
  });
});

async function processDocumentAsync(docId, filePath, mimeType, caseId) {
  const { text, method } = await extractText(filePath, mimeType);
  const { category, entities, confidence } = extractEntities(text);

  db.prepare(
    `UPDATE documents SET ocr_status = 'done', ocr_text = ?, doc_category = ?, extracted_json = ? WHERE id = ?`
  ).run(text, category, JSON.stringify({ entities, confidence, method }), docId);

  // Run asset discovery across the whole case now that we have new text
  const candidates = runDiscovery(caseId);
  if (candidates.length) persistDiscoveries(caseId, candidates);

  generateReminders(caseId);
}

router.patch('/:id', requireCaseAccess('editor'), (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc || doc.case_id !== req.case.id) return res.status(404).json({ error: 'Document not found' });
  if (req.body.doc_category) {
    db.prepare('UPDATE documents SET doc_category = ? WHERE id = ?').run(req.body.doc_category, req.params.id);
  }
  res.json({ document: db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', requireCaseAccess('editor'), (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc || doc.case_id !== req.case.id) return res.status(404).json({ error: 'Document not found' });
  try { fs.unlinkSync(doc.stored_path); } catch (e) { /* file already gone, ignore */ }
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  logAction({ caseId: doc.case_id, userId: req.user.id, action: 'document_deleted', entityType: 'document', entityId: req.params.id, ip: req.ip });
  res.json({ success: true });
});

module.exports = router;
