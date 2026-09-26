require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const db = require('./config/db'); // initializes schema on first import

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Global rate limiting to protect the login/register endpoints and API generally
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/assets', require('./routes/vault'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/insurance-claims', require('./routes/insurance'));
app.use('/api/nominees', require('./routes/nominees'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/family', require('./routes/family'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/will-instructions', require('./routes/will'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler (e.g. multer file errors, unexpected exceptions)
app.use((err, req, res, next) => {
  console.error(err);
  if (err.message === 'Unsupported file type') {
    return res.status(400).json({ error: 'Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, TXT.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Max size is 15MB.' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

db.initPromise.then(() => {
  app.listen(PORT, () => {
    console.log(`Digital Estate & Financial Closure Assistant API running on port ${PORT}`);
  });
}).catch(console.error);
