import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async';
import { formatDateOnly, monthStart, nextMonthStart } from '../lib/dates';
import { badRequest, notFound } from '../lib/http-error';
import {
  amountSchema,
  dateSchema,
  idParam,
  monthSchema,
  optionalText,
  paginationSchema,
} from '../lib/validation';
import { prisma } from '../prisma';

export const advancesRouter = Router();

const bodySchema = z.object({
  employeeId: z.coerce
    .number({ required_error: 'Xodimni tanlang', invalid_type_error: 'Xodimni tanlang' })
    .int()
    .positive('Xodimni tanlang'),
  amount: amountSchema,
  date: dateSchema,
  note: optionalText(500),
});

const listQuery = paginationSchema
  .extend({
    employeeId: z.coerce.number().int().positive().optional(),
    month: monthSchema.optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    search: z.string().trim().max(100).optional(),
    sort: z.enum(['date_desc', 'date_asc', 'amount_desc', 'amount_asc']).default('date_desc'),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: 'Boshlanish sanasi tugash sanasidan keyin boʻlishi mumkin emas',
    path: ['from'],
  });

type AdvanceWithEmployee = Prisma.AdvanceGetPayload<{
  include: { employee: { select: { id: true; fullName: true; isActive: true } } };
}>;

function serialize(a: AdvanceWithEmployee) {
  return {
    id: a.id,
    employeeId: a.employeeId,
    employee: a.employee,
    amount: a.amount,
    date: formatDateOnly(a.date),
    note: a.note,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

const include = { employee: { select: { id: true, fullName: true, isActive: true } } } as const;

advancesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const where: Prisma.AdvanceWhereInput = {};
    if (q.employeeId) where.employeeId = q.employeeId;
    const dateFilter: Prisma.DateTimeFilter = {};
    if (q.month) {
      dateFilter.gte = monthStart(q.month);
      dateFilter.lt = nextMonthStart(q.month);
    }
    // Explicit date range narrows further (intersection with month if both are given)
    if (q.from && (!dateFilter.gte || q.from > (dateFilter.gte as Date))) dateFilter.gte = q.from;
    if (q.to) {
      const toExclusive = new Date(q.to.getTime() + 24 * 3600 * 1000);
      if (!dateFilter.lt || toExclusive < (dateFilter.lt as Date)) dateFilter.lt = toExclusive;
    }
    if (Object.keys(dateFilter).length) where.date = dateFilter;
    if (q.search) {
      where.OR = [
        { note: { contains: q.search, mode: 'insensitive' } },
        { employee: { fullName: { contains: q.search, mode: 'insensitive' } } },
      ];
    }
    const orderBy: Prisma.AdvanceOrderByWithRelationInput[] = {
      date_desc: [{ date: 'desc' }, { id: 'desc' }],
      date_asc: [{ date: 'asc' }, { id: 'asc' }],
      amount_desc: [{ amount: 'desc' }, { id: 'desc' }],
      amount_asc: [{ amount: 'asc' }, { id: 'asc' }],
    }[q.sort] as Prisma.AdvanceOrderByWithRelationInput[];

    const [items, total, sum] = await Promise.all([
      prisma.advance.findMany({
        where,
        include,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.advance.count({ where }),
      prisma.advance.aggregate({ where, _sum: { amount: true } }),
    ]);
    res.json({
      items: items.map(serialize),
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalAmount: sum._sum.amount ?? 0,
    });
  }),
);

advancesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const a = await prisma.advance.findUnique({ where: { id }, include });
    if (!a) throw notFound('Avans');
    res.json(serialize(a));
  }),
);

async function assertEmployee(employeeId: number, allowInactive: boolean) {
  const e = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!e) throw badRequest('Tanlangan xodim topilmadi', { fields: { employeeId: 'Xodim topilmadi' } });
  if (!e.isActive && !allowInactive) {
    throw badRequest('Nofaol xodimga avans berib boʻlmaydi', {
      fields: { employeeId: 'Xodim nofaol' },
    });
  }
}

advancesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = bodySchema.parse(req.body);
    await assertEmployee(data.employeeId, false);
    const a = await prisma.advance.create({ data, include });
    res.status(201).json(serialize(a));
  }),
);

advancesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const data = bodySchema.parse(req.body);
    const existing = await prisma.advance.findUnique({ where: { id } });
    if (!existing) throw notFound('Avans');
    await assertEmployee(data.employeeId, data.employeeId === existing.employeeId);
    const a = await prisma.advance.update({ where: { id }, data, include });
    res.json(serialize(a));
  }),
);

advancesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const existing = await prisma.advance.findUnique({ where: { id } });
    if (!existing) throw notFound('Avans');
    await prisma.advance.delete({ where: { id } });
    res.status(204).end();
  }),
);
