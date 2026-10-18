import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async';
import { currentYearMonth } from '../lib/dates';
import { buildMonthlyReport, reportToCsv } from '../lib/report';
import { yearMonthQuery } from '../lib/validation';

export const reportsRouter = Router();

const query = yearMonthQuery.extend({
  employeeId: z.coerce.number().int().positive().optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
});

function parse(q: unknown) {
  const p = query.parse(q);
  const cur = currentYearMonth();
  return {
    ym: { year: p.year ?? cur.year, month: p.month ?? cur.month },
    opts: { employeeId: p.employeeId, status: p.status },
  };
}

reportsRouter.get(
  '/monthly',
  asyncHandler(async (req, res) => {
    const { ym, opts } = parse(req.query);
    res.json(await buildMonthlyReport(ym, opts));
  }),
);

reportsRouter.get(
  '/monthly.csv',
  asyncHandler(async (req, res) => {
    const { ym, opts } = parse(req.query);
    const report = await buildMonthlyReport(ym, opts);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ish-haqqi-${report.period.key}.csv"`);
    res.send(reportToCsv(report));
  }),
);
