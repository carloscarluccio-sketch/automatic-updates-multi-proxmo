// AES-256-CBC encryption for sensitive data
import crypto from 'crypto';
import config from '../config/env';

const algorithm = 'aes-256-cbc';

// Validate and prepare encryption key
function getEncryptionKey(): Buffer {
  const keyString = config.ENCRYPTION_KEY;

  if (!keyString) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  const cleanKey = keyString.replace(/\s/g, '');

  // Key must be 32 bytes (64 hex characters) for AES-256
  let keyBuffer: Buffer;

  try {
    // Try to parse as hex
    if (cleanKey.length === 64 && /^[0-9a-fA-F]+$/.test(cleanKey)) {
      keyBuffer = Buffer.from(cleanKey, 'hex');
    } else {
      // If not valid hex, hash the string to get consistent 32 bytes
      keyBuffer = crypto.createHash('sha256').update(keyString).digest();
    }
  } catch (error) {
    // Fallback: hash the string to get consistent 32 bytes
    keyBuffer = crypto.createHash('sha256').update(keyString).digest();
  }

  if (keyBuffer.length !== 32) {
    throw new Error(`Encryption key must be 32 bytes. Got ${keyBuffer.length} bytes.`);
  }

  return keyBuffer;
}

let key: Buffer | null = null;

function ensureKey(): Buffer {
  if (!key) {
    key = getEncryptionKey();
  }
  return key;
}

export const encrypt = (text: string): string => {
  try {
    if (!text) {
      throw new Error('Cannot encrypt empty text');
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, ensureKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error: any) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
};

export const decrypt = (encryptedText: string): string => {
  if (!encryptedText) {
    throw new Error('Encrypted text is null or empty');
  }

  const parts = encryptedText.split(':');

  // If no colon, assume it's plaintext (legacy data)
  if (parts.length === 1) {
    return encryptedText;
  }

  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format. Expected format: iv:encrypted');
  }

  try {
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    if (iv.length !== 16) {
      throw new Error(`Invalid initialization vector length: ${iv.length}. Expected 16 bytes.`);
    }

    const decipher = crypto.createDecipheriv(algorithm, ensureKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error: any) {
    // If decryption fails, return the original text as fallback
    console.warn('Decryption failed, returning original text:', error.message);
    return encryptedText;
  }
};
