import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for sensitive CSV cells (birth dates, phones, addresses) and uploaded files.
 * DATA_ENCRYPTION_KEY is 32 random bytes, base64 encoded: openssl rand -base64 32
 */
const PREFIX = 'enc:v1:';

function key(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  const buf = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (buf.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32)');
  }
  return buf;
}

export function encryptText(plain: string): string {
  if (plain === '') return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64')).join(':');
}

/** Decrypts an encrypted cell. Plain (unencrypted) values pass through, so hand-entered data still loads. */
export function decryptText(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const [iv, tag, ct] = value
    .slice(PREFIX.length)
    .split(':')
    .map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** File layout: 12-byte IV, 16-byte auth tag, ciphertext. */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

export function decryptBuffer(data: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]);
}

/** One-way hash for tokens stored at rest (invite / reset links). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
