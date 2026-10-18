export const TIMEZONE = 'Asia/Tashkent';
export const CURRENCY = 'so’m';

export const MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

/** 5000000 -> "5 000 000" */
export function groupDigits(value: number | string): string {
  const s = String(value);
  const negative = s.startsWith('-');
  const digits = s.replace(/\D/g, '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return negative && digits ? `-${grouped}` : grouped;
}

/** 5000000 -> "5 000 000 so’m" (negative values keep their sign) */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${groupDigits(Math.trunc(value))} ${CURRENCY}`;
}

/** Compact money for chart axes: 12 500 000 -> "12,5 mln" */
export function formatMoneyShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1).replace('.', ',').replace(',0', '')} mlrd`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1).replace('.', ',').replace(',0', '')} mln`;
  if (abs >= 1e3) return `${Math.round(value / 1e3)} ming`;
  return String(value);
}

/** Free-form input -> integer so’m, or null when empty. */
export function parseAmount(input: string): number | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  return Number(digits);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`;
}

/** "2026-10-05" -> "05.10.2026" (date-only values are timezone independent) */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function todayTashkent(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export interface YearMonth {
  year: number;
  month: number;
}

export function currentYearMonth(): YearMonth {
  const [year, month] = todayTashkent().split('-').map(Number);
  return { year, month };
}

export function monthKey({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(key: string | null | undefined): YearMonth | null {
  if (!key || !/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return null;
  const [year, month] = key.split('-').map(Number);
  return { year, month };
}

export function monthLabel(ym: YearMonth | string): string {
  const v = typeof ym === 'string' ? parseMonthKey(ym) : ym;
  if (!v) return '';
  return `${MONTHS[v.month - 1]} ${v.year}`;
}

export function monthShortLabel(key: string): string {
  const v = parseMonthKey(key);
  if (!v) return key;
  return `${MONTHS[v.month - 1].slice(0, 3)} ${String(v.year).slice(2)}`;
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}
