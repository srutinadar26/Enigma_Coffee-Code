const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes). See .env.example');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts plaintext into a single base64 string containing iv + authTag + ciphertext.
 * Returns null if input is null/undefined/empty so optional fields stay empty.
 */
function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypts a string produced by encryptField. Returns null on empty input.
 */
function decryptField(payload) {
  if (!payload) return null;
  try {
    const key = getKey();
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    return '[decryption_error]';
  }
}

function last4(value) {
  if (!value) return null;
  const s = String(value).replace(/\s+/g, '');
  return s.length > 4 ? s.slice(-4) : s;
}

module.exports = { encryptField, decryptField, last4 };
