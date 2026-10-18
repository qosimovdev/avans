process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://ish:ish@localhost:5432/ishhaqqi_test?schema=public';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.COOKIE_SAMESITE = 'lax';
