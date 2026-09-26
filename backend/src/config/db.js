const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'estate.db');

/**
 * sql.js wrapper that provides an API compatible with better-sqlite3.
 * sql.js is pure JavaScript, so it works on any platform without native
 * compilation (no Visual Studio / node-gyp needed on Windows).
 */
class DatabaseWrapper {
  constructor() {
    this._db = null;
    this._ready = false;
  }

  async _init() {
    const SQL = await initSqlJs();
    let buffer = null;
    if (fs.existsSync(DB_PATH)) {
      buffer = fs.readFileSync(DB_PATH);
    }
    this._db = buffer ? new SQL.Database(buffer) : new SQL.Database();
    this._ready = true;
    this._save();
  }

  _save() {
    if (!this._db) return;
    const data = this._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }

  pragma(str) {
    if (!this._db) return;
    try {
      this._db.run(`PRAGMA ${str}`);
    } catch (e) {
      // Some pragmas like WAL are not supported in sql.js, ignore gracefully
    }
  }

  exec(sql) {
    this._db.run(sql);
    this._save();
  }

  prepare(sql) {
    const db = this._db;
    const wrapper = this;
    return {
      run(...params) {
        db.run(sql, params);
        wrapper._save();
        return { changes: db.getRowsModified() };
      },
      get(...params) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const results = [];
        const stmt = db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }
}

// Create a synchronous-looking singleton. We use a Proxy so that code
// requiring this module gets the wrapper immediately, but the actual DB
// initialises asynchronously. The `initPromise` is awaited by server.js
// before starting the HTTP server.

const db = new DatabaseWrapper();

const initPromise = db._init().then(() => {
  db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- A "case" represents the deceased person's estate being managed
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  deceased_name TEXT NOT NULL,
  date_of_death TEXT,
  death_certificate_number TEXT,
  relationship_to_owner TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Family members granted access to a case
CREATE TABLE IF NOT EXISTS family_access (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  role TEXT DEFAULT 'viewer',
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Financial Asset Vault - sensitive fields encrypted
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  account_number_enc TEXT,
  account_number_last4 TEXT,
  estimated_value REAL,
  currency TEXT DEFAULT 'INR',
  nominee_name TEXT,
  nominee_relationship TEXT,
  nominee_status TEXT DEFAULT 'unknown',
  status TEXT DEFAULT 'discovered',
  source TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Loans & EMIs
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  lender_name TEXT NOT NULL,
  loan_type TEXT,
  outstanding_amount REAL,
  emi_amount REAL,
  emi_due_day INTEGER,
  co_borrower TEXT,
  insurance_linked INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  source TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Insurance claims tracking
CREATE TABLE IF NOT EXISTS insurance_claims (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES assets(id),
  insurer_name TEXT NOT NULL,
  policy_number_enc TEXT,
  claim_stage TEXT DEFAULT 'not_started',
  required_documents TEXT,
  submitted_documents TEXT,
  claim_amount REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Subscriptions with automatic payments
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  amount REAL,
  billing_cycle TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Uploaded documents + OCR extraction
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT,
  doc_category TEXT,
  ocr_status TEXT DEFAULT 'pending',
  ocr_text TEXT,
  extracted_json TEXT,
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Action reminders (auto-generated + manual)
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  related_type TEXT,
  related_id TEXT,
  priority TEXT DEFAULT 'medium',
  due_date TEXT,
  status TEXT DEFAULT 'pending',
  auto_generated INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Digital will / instructions vault
CREATE TABLE IF NOT EXISTS will_instructions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_enc TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
  `);

  // Create indexes (sql.js doesn't fail on IF NOT EXISTS for indexes)
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_assets_case ON assets(case_id)'); } catch(e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_loans_case ON loans(case_id)'); } catch(e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_claims_case ON insurance_claims(case_id)'); } catch(e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_docs_case ON documents(case_id)'); } catch(e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_reminders_case ON reminders(case_id)'); } catch(e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_audit_case ON audit_log(case_id)'); } catch(e) {}

  console.log('Database initialized successfully.');
});

module.exports = db;
module.exports.initPromise = initPromise;
