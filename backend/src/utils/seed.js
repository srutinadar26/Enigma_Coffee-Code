require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { encryptField, last4 } = require('./crypto');
const { generateReminders } = require('./reminderEngine');

async function seed() {
  await db.initPromise;

  console.log('Seeding demo data...');

  const userId = uuidv4();
  const email = 'demo@estateassist.app';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  let ownerId;
  if (existing) {
    ownerId = existing.id;
    console.log('Demo user already exists, reusing:', email);
  } else {
    ownerId = userId;
    db.prepare('INSERT INTO users (id, name, email, password_hash, phone) VALUES (?, ?, ?, ?, ?)').run(
      ownerId, 'Priya Sharma', email, bcrypt.hashSync('Demo@1234', 12), '+91-9800000000'
    );
    console.log(`Created demo user -> email: ${email} / password: Demo@1234`);
  }

  const caseId = uuidv4();
  db.prepare(
    `INSERT INTO cases (id, owner_user_id, deceased_name, date_of_death, death_certificate_number, relationship_to_owner, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`
  ).run(caseId, ownerId, 'Ramesh Sharma', '2026-06-15', 'DC-2026-004821', 'Father');

  const assets = [
    { type: 'bank', inst: 'HDFC Bank', acct: '50100234567890', value: 845000, nominee: 'Priya Sharma', relation: 'Daughter', nomStatus: 'present', status: 'verified' },
    { type: 'bank', inst: 'State Bank of India', acct: '30450098761234', value: 212000, nominee: null, relation: null, nomStatus: 'missing', status: 'discovered' },
    { type: 'insurance', inst: 'LIC', acct: null, value: 2500000, nominee: 'Priya Sharma', relation: 'Daughter', nomStatus: 'present', status: 'claim_initiated' },
    { type: 'epf', inst: 'EPFO', acct: 'UAN-100234567891', value: 680000, nominee: 'Sunita Sharma', relation: 'Spouse', nomStatus: 'outdated', status: 'discovered' },
    { type: 'ppf', inst: 'Post Office PPF', acct: 'PPF-778812340091', value: 340000, nominee: 'Priya Sharma', relation: 'Daughter', nomStatus: 'present', status: 'verified' },
    { type: 'investment', inst: 'ICICI Direct (Demat)', acct: 'IN30012345678', value: 415000, nominee: null, relation: null, nomStatus: 'unknown', status: 'discovered' }
  ];

  const insertAsset = db.prepare(`
    INSERT INTO assets (id, case_id, asset_type, institution_name, account_number_enc, account_number_last4, estimated_value, nominee_name, nominee_relationship, nominee_status, status, source, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)
  `);
  const assetIds = {};
  for (const a of assets) {
    const id = uuidv4();
    assetIds[a.inst] = id;
    insertAsset.run(
      id, caseId, a.type, a.inst,
      a.acct ? encryptField(a.acct) : null, a.acct ? last4(a.acct) : null,
      a.value, a.nominee, a.relation, a.nomStatus, a.status,
      a.nomStatus !== 'present' ? 'Nominee details need attention before proceeding.' : null
    );
  }

  db.prepare(`
    INSERT INTO loans (id, case_id, lender_name, loan_type, outstanding_amount, emi_amount, emi_due_day, co_borrower, insurance_linked, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(uuidv4(), caseId, 'Axis Bank', 'home', 1850000, 24500, 5, 'Sunita Sharma', 1, 'Home loan has loan-cover term insurance — check with Axis for claim-based settlement.');

  db.prepare(`
    INSERT INTO loans (id, case_id, lender_name, loan_type, outstanding_amount, emi_amount, emi_due_day, co_borrower, insurance_linked, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(uuidv4(), caseId, 'HDFC Bank', 'credit_card', 42500, null, 18, null, 0, 'Outstanding credit card dues — no insurance linked.');

  db.prepare(`
    INSERT INTO insurance_claims (id, case_id, asset_id, insurer_name, policy_number_enc, claim_stage, required_documents, submitted_documents, claim_amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(), caseId, assetIds['LIC'], 'LIC', encryptField('LIC-POL-88234501'),
    'documents_pending',
    JSON.stringify(['Original policy document', 'Original death certificate', 'Claim form', 'Claimant ID & address proof', 'Bank details', 'Nominee proof']),
    JSON.stringify(['Original death certificate', 'Claimant ID & address proof']),
    2500000,
    'Awaiting claim form and bank details before submission.'
  );

  db.prepare(`
    INSERT INTO subscriptions (id, case_id, service_name, amount, billing_cycle, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(uuidv4(), caseId, 'Netflix', 649, 'monthly');
  db.prepare(`
    INSERT INTO subscriptions (id, case_id, service_name, amount, billing_cycle, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(uuidv4(), caseId, 'Amazon Prime', 1499, 'yearly');

  db.prepare(`
    INSERT INTO will_instructions (id, case_id, title, content_enc) VALUES (?, ?, ?, ?)
  `).run(uuidv4(), caseId, 'Locker & document locations', encryptField(
    'Bank locker at HDFC Bank, Andheri branch, locker #214. Keys in the study desk drawer. Original property papers with family lawyer Mr. Desai (+91-9811122233).'
  ));

  const createdReminders = generateReminders(caseId);

  console.log('\n✅ Demo data seeded successfully.\n');
  console.log('Login credentials:');
  console.log('  Email:    demo@estateassist.app');
  console.log('  Password: Demo@1234');
  console.log(`\nCase ID: ${caseId}`);
  console.log(`Auto-generated ${createdReminders.length} reminders based on case data.`);
}

seed().catch(console.error);
