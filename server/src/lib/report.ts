import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { formatDateOnly, formatMonth, monthEnd, monthStart, nextMonthStart, type YearMonth } from './dates';
import { applicableSalary } from './salary';

export type StatusFilter = 'all' | 'active' | 'inactive';

export interface ReportRow {
  employeeId: number;
  fullName: string;
  position: string | null;
  phone: string | null;
  isActive: boolean;
  monthlySalary: number;
  totalAdvances: number;
  advanceCount: number;
  remainingSalary: number;
  advancePercentage: number | null;
}

export interface MonthlyReport {
  period: { year: number; month: number; key: string; from: string; to: string };
  rows: ReportRow[];
  totals: {
    employees: number;
    totalSalary: number;
    totalAdvances: number;
    totalRemaining: number;
    advancePercentage: number | null;
  };
}

export function percentage(part: number, whole: number): number | null {
  if (whole <= 0) return part > 0 ? null : 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Authoritative monthly calculation:
 *   remainingSalary   = applicableMonthlySalary - totalAdvancesForSelectedMonth (may be negative)
 *   advancePercentage = totalAdvances / applicableMonthlySalary * 100 (null when salary is 0)
 * An employee appears in a month when a salary period applies to that month or
 * when they received an advance in that month.
 */
export async function buildMonthlyReport(
  ym: YearMonth,
  opts: { employeeId?: number; status?: StatusFilter } = {},
): Promise<MonthlyReport> {
  const from = monthStart(ym);
  const to = nextMonthStart(ym);
  const where: Prisma.EmployeeWhereInput = {};
  if (opts.employeeId) where.id = opts.employeeId;
  if (opts.status === 'active') where.isActive = true;
  if (opts.status === 'inactive') where.isActive = false;

  const [employees, advanceGroups] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { fullName: 'asc' },
      include: {
        salaryHistory: {
          where: { effectiveFrom: { lte: from } },
          select: { effectiveFrom: true, monthlySalary: true },
        },
      },
    }),
    prisma.advance.groupBy({
      by: ['employeeId'],
      where: {
        date: { gte: from, lt: to },
        ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const advMap = new Map(advanceGroups.map((g) => [g.employeeId, g]));
  const rows: ReportRow[] = [];
  for (const e of employees) {
    const salary = applicableSalary(e.salaryHistory, ym);
    const adv = advMap.get(e.id);
    const totalAdvances = adv?._sum.amount ?? 0;
    if (salary === null && totalAdvances === 0) continue;
    const monthlySalary = salary ?? 0;
    rows.push({
      employeeId: e.id,
      fullName: e.fullName,
      position: e.position,
      phone: e.phone,
      isActive: e.isActive,
      monthlySalary,
      totalAdvances,
      advanceCount: adv?._count._all ?? 0,
      remainingSalary: monthlySalary - totalAdvances,
      advancePercentage: percentage(totalAdvances, monthlySalary),
    });
  }

  const totalSalary = rows.reduce((s, r) => s + r.monthlySalary, 0);
  const totalAdvances = rows.reduce((s, r) => s + r.totalAdvances, 0);
  return {
    period: {
      year: ym.year,
      month: ym.month,
      key: formatMonth(ym),
      from: formatDateOnly(from),
      to: formatDateOnly(monthEnd(ym)),
    },
    rows,
    totals: {
      employees: rows.length,
      totalSalary,
      totalAdvances,
      totalRemaining: totalSalary - totalAdvances,
      advancePercentage: percentage(totalAdvances, totalSalary),
    },
  };
}

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let s = String(value);
  // Prevent spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string') s = `'${s}`;
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(report: MonthlyReport): string {
  const header = [
    'Xodim',
    'Lavozim',
    'Holat',
    'Oylik maosh (soʻm)',
    'Avanslar jami (soʻm)',
    'Qolgan ish haqi (soʻm)',
    'Avans foizi (%)',
  ];
  const lines = [header.map(csvCell).join(',')];
  for (const r of report.rows) {
    lines.push(
      [
        r.fullName,
        r.position,
        r.isActive ? 'Faol' : 'Nofaol',
        r.monthlySalary,
        r.totalAdvances,
        r.remainingSalary,
        r.advancePercentage,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  const t = report.totals;
  lines.push(
    ['JAMI', '', '', t.totalSalary, t.totalAdvances, t.totalRemaining, t.advancePercentage]
      .map(csvCell)
      .join(','),
  );
  // BOM so Excel opens UTF-8 correctly
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
