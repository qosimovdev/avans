import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../env';
import { asyncHandler } from '../lib/async';
import { HttpError } from '../lib/http-error';
import { clearSession, issueSession, readSession, requireAuth } from '../middleware/auth';
import { prisma } from '../prisma';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: { message: 'Juda koʻp urinish. 15 daqiqadan soʻng qayta urinib koʻring' } },
});

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Login kiritilishi shart').max(100),
  password: z.string().min(1, 'Parol kiritilishi shart').max(200),
});

// Used to keep response time similar for unknown usernames
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpError(401, 'Login yoki parol notoʻgʻri');
    const csrfToken = issueSession(res, user.id);
    res.json({ user: { id: user.id, username: user.username }, csrfToken });
  }),
);

authRouter.post('/logout', (req, res) => {
  const session = readSession(req);
  if (session && req.get('x-csrf-token') !== session.csrf) {
    res.status(403).json({ error: { message: 'Xavfsizlik tokeni notoʻgʻri' } });
    return;
  }
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user, csrfToken: req.session!.csrf });
});

export const passwordSchema = z
  .string()
  .min(8, 'Parol kamida 8 belgidan iborat boʻlishi kerak')
  .max(200, 'Parol juda uzun');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Joriy parolni kiriting'),
  newPassword: passwordSchema,
});

authRouter.put(
  '/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new HttpError(400, 'Joriy parol notoʻgʻri', {
        fields: { currentPassword: 'Joriy parol notoʻgʻri' },
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    });
    const csrfToken = issueSession(res, user.id);
    res.json({ ok: true, csrfToken });
  }),
);
