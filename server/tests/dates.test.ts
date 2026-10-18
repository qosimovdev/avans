import { describe, expect, it } from 'vitest';
import { addMonths, monthEnd, parseDateOnly } from '../src/lib/dates';
import { applicableSalary } from '../src/lib/salary';
import { percentage } from '../src/lib/report';

describe('date & salary helpers', () => {
  it('parses only valid calendar dates', () => {
    expect(parseDateOnly('2026-02-28')?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(parseDateOnly('2026-02-30')).toBeNull();
    expect(parseDateOnly('26-1-1')).toBeNull();
  });
  it('handles month arithmetic', () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(monthEnd({ year: 2024, month: 2 }).toISOString().slice(0, 10)).toBe('2024-02-29');
  });
  it('picks the latest salary effective on or before the month', () => {
    const h = [
      { effectiveFrom: new Date('2026-01-01T00:00:00Z'), monthlySalary: 100 },
      { effectiveFrom: new Date('2026-05-01T00:00:00Z'), monthlySalary: 200 },
    ];
    expect(applicableSalary(h, { year: 2025, month: 12 })).toBeNull();
    expect(applicableSalary(h, { year: 2026, month: 4 })).toBe(100);
    expect(applicableSalary(h, { year: 2026, month: 5 })).toBe(200);
  });
  it('computes percentage safely', () => {
    expect(percentage(1200000, 5000000)).toBe(24);
    expect(percentage(0, 0)).toBe(0);
    expect(percentage(5, 0)).toBeNull();
  });
});
