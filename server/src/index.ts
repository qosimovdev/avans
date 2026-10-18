import { createApp } from './app';
import { env } from './env';
import { bootstrapAdmin } from './lib/admin';
import { prisma } from './prisma';

async function main() {
  await bootstrapAdmin(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`IshHaqqi API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
  const shutdown = () => {
    server.close(() => {
      prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err instanceof Error ? err.message : err);
  process.exit(1);
});
