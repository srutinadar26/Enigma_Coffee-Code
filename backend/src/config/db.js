const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'estate.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
  status TEXT DEFAULT 'active', -- active | in_progress | closed
  created_at TEXT DEFAULT (datetime('now'))
);

-- Family members granted access to a case
CREATE TABLE IF NOT EXISTS family_access (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  role TEXT DEFAULT 'viewer', -- owner | editor | viewer
  status TEXT DEFAULT 'pending', -- pending | active
  created_at TEXT DEFAULT (datetime('now'))
);

-- Financial Asset Vault (bank, insurance, EPF/PPF, investments) - sensitive fields encrypted
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL, -- bank | insurance | epf | ppf | investment | property | other
  institution_name TEXT NOT NULL,
  account_number_enc TEXT, -- encrypted
  account_number_last4 TEXT,
  estimated_value REAL,
  currency TEXT DEFAULT 'INR',
  nominee_name TEXT,
  nominee_relationship TEXT,
  nominee_status TEXT DEFAULT 'unknown', -- present | missing | outdated | unknown
  status TEXT DEFAULT 'discovered', -- discovered | verified | claim_initiated | closed
  source TEXT DEFAULT 'manual', -- manual | ocr | discovery_engine
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Loans & EMIs
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  lender_name TEXT NOT NULL,
  loan_type TEXT, -- home | auto | personal | credit_card | education
  outstanding_amount REAL,
  emi_amount REAL,
  emi_due_day INTEGER,
  co_borrower TEXT,
  insurance_linked INTEGER DEFAULT 0, -- loan protection insurance
  status TEXT DEFAULT 'active', -- active | under_review | settled | closed
  source TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Insurance claims tracking (separate from insurance asset entries, tracks the claim process)
CREATE TABLE IF NOT EXISTS insurance_claims (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  asset_id TEXT REFERENCES assets(id),
  insurer_name TEXT NOT NULL,
  policy_number_enc TEXT,
  claim_stage TEXT DEFAULT 'not_started', -- not_started | documents_pending | submitted | under_review | approved | rejected | paid
  required_documents TEXT, -- JSON array
  submitted_documents TEXT, -- JSON array
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
  billing_cycle TEXT, -- monthly | yearly
  status TEXT DEFAULT 'active', -- active | cancelled
  created_at TEXT DEFAULT (datetime('now'))
);

-- Uploaded documents + OCR extraction
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT,
  doc_category TEXT, -- bank_statement | insurance_policy | death_certificate | identity | other
  ocr_status TEXT DEFAULT 'pending', -- pending | processing | done | failed
  ocr_text TEXT,
  extracted_json TEXT, -- JSON of extracted entities
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Action reminders (auto-generated + manual)
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  related_type TEXT, -- asset | loan | claim | subscription | general
  related_id TEXT,
  priority TEXT DEFAULT 'medium', -- low | medium | high | urgent
  due_date TEXT,
  status TEXT DEFAULT 'pending', -- pending | done | dismissed
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

CREATE INDEX IF NOT EXISTS idx_assets_case ON assets(case_id);
CREATE INDEX IF NOT EXISTS idx_loans_case ON loans(case_id);
CREATE INDEX IF NOT EXISTS idx_claims_case ON insurance_claims(case_id);
CREATE INDEX IF NOT EXISTS idx_docs_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_reminders_case ON reminders(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_case ON audit_log(case_id);
`);

module.exports = db;
