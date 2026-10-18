/**
 * All business dates (advance date, employment start, salary periods) are stored
 * as PostgreSQL DATE values. In JS they are represented as Date objects at UTC
 * midnight, so "2026-10-01" is always 2026-10-01 regardless of server timezone.
 * "Today" is resolved in the Asia/Tashkent timezone.
 */
export const TIMEZONE = 'Asia/Tashkent';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseDateOnly(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayInTashkent(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

export function currentYearMonth(): YearMonth {
  const [y, m] = todayInTashkent().split('-').map(Number);
  return { year: y, month: m };
}

export function parseMonth(value: string): YearMonth | null {
  if (!MONTH_RE.test(value)) return null;
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

export function formatMonth({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function monthStart({ year, month }: YearMonth): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/** First day of the following month (exclusive upper bound). */
export function nextMonthStart({ year, month }: YearMonth): Date {
  return new Date(Date.UTC(year, month, 1));
}

export function monthEnd(ym: YearMonth): Date {
  return new Date(nextMonthStart(ym).getTime() - 24 * 3600 * 1000);
}

export function toYearMonth(d: Date): YearMonth {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}
