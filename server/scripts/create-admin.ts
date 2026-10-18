/**
 * Creates (or resets the password of) an administrator.
 *   npm run admin:create -- <username>
 * The password is read from ADMIN_PASSWORD or prompted interactively (hidden).
 * Use --reset to change the password of an existing user.
 */
import { createInterface } from 'node:readline';
import bcrypt from 'bcryptjs';
import { createAdmin } from '../src/lib/admin';
import { prisma } from '../src/prisma';

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    out._writeToOutput = (s: string) => {
      if (!muted) out.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const username = (args.find((a) => !a.startsWith('--')) ?? process.env.ADMIN_USERNAME ?? '')
    .trim()
    .toLowerCase();
  if (!username) {
    console.error('Usage: npm run admin:create -- <username> [--reset]');
    process.exit(1);
  }
  const password = process.env.ADMIN_PASSWORD || (await promptHidden('Password (min 8 chars): '));
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    if (!reset) {
      console.error(`User "${username}" already exists. Use --reset to change the password.`);
      process.exit(1);
    }
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log(`Password for "${username}" updated.`);
  } else {
    await createAdmin(username, password);
    console.log(`Administrator "${username}" created.`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
