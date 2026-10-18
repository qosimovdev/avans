import { z } from 'zod';
import { parseDateOnly, parseMonth } from './dates';

export const MAX_AMOUNT = 1_000_000_000;

export const amountSchema = z.coerce
  .number({ invalid_type_error: 'Summa raqam boʻlishi kerak' })
  .int('Summa butun son boʻlishi kerak')
  .positive('Summa musbat boʻlishi kerak')
  .max(MAX_AMOUNT, 'Summa juda katta');

export const salarySchema = z.coerce
  .number({ invalid_type_error: 'Maosh raqam boʻlishi kerak' })
  .int('Maosh butun son boʻlishi kerak')
  .min(0, 'Maosh manfiy boʻlishi mumkin emas')
  .max(MAX_AMOUNT, 'Maosh juda katta');

export const dateSchema = z
  .string({ required_error: 'Sana kiritilishi shart' })
  .refine((v) => parseDateOnly(v) !== null, 'Sana notoʻgʻri (YYYY-MM-DD)')
  .refine((v) => v >= '2000-01-01' && v <= '2100-12-31', 'Sana oraligʻi notoʻgʻri')
  .transform((v) => parseDateOnly(v)!);

export const monthSchema = z
  .string()
  .refine((v) => parseMonth(v) !== null, 'Oy notoʻgʻri (YYYY-MM)')
  .transform((v) => parseMonth(v)!);

export const idParam = z.object({
  id: z.coerce.number().int().positive('ID notoʻgʻri'),
});

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Matn ${max} belgidan oshmasligi kerak`)
    .nullish()
    .transform((v) => (v ? v : null));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const yearMonthQuery = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});
