import { execSync } from 'node:child_process';

export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgresql://ish:ish@localhost:5432/ishhaqqi_test?schema=public';
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
