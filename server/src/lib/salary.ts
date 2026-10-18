import type { Prisma, SalaryHistory } from '@prisma/client';
import { monthStart, type YearMonth } from './dates';

/**
 * Salary policy: a salary record always takes effect from the FIRST DAY of a
 * calendar month (effectiveFrom). The salary applicable to a reporting month is
 * the record with the latest effectiveFrom <= first day of that month.
 * A change entered for October therefore applies to the whole of October; past
 * months keep using the older record, so historical reports stay reproducible.
 * Only one record per employee per month is allowed (unique constraint), so
 * periods can never overlap. effectiveTo is derived and kept in sync here.
 */
export function applicableSalary(
  history: Pick<SalaryHistory, 'effectiveFrom' | 'monthlySalary'>[],
  ym: YearMonth,
): number | null {
  const start = monthStart(ym).getTime();
  let best: { from: number; salary: number } | null = null;
  for (const h of history) {
    const from = h.effectiveFrom.getTime();
    if (from <= start && (!best || from > best.from)) {
      best = { from, salary: h.monthlySalary };
    }
  }
  return best ? best.salary : null;
}

/** Recomputes effectiveTo for all salary periods of an employee. Run inside a transaction. */
export async function recomputeSalaryPeriods(tx: Prisma.TransactionClient, employeeId: number) {
  const rows = await tx.salaryHistory.findMany({
    where: { employeeId },
    orderBy: { effectiveFrom: 'asc' },
  });
  for (let i = 0; i < rows.length; i++) {
    const next = rows[i + 1];
    const effectiveTo = next ? new Date(next.effectiveFrom.getTime() - 24 * 3600 * 1000) : null;
    if ((rows[i].effectiveTo?.getTime() ?? null) !== (effectiveTo?.getTime() ?? null)) {
      await tx.salaryHistory.update({ where: { id: rows[i].id }, data: { effectiveTo } });
    }
  }
}

/** Creates or updates the salary record that starts in the given month. */
export async function upsertSalary(
  tx: Prisma.TransactionClient,
  employeeId: number,
  ym: YearMonth,
  monthlySalary: number,
) {
  const effectiveFrom = monthStart(ym);
  const record = await tx.salaryHistory.upsert({
    where: { employeeId_effectiveFrom: { employeeId, effectiveFrom } },
    create: { employeeId, effectiveFrom, monthlySalary },
    update: { monthlySalary },
  });
  await recomputeSalaryPeriods(tx, employeeId);
  return record;
}
