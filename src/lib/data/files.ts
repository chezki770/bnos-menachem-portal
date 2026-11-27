import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decryptBuffer, encryptBuffer } from '@/lib/store/crypto';
import { dataDir } from '@/lib/store/table';

/** Uploaded files are encrypted and kept in FILES_DIR (default <DATA_DIR>/files), never in the CSVs. */
function filesDir(): string {
  return path.resolve(process.env.FILES_DIR ?? path.join(dataDir(), 'files'));
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'];

export async function saveEncryptedFile(data: Buffer): Promise<string> {
  const key = `${randomUUID()}.bin`;
  await mkdir(filesDir(), { recursive: true });
  await writeFile(path.join(filesDir(), key), encryptBuffer(data), { mode: 0o600 });
  return key;
}

export async function readEncryptedFile(key: string): Promise<Buffer> {
  if (!/^[\w-]+\.bin$/.test(key)) throw new Error('Bad file key');
  return decryptBuffer(await readFile(path.join(filesDir(), key)));
}
