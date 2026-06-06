import CryptoJS from 'crypto-js';

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required. Generate one with: openssl rand -base64 32',
    );
  }
  return key;
}

/** Encrypt sensitive string (Gmail tokens, etc.) */
export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, getEncryptionKey()).toString();
}

/** Decrypt sensitive string */
export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, getEncryptionKey());
  return bytes.toString(CryptoJS.enc.Utf8);
}

/** Encrypt JSON object (CMS credentials) */
export function encryptJson(payload: Record<string, unknown>): string {
  return encrypt(JSON.stringify(payload));
}

export function decryptJson<T extends Record<string, unknown>>(cipher: string): T {
  return JSON.parse(decrypt(cipher)) as T;
}
