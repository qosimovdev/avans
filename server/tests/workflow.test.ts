import { beforeEach, describe, expect, it } from 'vitest';
import { currentYearMonth, formatMonth, addMonths } from '../src/lib/dates';
import { login, resetDb } from './helpers';

beforeEach(resetDb);

const cur = currentYearMonth();
const curKey = formatMonth(cur);
const prevKey = formatMonth(addMonths(cur, -1));
const day = (key: string, d: number) => `${key}-${String(d).padStart(2, '0')}`;

async function createAli(s: Awaited<ReturnType<typeof login>>, start = day(prevKey, 1)) {
  const res = await s
    .post('/api/employees', {
      fullName: 'Ali Valiyev',
      phone: '+998 90 123 45 67',
      position: 'Haydovchi',
      employmentStartDate: start,
      monthlySalary: 5000000,
    })
    .expect(201);
  return res.body;
}

async function reportRow(s: Awaited<ReturnType<typeof login>>, key: string, employeeId: number) {
  const [year, month] = key.split('-').map(Number);
  const res = await s.get(`/api/reports/monthly?year=${year}&month=${month}`).expect(200);
  return {
    row: res.body.rows.find((r: { employeeId: number }) => r.employeeId === employeeId),
    body: res.body,
  };
}

describe('core salary/advance workflow', () => {
  it('matches the specified Ali Valiyev scenario', async () => {
    const s = await login();
    const ali = await createAli(s);
    expect(ali.currentSalary).toBe(5000000);

    const detail = await s.get(`/api/employees/${ali.id}`).expect(200);
    expect(detail.body.currentSalary).toBe(5000000);

    await s.post('/api/advances', { employeeId: ali.id, amount: 500000, date: day(curKey, 2) }).expect(201);
    let { row } = await reportRow(s, curKey, ali.id);
    expect(row).toMatchObject({ monthlySalary: 5000000, totalAdvances: 500000, remainingSalary: 4500000 });

    const second = await s
      .post('/api/advances', { employeeId: ali.id, amount: 700000, date: day(curKey, 3), note: 'Ikkinchi' })
      .expect(201);
    ({ row } = await reportRow(s, curKey, ali.id));
    expect(row).toMatchObject({ totalAdvances: 1200000, remainingSalary: 3800000, advancePercentage: 24 });

    await s
      .put(`/api/advances/${second.body.id}`, { employeeId: ali.id, amount: 1000000, date: day(curKey, 3) })
      .expect(200);
    ({ row } = await reportRow(s, curKey, ali.id));
    expect(row).toMatchObject({ totalAdvances: 1500000, remainingSalary: 3500000 });

    await s.del(`/api/advances/${second.body.id}`).expect(204);
    ({ row } = await reportRow(s, curKey, ali.id));
    expect(row).toMatchObject({ totalAdvances: 500000, remainingSalary: 4500000 });

    // previous month advance must not leak into current month
    await s.post('/api/advances', { employeeId: ali.id, amount: 300000, date: day(prevKey, 28) }).expect(201);
    ({ row } = await reportRow(s, curKey, ali.id));
    expect(row.totalAdvances).toBe(500000);
    const prev = await reportRow(s, prevKey, ali.id);
    expect(prev.row).toMatchObject({ totalAdvances: 300000, remainingSalary: 4700000 });

    const dash = await s.get(`/api/dashboard/stats?year=${cur.year}&month=${cur.month}`).expect(200);
    expect(dash.body.cards).toMatchObject({
      activeEmployees: 1,
      totalSalary: 5000000,
      totalAdvances: 500000,
      totalRemaining: 4500000,
    });
    expect(dash.body.chart).toHaveLength(6);
    expect(dash.body.topAdvances[0].fullName).toBe('Ali Valiyev');

    const list = await s.get(`/api/advances?month=${curKey}`).expect(200);
    expect(list.body.totalAmount).toBe(500000);
    expect(list.body.total).toBe(1);
  });

  it('shows negative remaining salary without clamping', async () => {
    const s = await login();
    const ali = await createAli(s);
    await s.post('/api/advances', { employeeId: ali.id, amount: 6000000, date: day(curKey, 1) }).expect(201);
    const { row } = await reportRow(s, curKey, ali.id);
    expect(row.remainingSalary).toBe(-1000000);
    expect(row.advancePercentage).toBe(120);
  });

  it('keeps historical salary periods reproducible', async () => {
    const s = await login();
    const ali = await createAli(s);
    // raise salary from current month
    await s
      .put(`/api/employees/${ali.id}`, {
        fullName: 'Ali Valiyev',
        employmentStartDate: day(prevKey, 1),
        monthlySalary: 6000000,
        salaryEffectiveMonth: curKey,
      })
      .expect(200);
    expect((await reportRow(s, prevKey, ali.id)).row.monthlySalary).toBe(5000000);
    expect((await reportRow(s, curKey, ali.id)).row.monthlySalary).toBe(6000000);

    const hist = await s.get(`/api/employees/${ali.id}/salary-history`).expect(200);
    expect(hist.body.items).toHaveLength(2);
    const [latest, first] = hist.body.items;
    expect(latest).toMatchObject({
      effectiveFrom: day(curKey, 1),
      effectiveTo: null,
      monthlySalary: 6000000,
    });
    expect(first.effectiveTo).not.toBeNull();
    expect(first.effectiveTo < latest.effectiveFrom).toBe(true);

    // re-saving the same month updates instead of overlapping
    await s
      .post(`/api/employees/${ali.id}/salary-history`, { monthlySalary: 6500000, effectiveMonth: curKey })
      .expect(201);
    const hist2 = await s.get(`/api/employees/${ali.id}/salary-history`).expect(200);
    expect(hist2.body.items).toHaveLength(2);
    expect(hist2.body.items[0].monthlySalary).toBe(6500000);

    // cannot start before employment
    await s
      .post(`/api/employees/${ali.id}/salary-history`, {
        monthlySalary: 1,
        effectiveMonth: formatMonth(addMonths(cur, -12)),
      })
      .expect(400);

    // cannot delete first period; can delete later one
    await s.del(`/api/employees/${ali.id}/salary-history/${first.id}`).expect(400);
    await s.del(`/api/employees/${ali.id}/salary-history/${latest.id}`).expect(204);
    expect((await reportRow(s, curKey, ali.id)).row.monthlySalary).toBe(5000000);
  });

  it('inactive employees keep their history and cannot get new advances', async () => {
    const s = await login();
    const ali = await createAli(s);
    const adv = await s
      .post('/api/advances', { employeeId: ali.id, amount: 100000, date: day(curKey, 1) })
      .expect(201);
    await s.patch(`/api/employees/${ali.id}/status`, { isActive: false }).expect(200);
    await s.post('/api/advances', { employeeId: ali.id, amount: 100000, date: day(curKey, 1) }).expect(400);
    // editing existing advance of an inactive employee is allowed
    await s
      .put(`/api/advances/${adv.body.id}`, { employeeId: ali.id, amount: 200000, date: day(curKey, 1) })
      .expect(200);
    const all = await s
      .get(`/api/reports/monthly?year=${cur.year}&month=${cur.month}&status=inactive`)
      .expect(200);
    expect(all.body.rows).toHaveLength(1);
    const active = await s
      .get(`/api/reports/monthly?year=${cur.year}&month=${cur.month}&status=active`)
      .expect(200);
    expect(active.body.rows).toHaveLength(0);
    const list = await s.get('/api/employees?status=inactive').expect(200);
    expect(list.body.total).toBe(1);
  });
});

describe('validation', () => {
  it('rejects invalid employees and advances', async () => {
    const s = await login();
    let res = await s
      .post('/api/employees', { fullName: '', employmentStartDate: 'x', monthlySalary: -5 })
      .expect(400);
    expect(Object.keys(res.body.error.fields)).toEqual(
      expect.arrayContaining(['fullName', 'employmentStartDate', 'monthlySalary']),
    );
    const ali = await createAli(s);
    res = await s.post('/api/advances', { employeeId: ali.id, amount: 0, date: day(curKey, 1) }).expect(400);
    expect(res.body.error.fields.amount).toBe('Summa musbat boʻlishi kerak');
    await s.post('/api/advances', { employeeId: ali.id, amount: -1, date: day(curKey, 1) }).expect(400);
    await s.post('/api/advances', { employeeId: ali.id, amount: 1.5, date: day(curKey, 1) }).expect(400);
    await s.post('/api/advances', { employeeId: ali.id, amount: 100, date: '2026-02-30' }).expect(400);
    await s.post('/api/advances', { employeeId: 999999, amount: 100, date: day(curKey, 1) }).expect(400);
    await s
      .put('/api/advances/999999', { employeeId: ali.id, amount: 100, date: day(curKey, 1) })
      .expect(404);
    await s.get('/api/employees/999999').expect(404);
    await s.get('/api/employees/abc').expect(400);
    await s.get('/api/advances?from=2026-05-10&to=2026-05-01').expect(400);
    await s.get('/api/reports/monthly?month=13').expect(400);
  });

  it('searches, filters, sorts and paginates', async () => {
    const s = await login();
    for (const [name, salary, phone] of [
      ['Bobur Aliyev', 3000000, '901111111'],
      ['Aziz Karimov', 7000000, '902222222'],
      ['Dilshod Qodirov', 4000000, null],
    ] as const) {
      await s
        .post('/api/employees', {
          fullName: name,
          phone,
          employmentStartDate: day(curKey, 1),
          monthlySalary: salary,
        })
        .expect(201);
    }
    let res = await s.get('/api/employees?search=aziz').expect(200);
    expect(res.body.items.map((e: { fullName: string }) => e.fullName)).toEqual(['Aziz Karimov']);
    res = await s.get('/api/employees?search=2222').expect(200);
    expect(res.body.total).toBe(1);
    res = await s.get('/api/employees?sort=salary_desc&pageSize=2&page=1').expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((e: { currentSalary: number }) => e.currentSalary)).toEqual([7000000, 4000000]);
    res = await s.get('/api/employees?sort=salary_desc&pageSize=2&page=2').expect(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('exports CSV', async () => {
    const s = await login();
    await createAli(s);
    const res = await s.get(`/api/reports/monthly.csv?year=${cur.year}&month=${cur.month}`).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Ali Valiyev');
    expect(res.text).toContain('5000000');
    expect(res.text).toContain('JAMI');
  });
});
