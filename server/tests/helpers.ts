import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/prisma';

export const app = createApp();
export const ADMIN = { username: 'admin', password: 'Secret-pass-123' };

export async function resetDb() {
  await prisma.advance.deleteMany();
  await prisma.salaryHistory.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({
    data: { username: ADMIN.username, passwordHash: await bcrypt.hash(ADMIN.password, 4) },
  });
}

/** Logged-in agent that automatically sends the CSRF header. */
export async function login() {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send(ADMIN).expect(200);
  const csrf: string = res.body.csrfToken;
  return {
    agent,
    csrf,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => agent.post(url).set('X-CSRF-Token', csrf).send(body),
    put: (url: string, body?: object) => agent.put(url).set('X-CSRF-Token', csrf).send(body),
    patch: (url: string, body?: object) => agent.patch(url).set('X-CSRF-Token', csrf).send(body),
    del: (url: string) => agent.delete(url).set('X-CSRF-Token', csrf),
  };
}
