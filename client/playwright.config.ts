import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4100;
const WEB_PORT = 5273;
const E2E_DB =
  process.env.E2E_DATABASE_URL ?? 'postgresql://ish:ish@localhost:5432/ishhaqqi_e2e?schema=public';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'uz-UZ',
    timezoneId: 'Asia/Tashkent',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /workflow\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } },
    },
    {
      name: 'mobile',
      testMatch: /responsive\.spec\.ts/,
      dependencies: ['desktop'],
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: [
    {
      // Fresh isolated database for every run; first admin is bootstrapped from env.
      command: 'npx prisma migrate reset --force --skip-seed --skip-generate && npx tsx src/index.ts',
      cwd: '../server',
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        DATABASE_URL: E2E_DB,
        JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-0123456789',
        CORS_ORIGIN: `http://127.0.0.1:${WEB_PORT}`,
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'Admin12345',
      },
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      reuseExistingServer: false,
      env: { VITE_DEV_API_PROXY: `http://localhost:${API_PORT}` },
    },
  ],
});
