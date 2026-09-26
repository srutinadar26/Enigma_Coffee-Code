/**
 * Lightweight, dependency-free entity extraction from OCR/plain text of
 * Indian financial documents (bank statements, insurance policies, EPF/PPF
 * passbooks). Uses targeted regexes + keyword heuristics rather than a
 * heavyweight NLP model, which keeps the app fast and offline-capable.
 */

const KNOWN_BANKS = [
  'State Bank of India', 'SBI', 'HDFC Bank', 'HDFC', 'ICICI Bank', 'ICICI', 'Axis Bank',
  'Punjab National Bank', 'PNB', 'Bank of Baroda', 'Canara Bank', 'Union Bank',
  'Kotak Mahindra Bank', 'Kotak', 'IDFC First Bank', 'IndusInd Bank', 'Yes Bank'
];

const KNOWN_INSURERS = [
  'LIC', 'Life Insurance Corporation', 'HDFC Life', 'ICICI Prudential', 'SBI Life',
  'Max Life', 'Bajaj Allianz', 'Tata AIA', 'Star Health', 'New India Assurance'
];

const CATEGORY_KEYWORDS = {
  bank_statement: ['account statement', 'ifsc', 'account number', 'savings account', 'current account'],
  insurance_policy: ['policy number', 'sum assured', 'premium', 'policyholder', 'life insurance', 'nominee'],
  epf: ['epfo', 'provident fund', 'uan', 'pf account'],
  ppf: ['public provident fund', 'ppf account'],
  death_certificate: ['death certificate', 'certificate of death', 'date of death', 'cause of death'],
  identity: ['aadhaar', 'permanent account number', 'pan card', 'passport']
};

function detectCategory(text) {
  const lower = text.toLowerCase();
  let best = { category: 'other', score: 0 };
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
    if (score > best.score) best = { category, score };
  }
  return best.category;
}

function findInstitution(text, list) {
  for (const name of list) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) return name;
  }
  return null;
}

function extractAccountNumbers(text) {
  // Indian bank account numbers: typically 9-18 digits, often near "A/C" or "Account No"
  const matches = new Set();
  const re = /(?:a\/?c\s*(?:no\.?)?|account\s*(?:no\.?|number)?)\s*[:\-]?\s*(\d[\d\s]{7,20}\d)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.add(m[1].replace(/\s+/g, ''));
  }
  return Array.from(matches);
}

function extractIFSC(text) {
  const m = text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/);
  return m ? m[1] : null;
}

function extractPolicyNumbers(text) {
  const matches = new Set();
  const re = /policy\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9\-\/]{6,20})/gi;
  let m;
  while ((m = re.exec(text)) !== null) matches.add(m[1]);
  return Array.from(matches);
}

function extractAmounts(text) {
  // Rs. 1,23,456.00 / INR 50000 / ₹ 1,00,000
  const matches = [];
  const re = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const num = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(num)) matches.push(num);
  }
  return matches;
}

function extractDates(text) {
  const matches = new Set();
  // dd/mm/yyyy, dd-mm-yyyy, dd Month yyyy
  const re1 = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g;
  const re2 = /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi;
  let m;
  while ((m = re1.exec(text)) !== null) matches.add(m[1]);
  while ((m = re2.exec(text)) !== null) matches.add(m[1]);
  return Array.from(matches);
}

function extractNominee(text) {
  const re = /nominee\s*(?:name)?\s*[:\-]?\s*([A-Z][a-zA-Z\.\s]{2,40})/i;
  const m = text.match(re);
  if (!m) return null;
  return m[1].trim().split('\n')[0].trim();
}

function extractUAN(text) {
  const m = text.match(/\bUAN\s*[:\-]?\s*(\d{10,12})\b/i);
  return m ? m[1] : null;
}

/**
 * Full extraction pipeline for a piece of OCR'd text.
 */
function extractEntities(text) {
  if (!text || !text.trim()) {
    return { category: 'other', entities: {}, confidence: 0 };
  }

  const category = detectCategory(text);
  const bank = findInstitution(text, KNOWN_BANKS);
  const insurer = findInstitution(text, KNOWN_INSURERS);
  const accountNumbers = extractAccountNumbers(text);
  const ifsc = extractIFSC(text);
  const policyNumbers = extractPolicyNumbers(text);
  const amounts = extractAmounts(text);
  const dates = extractDates(text);
  const nominee = extractNominee(text);
  const uan = extractUAN(text);

  const entities = {
    institution: bank || insurer || null,
    institution_type: bank ? 'bank' : insurer ? 'insurer' : null,
    account_numbers: accountNumbers,
    ifsc,
    policy_numbers: policyNumbers,
    amounts,
    max_amount: amounts.length ? Math.max(...amounts) : null,
    dates,
    nominee_name: nominee,
    uan
  };

  // crude confidence score based on how many fields we managed to fill
  const filled = Object.values(entities).filter((v) => (Array.isArray(v) ? v.length > 0 : !!v)).length;
  const confidence = Math.min(1, filled / 6);

  return { category, entities, confidence };
}

module.exports = {
  extractEntities,
  detectCategory,
  KNOWN_BANKS,
  KNOWN_INSURERS
};
