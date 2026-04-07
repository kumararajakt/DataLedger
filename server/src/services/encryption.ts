import crypto from 'crypto';

/**
 * Derives a 32-byte AES key from AI_ENCRYPTION_KEY env var.
 * Accepts a 64-char hex string directly, or any string (SHA-256 hashed).
 */
function getKey(): Buffer {
  const raw = process.env.AI_ENCRYPTION_KEY ?? '';
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  // Derive 32 bytes via SHA-256 so any string works
  return crypto.createHash('sha256').update(raw || 'default-insecure-key-set-AI_ENCRYPTION_KEY').digest();
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a value produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv        = Buffer.from(ivHex, 'hex');
  const authTag   = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher  = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

/** Return a masked version of a key for display (e.g. "sk-A•••••1234"). */
export function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}
