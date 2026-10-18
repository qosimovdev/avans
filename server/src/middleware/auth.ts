import crypto from 'node:crypto';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env';
import { HttpError } from '../lib/http-error';
import { prisma } from '../prisma';

export const SESSION_COOKIE = 'ish_session';

interface SessionPayload {
  sub: number;
  csrf: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: number; username: string };
    session?: SessionPayload;
  }
}

export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProd || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    path: '/',
    maxAge: env.SESSION_HOURS * 3600 * 1000,
  };
}

export function issueSession(res: Response, userId: number): string {
  const csrf = crypto.randomBytes(32).toString('hex');
  const token = jwt.sign({ sub: userId, csrf }, env.JWT_SECRET, {
    expiresIn: `${env.SESSION_HOURS}h`,
    algorithm: 'HS256',
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  return csrf;
}

export function clearSession(res: Response) {
  const { maxAge: _maxAge, ...opts } = cookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
}

export function readSession(req: Request): SessionPayload | null {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || typeof token !== 'string') return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string') return null;
    const sub = Number(payload.sub);
    if (!Number.isInteger(sub) || typeof payload.csrf !== 'string') return null;
    return { sub, csrf: payload.csrf };
  } catch {
    return null;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Requires a valid session cookie. State-changing requests must also send the
 * per-session CSRF token (returned by /auth/login and /auth/me) in X-CSRF-Token.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = readSession(req);
    if (!session) throw new HttpError(401, 'Tizimga kirish talab qilinadi');
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, username: true },
    });
    if (!user) throw new HttpError(401, 'Sessiya yaroqsiz. Qaytadan kiring');
    if (!SAFE_METHODS.has(req.method)) {
      const header = req.get('x-csrf-token');
      if (!header || !safeEqual(header, session.csrf)) {
        throw new HttpError(403, 'Xavfsizlik tokeni notoʻgʻri. Sahifani yangilang');
      }
    }
    req.user = user;
    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
}
