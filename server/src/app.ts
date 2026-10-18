import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './env';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { prisma } from './prisma';
import { advancesRouter } from './routes/advances';
import { authRouter } from './routes/auth';
import { dashboardRouter } from './routes/dashboard';
import { employeesRouter } from './routes/employees';
import { reportsRouter } from './routes/reports';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Requests without Origin (curl, health checks, same-origin) are allowed;
        // browsers always send Origin on cross-origin requests.
        if (!origin || env.corsOrigins.includes(origin.replace(/\/$/, ''))) cb(null, true);
        else cb(null, false);
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'ok', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'error', database: 'unreachable' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/employees', requireAuth, employeesRouter);
  app.use('/api/advances', requireAuth, advancesRouter);
  app.use('/api/reports', requireAuth, reportsRouter);
  app.use('/api/dashboard', requireAuth, dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
