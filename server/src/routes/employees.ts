import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async';
import {
  addMonths,
  currentYearMonth,
  formatDateOnly,
  formatMonth,
  monthStart,
  nextMonthStart,
  toYearMonth,
  type YearMonth,
} from '../lib/dates';
import { badRequest, notFound } from '../lib/http-error';
import { percentage } from '../lib/report';
import { applicableSalary, recomputeSalaryPeriods, upsertSalary } from '../lib/salary';
import {
  dateSchema,
  idParam,
  monthSchema,
  optionalText,
  paginationSchema,
  salarySchema,
} from '../lib/validation';
import { prisma } from '../prisma';

export const employeesRouter = Router();

const phoneSchema = z
  .string()
  .trim()
  .max(30, 'Telefon raqami juda uzun')
  .regex(/^[+\d\s()-]*$/, 'Telefon raqami notoʻgʻri')
  .nullish()
  .transform((v) => (v ? v : null));

const employeeBase = z.object({
  fullName: z
    .string({ required_error: 'F.I.Sh. kiritilishi shart' })
    .trim()
    .min(2, 'F.I.Sh. kamida 2 belgidan iborat boʻlishi kerak')
    .max(150, 'F.I.Sh. juda uzun'),
  phone: phoneSchema,
  position: optionalText(100),
  employmentStartDate: dateSchema,
  isActive: z.boolean().default(true),
  notes: optionalText(1000),
  monthlySalary: salarySchema,
});

const createSchema = employeeBase;
const updateSchema = employeeBase.extend({
  /** Month (YYYY-MM) from which a changed salary applies. Defaults to the current month. */
  salaryEffectiveMonth: monthSchema.optional(),
});

const listQuery = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  sort: z
    .enum(['name_asc', 'name_desc', 'salary_desc', 'salary_asc', 'start_desc', 'start_asc', 'created_desc'])
    .default('name_asc'),
});

type EmployeeWithSalary = Prisma.EmployeeGetPayload<{
  include: { salaryHistory: { select: { effectiveFrom: true; monthlySalary: true } } };
}>;

function serializeEmployee(e: Omit<EmployeeWithSalary, 'salaryHistory'>, currentSalary: number | null) {
  return {
    id: e.id,
    fullName: e.fullName,
    phone: e.phone,
    position: e.position,
    employmentStartDate: formatDateOnly(e.employmentStartDate),
    isActive: e.isActive,
    notes: e.notes,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    currentSalary,
  };
}

function serializeSalary(s: {
  id: number;
  monthlySalary: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
}) {
  return {
    id: s.id,
    monthlySalary: s.monthlySalary,
    effectiveFrom: formatDateOnly(s.effectiveFrom),
    effectiveTo: s.effectiveTo ? formatDateOnly(s.effectiveTo) : null,
    effectiveMonth: formatMonth(toYearMonth(s.effectiveFrom)),
    createdAt: s.createdAt,
  };
}

async function getEmployeeOr404(id: number) {
  const e = await prisma.employee.findUnique({ where: { id } });
  if (!e) throw notFound('Xodim');
  return e;
}

/** Lightweight list for select inputs. */
employeesRouter.get(
  '/options',
  asyncHandler(async (_req, res) => {
    const items = await prisma.employee.findMany({
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, isActive: true, position: true },
    });
    res.json({ items });
  }),
);

employeesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const where: Prisma.EmployeeWhereInput = {};
    if (q.status !== 'all') where.isActive = q.status === 'active';
    if (q.search) {
      const digits = q.search.replace(/\D/g, '');
      where.OR = [
        { fullName: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search } },
        ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : []),
      ];
    }
    const ym = currentYearMonth();
    // Employee count is small (tens to hundreds), so salary-aware sorting and
    // pagination are done in memory after DB filtering.
    const employees = await prisma.employee.findMany({
      where,
      include: {
        salaryHistory: {
          where: { effectiveFrom: { lte: monthStart(ym) } },
          select: { effectiveFrom: true, monthlySalary: true },
        },
      },
    });
    const rows = employees.map((e) => ({ e, salary: applicableSalary(e.salaryHistory, ym) }));
    const collator = new Intl.Collator('uz');
    const cmp: Record<typeof q.sort, (a: (typeof rows)[0], b: (typeof rows)[0]) => number> = {
      name_asc: (a, b) => collator.compare(a.e.fullName, b.e.fullName),
      name_desc: (a, b) => collator.compare(b.e.fullName, a.e.fullName),
      salary_desc: (a, b) => (b.salary ?? -1) - (a.salary ?? -1),
      salary_asc: (a, b) => (a.salary ?? -1) - (b.salary ?? -1),
      start_desc: (a, b) => b.e.employmentStartDate.getTime() - a.e.employmentStartDate.getTime(),
      start_asc: (a, b) => a.e.employmentStartDate.getTime() - b.e.employmentStartDate.getTime(),
      created_desc: (a, b) => b.e.createdAt.getTime() - a.e.createdAt.getTime(),
    };
    rows.sort((a, b) => cmp[q.sort](a, b) || a.e.id - b.e.id);
    const total = rows.length;
    const items = rows
      .slice((q.page - 1) * q.pageSize, q.page * q.pageSize)
      .map(({ e, salary }) => serializeEmployee(e, salary));
    res.json({ items, total, page: q.page, pageSize: q.pageSize });
  }),
);

employeesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const { monthlySalary, ...fields } = data;
    const employee = await prisma.$transaction(async (tx) => {
      const e = await tx.employee.create({ data: fields });
      await upsertSalary(tx, e.id, toYearMonth(e.employmentStartDate), monthlySalary);
      return e;
    });
    const ym = currentYearMonth();
    const current =
      monthStart(ym) >= monthStart(toYearMonth(employee.employmentStartDate)) ? monthlySalary : null;
    res.status(201).json(serializeEmployee(employee, current));
  }),
);

employeesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const e = await prisma.employee.findUnique({
      where: { id },
      include: { salaryHistory: { orderBy: { effectiveFrom: 'desc' } } },
    });
    if (!e) throw notFound('Xodim');
    const ym = currentYearMonth();
    const currentSalary = applicableSalary(e.salaryHistory, ym);
    const latest = e.salaryHistory[0] ?? null;
    res.json({
      ...serializeEmployee(e, currentSalary),
      latestSalary: latest ? serializeSalary(latest) : null,
      salaryHistory: e.salaryHistory.map(serializeSalary),
    });
  }),
);

employeesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const data = updateSchema.parse(req.body);
    const { monthlySalary, salaryEffectiveMonth, ...fields } = data;
    const existing = await prisma.employee.findUnique({
      where: { id },
      include: { salaryHistory: { orderBy: { effectiveFrom: 'asc' } } },
    });
    if (!existing) throw notFound('Xodim');

    const newStartYm = toYearMonth(fields.employmentStartDate);
    const oldStartYm = toYearMonth(existing.employmentStartDate);
    const startMonthChanged = formatMonth(newStartYm) !== formatMonth(oldStartYm);
    const first = existing.salaryHistory[0];

    let effYm: YearMonth = salaryEffectiveMonth ?? currentYearMonth();
    if (monthStart(effYm) < monthStart(newStartYm)) effYm = newStartYm;

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id }, data: fields });

      // Keep the first salary period aligned with the employment start month.
      if (startMonthChanged && first) {
        const conflicting = existing.salaryHistory.some(
          (s) => s.id !== first.id && s.effectiveFrom <= monthStart(newStartYm),
        );
        if (conflicting) {
          throw badRequest(
            'Ish boshlash sanasini bu oyga oʻzgartirib boʻlmaydi: undan oldin boshqa maosh davri mavjud',
          );
        }
        await tx.salaryHistory.update({
          where: { id: first.id },
          data: { effectiveFrom: monthStart(newStartYm) },
        });
        await recomputeSalaryPeriods(tx, id);
      }

      const history = await tx.salaryHistory.findMany({ where: { employeeId: id } });
      if (applicableSalary(history, effYm) !== monthlySalary) {
        await upsertSalary(tx, id, effYm, monthlySalary);
      }
    });

    const updated = await prisma.employee.findUniqueOrThrow({
      where: { id },
      include: { salaryHistory: { orderBy: { effectiveFrom: 'desc' } } },
    });
    res.json({
      ...serializeEmployee(updated, applicableSalary(updated.salaryHistory, currentYearMonth())),
      salaryHistory: updated.salaryHistory.map(serializeSalary),
    });
  }),
);

employeesRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { isActive } = z
      .object({ isActive: z.boolean({ required_error: 'Holat koʻrsatilishi shart' }) })
      .parse(req.body);
    await getEmployeeOr404(id);
    const e = await prisma.employee.update({ where: { id }, data: { isActive } });
    res.json(serializeEmployee(e, null));
  }),
);

employeesRouter.get(
  '/:id/salary-history',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    await getEmployeeOr404(id);
    const items = await prisma.salaryHistory.findMany({
      where: { employeeId: id },
      orderBy: { effectiveFrom: 'desc' },
    });
    res.json({ items: items.map(serializeSalary) });
  }),
);

const salaryBody = z.object({
  monthlySalary: salarySchema,
  effectiveMonth: monthSchema,
});

employeesRouter.post(
  '/:id/salary-history',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { monthlySalary, effectiveMonth } = salaryBody.parse(req.body);
    const e = await getEmployeeOr404(id);
    if (monthStart(effectiveMonth) < monthStart(toYearMonth(e.employmentStartDate))) {
      throw badRequest('Maosh ish boshlash oyidan oldin kuchga kira olmaydi', {
        fields: { effectiveMonth: 'Ish boshlash oyidan oldin boʻlishi mumkin emas' },
      });
    }
    const record = await prisma.$transaction((tx) => upsertSalary(tx, id, effectiveMonth, monthlySalary));
    const fresh = await prisma.salaryHistory.findUniqueOrThrow({ where: { id: record.id } });
    res.status(201).json(serializeSalary(fresh));
  }),
);

employeesRouter.delete(
  '/:id/salary-history/:salaryId',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const salaryId = z.coerce.number().int().positive().parse(req.params.salaryId);
    await prisma.$transaction(async (tx) => {
      const rows = await tx.salaryHistory.findMany({
        where: { employeeId: id },
        orderBy: { effectiveFrom: 'asc' },
      });
      const idx = rows.findIndex((r) => r.id === salaryId);
      if (idx === -1) throw notFound('Maosh yozuvi');
      if (rows.length === 1) throw badRequest('Yagona maosh yozuvini oʻchirib boʻlmaydi');
      if (idx === 0) throw badRequest('Birinchi maosh davrini oʻchirib boʻlmaydi, uni tahrirlang');
      await tx.salaryHistory.delete({ where: { id: salaryId } });
      await recomputeSalaryPeriods(tx, id);
    });
    res.status(204).end();
  }),
);

const advancesQuery = paginationSchema.extend({ month: monthSchema.optional() });

employeesRouter.get(
  '/:id/advances',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const q = advancesQuery.parse(req.query);
    await getEmployeeOr404(id);
    const where: Prisma.AdvanceWhereInput = { employeeId: id };
    if (q.month) where.date = { gte: monthStart(q.month), lt: nextMonthStart(q.month) };
    const [items, total, sum] = await Promise.all([
      prisma.advance.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.advance.count({ where }),
      prisma.advance.aggregate({ where, _sum: { amount: true } }),
    ]);
    res.json({
      items: items.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        amount: a.amount,
        date: formatDateOnly(a.date),
        note: a.note,
        createdAt: a.createdAt,
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalAmount: sum._sum.amount ?? 0,
    });
  }),
);

/** Month-by-month salary / advance / remaining calculation for one employee. */
employeesRouter.get(
  '/:id/monthly-summary',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { months } = z
      .object({ months: z.coerce.number().int().min(1).max(36).default(12) })
      .parse(req.query);
    const e = await prisma.employee.findUnique({
      where: { id },
      include: { salaryHistory: true },
    });
    if (!e) throw notFound('Xodim');
    const end = currentYearMonth();
    const startYm = addMonths(end, -(months - 1));
    const advances = await prisma.advance.findMany({
      where: { employeeId: id, date: { gte: monthStart(startYm), lt: nextMonthStart(end) } },
      select: { amount: true, date: true },
    });
    const byMonth = new Map<string, number>();
    for (const a of advances) {
      const key = formatMonth(toYearMonth(a.date));
      byMonth.set(key, (byMonth.get(key) ?? 0) + a.amount);
    }
    const items = [];
    for (let i = 0; i < months; i++) {
      const ym = addMonths(end, -i);
      const salary = applicableSalary(e.salaryHistory, ym);
      const key = formatMonth(ym);
      const totalAdvances = byMonth.get(key) ?? 0;
      if (salary === null && totalAdvances === 0) continue;
      items.push({
        month: key,
        monthlySalary: salary ?? 0,
        totalAdvances,
        remainingSalary: (salary ?? 0) - totalAdvances,
        advancePercentage: percentage(totalAdvances, salary ?? 0),
      });
    }
    res.json({ items });
  }),
);
