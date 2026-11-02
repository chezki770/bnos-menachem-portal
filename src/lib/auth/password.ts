import bcrypt from 'bcryptjs';

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Compared against when the email is unknown, so login timing doesn't reveal which emails exist.
export const DUMMY_HASH = '$2b$12$LxgvgGcFDXV7kRmgjDg7t.KQxsB8gDGoB4yDqHubIC4VzI5z4L7Kq';
