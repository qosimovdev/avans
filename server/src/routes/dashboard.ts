import { Router } from 'express';
import { asyncHandler } from '../lib/async';
import {
  addMonths,
  currentYearMonth,
  formatDateOnly,
  formatMonth,
  monthStart,
  nextMonthStart,
} from '../lib/dates';
import { buildMonthlyReport } from '../lib/report';
import { yearMonthQuery } from '../lib/validation';
import { prisma } from '../prisma';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const q = yearMonthQuery.parse(req.query);
    const cur = currentYearMonth();
    const ym = { year: q.year ?? cur.year, month: q.month ?? cur.month };
    const from = monthStart(ym);
    const to = nextMonthStart(ym);

    const chartMonths = Array.from({ length: 6 }, (_, i) => addMonths(ym, i - 5));
    const [activeEmployees, activeReport, allReport, recent, chartReports] = await Promise.all([
      prisma.employee.count({ where: { isActive: true } }),
      buildMonthlyReport(ym, { status: 'active' }),
      buildMonthlyReport(ym, { status: 'all' }),
      prisma.advance.findMany({
        where: { date: { gte: from, lt: to } },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: 6,
        include: { employee: { select: { id: true, fullName: true } } },
      }),
      Promise.all(chartMonths.map((m) => buildMonthlyReport(m, { status: 'all' }))),
    ]);

    const topAdvances = [...allReport.rows]
      .filter((r) => r.totalAdvances > 0)
      .sort((a, b) => b.totalAdvances - a.totalAdvances)
      .slice(0, 5)
      .map((r) => ({
        employeeId: r.employeeId,
        fullName: r.fullName,
        totalAdvances: r.totalAdvances,
        advanceCount: r.advanceCount,
        monthlySalary: r.monthlySalary,
        advancePercentage: r.advancePercentage,
      }));

    res.json({
      period: { year: ym.year, month: ym.month, key: formatMonth(ym) },
      cards: {
        activeEmployees,
        totalSalary: activeReport.totals.totalSalary,
        totalAdvances: allReport.totals.totalAdvances,
        totalRemaining: activeReport.totals.totalRemaining,
      },
      recentAdvances: recent.map((a) => ({
        id: a.id,
        amount: a.amount,
        date: formatDateOnly(a.date),
        note: a.note,
        employee: a.employee,
      })),
      topAdvances,
      chart: chartReports.map((r) => ({
        month: r.period.key,
        totalSalary: r.totals.totalSalary,
        totalAdvances: r.totals.totalAdvances,
      })),
    });
  }),
);
