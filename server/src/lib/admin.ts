import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';

export const USERNAME_RE = /^[a-z0-9._@-]{3,100}$/;

export async function createAdmin(username: string, password: string) {
  const normalized = username.trim().toLowerCase();
  if (!USERNAME_RE.test(normalized)) {
    throw new Error('Username must be 3-100 chars: a-z, 0-9, . _ @ -');
  }
  if (password.length < 8) throw new Error('Password must be at least 8 characters');
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.create({ data: { username: normalized, passwordHash } });
}

/** Creates the first admin from ADMIN_USERNAME/ADMIN_PASSWORD only when no user exists. */
export async function bootstrapAdmin(username?: string, password?: string) {
  if (!username || !password) return;
  const count = await prisma.user.count();
  if (count > 0) return;
  await createAdmin(username, password);
  console.log(`Initial administrator "${username.trim().toLowerCase()}" created.`);
}
