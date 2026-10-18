import { describe, expect, it } from 'vitest';
import {
  addMonths,
  formatDate,
  formatMoney,
  formatPercent,
  groupDigits,
  monthLabel,
  parseAmount,
} from '@/lib/format';

describe('money formatting', () => {
  it('groups digits with spaces', () => {
    expect(groupDigits(5000000)).toBe('5 000 000');
    expect(groupDigits('5000000')).toBe('5 000 000');
    expect(groupDigits(999)).toBe('999');
  });
  it('formats so’m including negatives', () => {
    expect(formatMoney(5000000)).toBe('5 000 000 so’m');
    expect(formatMoney(-1000000)).toBe('-1 000 000 so’m');
    expect(formatMoney(0)).toBe('0 so’m');
    expect(formatMoney(null)).toBe('—');
  });
  it('parses user input to integers', () => {
    expect(parseAmount('5 000 000')).toBe(5000000);
    expect(parseAmount('5000000')).toBe(5000000);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
  it('formats percentages, dates and months', () => {
    expect(formatPercent(24)).toBe('24%');
    expect(formatPercent(null)).toBe('—');
    expect(formatDate('2026-10-05')).toBe('05.10.2026');
    expect(monthLabel('2026-10')).toBe('Oktabr 2026');
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
});
