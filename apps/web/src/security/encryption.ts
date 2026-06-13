/**
 * Field-level encryption utilities using Node.js native crypto (AES-256-GCM).
 *
 * These functions are server-only and must NOT be imported in client components.
 * They are used for optional GDPR-compliant encryption of sensitive journal content
 * and PII fields before storing them in PostgreSQL.
 *
 * Format of encrypted strings: base64("<iv>:<authTag>:<ciphertext>")
 * where each segment is a hex string.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // 96 bits — recommended for GCM
const TAG_LENGTH = 16;      // 128-bit authentication tag
const KEY_LENGTH = 32;      // 256 bits

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[Encryption] ENCRYPTION_KEY environment variable is not set. ' +
          'Set a 32-byte (64 hex character) key for production use.',
      );
    }
    // Development fallback — deterministic but insecure placeholder
    console.warn(
      '[Encryption] ENCRYPTION_KEY not set. Using development fallback key. ' +
        'NEVER use this in production.',
    );
    return Buffer.from('dev_fallback_key_not_for_production_use!'.padEnd(32, '0').slice(0, 32));
  }

  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    // Hex-encoded 32-byte key
    return Buffer.from(raw, 'hex');
  }

  if (raw.length >= KEY_LENGTH) {
    // Raw ASCII key of sufficient length
    return Buffer.from(raw.slice(0, KEY_LENGTH));
  }

  // Derive a 32-byte key from a shorter passphrase using SHA-256
  return createHash('sha256').update(raw).digest();
}

// ---------------------------------------------------------------------------
// encrypt
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @returns A base64-encoded string in the format "hex(iv):hex(authTag):hex(ciphertext)"
 */
export function encrypt(text: string): string {
  if (typeof text !== 'string') {
    throw new TypeError('[Encryption] encrypt() requires a string argument.');
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  const payload = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  return Buffer.from(payload).toString('base64');
}

// ---------------------------------------------------------------------------
// decrypt
// ---------------------------------------------------------------------------

/**
 * Decrypts a string produced by `encrypt()`.
 *
 * @throws If the ciphertext is malformed or the authentication tag is invalid.
 */
export function decrypt(encryptedText: string): string {
  if (typeof encryptedText !== 'string') {
    throw new TypeError('[Encryption] decrypt() requires a string argument.');
  }

  let payload: string;
  try {
    payload = Buffer.from(encryptedText, 'base64').toString('utf8');
  } catch {
    throw new Error('[Encryption] Invalid base64 ciphertext.');
  }

  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error(
      '[Encryption] Malformed ciphertext. Expected format: "iv:authTag:ciphertext".',
    );
  }

  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedBuffer = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

// ---------------------------------------------------------------------------
// hashSensitiveData
// ---------------------------------------------------------------------------

/**
 * Produces a one-way SHA-256 hash of sensitive data for use in audit logs.
 * The hash is hex-encoded and not reversible.
 *
 * @example
 * const hash = hashSensitiveData(userEmail);
 * await db.auditLog.create({ data: { emailHash: hash, ... } });
 */
export function hashSensitiveData(data: string): string {
  if (typeof data !== 'string') {
    throw new TypeError('[Encryption] hashSensitiveData() requires a string argument.');
  }

  const salt = process.env.HASH_SALT ?? 'mindguard_default_salt_change_in_prod';
  return createHash('sha256').update(`${salt}:${data}`).digest('hex');
}

// ---------------------------------------------------------------------------
// generateSecureToken
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically secure URL-safe random token.
 *
 * @param length - Number of bytes of entropy (default 32 = 256-bit token)
 * @returns A hex-encoded token string of length `length * 2`
 */
export function generateSecureToken(length = 32): string {
  if (typeof length !== 'number' || length < 1 || length > 512) {
    throw new RangeError('[Encryption] generateSecureToken() length must be between 1 and 512.');
  }
  return randomBytes(length).toString('hex');
}

// ---------------------------------------------------------------------------
// encryptIfEnabled / decryptIfEnabled
// ---------------------------------------------------------------------------

/**
 * Conditionally encrypts a value only when ENABLE_FIELD_ENCRYPTION=true.
 * This allows toggling encryption without changing call sites.
 */
export function encryptIfEnabled(text: string): string {
  if (process.env.ENABLE_FIELD_ENCRYPTION !== 'true') return text;
  return encrypt(text);
}

/**
 * Conditionally decrypts a value only when ENABLE_FIELD_ENCRYPTION=true.
 * Returns the original string if encryption is disabled.
 */
export function decryptIfEnabled(text: string): string {
  if (process.env.ENABLE_FIELD_ENCRYPTION !== 'true') return text;
  try {
    return decrypt(text);
  } catch {
    // If decryption fails (e.g., the value was stored before encryption was enabled),
    // return the raw value to avoid data loss during migration.
    return text;
  }
}
