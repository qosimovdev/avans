import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN, app, login, resetDb } from './helpers';

beforeEach(resetDb);

describe('auth', () => {
  it('health check works without auth', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('rejects wrong credentials with 401 and Uzbek message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' })
      .expect(401);
    expect(res.body.error.message).toBe('Login yoki parol notoʻgʻri');
  });

  it('validates login body', async () => {
    const res = await request(app).post('/api/auth/login').send({}).expect(400);
    expect(res.body.error.fields.username).toBeDefined();
  });

  it('sets an HttpOnly session cookie and returns csrf token', async () => {
    const res = await request(app).post('/api/auth/login').send(ADMIN).expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/ish_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.body.csrfToken).toHaveLength(64);
    expect(res.body.user.username).toBe('admin');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('protects endpoints', async () => {
    for (const url of [
      '/api/employees',
      '/api/advances',
      '/api/reports/monthly',
      '/api/dashboard/stats',
      '/api/auth/me',
    ]) {
      await request(app).get(url).expect(401);
    }
  });

  it('requires CSRF token for mutations', async () => {
    const s = await login();
    await s.agent.post('/api/employees').send({ fullName: 'X' }).expect(403);
    await s.agent.post('/api/employees').set('X-CSRF-Token', 'bad').send({ fullName: 'X' }).expect(403);
  });

  it('me and logout', async () => {
    const s = await login();
    const me = await s.get('/api/auth/me').expect(200);
    expect(me.body.csrfToken).toBe(s.csrf);
    await s.post('/api/auth/logout').expect(200);
    await s.get('/api/auth/me').expect(401);
  });

  it('changes password', async () => {
    const s = await login();
    await s.put('/api/auth/password', { currentPassword: 'nope', newPassword: 'another-pass-1' }).expect(400);
    await s.put('/api/auth/password', { currentPassword: ADMIN.password, newPassword: 'short' }).expect(400);
    await s
      .put('/api/auth/password', { currentPassword: ADMIN.password, newPassword: 'another-pass-1' })
      .expect(200);
    await request(app).post('/api/auth/login').send(ADMIN).expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'another-pass-1' })
      .expect(200);
  });
});
