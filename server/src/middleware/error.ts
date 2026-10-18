import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../env';
import { HttpError } from '../lib/http-error';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: 'Soʻralgan manzil topilmadi' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    res.status(400).json({
      error: { message: Object.values(fields)[0] ?? 'Notoʻgʻri maʼlumot', fields },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { message: err.message, details: err.details } });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: { message: 'Maʼlumot topilmadi' } });
      return;
    }
    if (err.code === 'P2002') {
      res.status(409).json({ error: { message: 'Bunday yozuv allaqachon mavjud' } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(400).json({ error: { message: 'Bogʻliq maʼlumot topilmadi' } });
      return;
    }
  }
  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.parse.failed'
  ) {
    res.status(400).json({ error: { message: 'Soʻrov tanasi notoʻgʻri JSON' } });
    return;
  }
  console.error(err);
  res.status(500).json({
    error: {
      message: 'Serverda kutilmagan xatolik yuz berdi',
      ...(env.isProd ? {} : { debug: err instanceof Error ? err.message : String(err) }),
    },
  });
}
