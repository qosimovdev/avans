import { expect, test, type Page } from '@playwright/test';
import { ADMIN, curKey, login, prevKey, som } from './helpers';

test.describe.configure({ mode: 'serial' });

async function expectDetail(page: Page, advances: string, remaining: string) {
  await expect(page.getByTestId('detail-advances')).toHaveText(som(advances));
  await expect(page.getByTestId('detail-remaining')).toHaveText(som(remaining));
}

async function addAdvance(page: Page, amount: string, date: string, note = '') {
  await page.getByRole('button', { name: 'Avans berish' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Summa').fill(amount);
  await dialog.getByLabel('Sana').fill(date);
  if (note) await dialog.getByLabel('Izoh').fill(note);
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Avans qayd etildi').first()).toBeVisible();
  await expect(dialog).toBeHidden();
}

test('protected routes redirect to login and bad credentials are rejected', async ({ page }) => {
  await page.goto('/employees');
  await expect(page).toHaveURL(/\/login$/);
  const res = await page.request.get('/api/employees');
  expect(res.status()).toBe(401);
  await page.getByLabel('Login').fill(ADMIN.username);
  await page.getByLabel('Parol', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Kirish' }).click();
  await expect(page.getByRole('alert')).toHaveText('Login yoki parol notoʻgʻri');
  await page.getByLabel('Parol', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Kirish' }).click();
  await expect(page).toHaveURL(/\/employees$/);
});

test('full salary & advance workflow', async ({ page }) => {
  await login(page);
  await page.screenshot({ path: 'test-results/shots/01-dashboard-empty.png', fullPage: true });

  // Create employee with salary
  await page.getByRole('link', { name: 'Xodimlar' }).click();
  await expect(page).toHaveURL(/\/employees$/);
  await page.getByRole('button', { name: 'Xodim qoʻshish' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(dialog.getByText('F.I.Sh. kamida 2 belgidan iborat boʻlishi kerak')).toBeVisible();
  await expect(dialog.getByText('Oylik maoshni kiriting')).toBeVisible();
  await dialog.getByLabel('F.I.Sh.').fill('Ali Valiyev');
  await dialog.getByLabel('Telefon raqami').fill('+998 90 123 45 67');
  await dialog.getByLabel('Lavozim').fill('Haydovchi');
  const salary = dialog.getByLabel('Oylik maosh');
  await salary.pressSequentially('5000000');
  await expect(salary).toHaveValue('5 000 000');
  await dialog.getByLabel('Ish boshlagan sana').fill(`${prevKey}-01`);
  await page.screenshot({ path: 'test-results/shots/02-employee-form.png' });
  await dialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Xodim qoʻshildi').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ali Valiyev' })).toBeVisible();
  await expect(page.getByTestId('detail-salary')).toHaveText(som('5 000 000'));
  const detailUrl = page.url();

  // Reopen edit form: saved salary is shown
  await page.getByRole('button', { name: 'Tahrirlash' }).click();
  await expect(page.getByRole('dialog').getByLabel('Oylik maosh')).toHaveValue('5 000 000');
  await page.getByRole('dialog').getByRole('button', { name: 'Bekor qilish' }).click();

  // Invalid advance
  await page.getByRole('button', { name: 'Avans berish' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByRole('dialog').getByText('Summani kiriting')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Bekor qilish' }).click();

  // Advances
  await addAdvance(page, '500000', `${curKey}-01`, 'Birinchi avans');
  await expectDetail(page, '500 000', '4 500 000');
  await addAdvance(page, '700000', `${curKey}-02`, 'Ikkinchi avans');
  await expectDetail(page, '1 200 000', '3 800 000');
  await page.screenshot({ path: 'test-results/shots/03-employee-detail.png', fullPage: true });

  // Edit second advance (on the advances page)
  await page.getByRole('link', { name: 'Avanslar', exact: true }).click();
  await expect(page.getByTestId('advances-total')).toHaveText(`Jami: ${som('1 200 000')}`);
  const secondRow = page.getByTestId('advance-row').filter({ hasText: 'Ikkinchi avans' });
  await secondRow.getByRole('button', { name: 'Avansni tahrirlash' }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByLabel('Summa')).toHaveValue('700 000');
  await editDialog.getByLabel('Summa').fill('1000000');
  await editDialog.getByRole('button', { name: 'Saqlash' }).click();
  await expect(page.getByText('Avans yangilandi').first()).toBeVisible();
  await expect(page.getByTestId('advances-total')).toHaveText(`Jami: ${som('1 500 000')}`);
  await page.screenshot({ path: 'test-results/shots/04-advances.png', fullPage: true });

  // Report reflects the edit
  await page.getByRole('link', { name: 'Hisobotlar' }).click();
  const row = page.getByTestId('report-row').filter({ hasText: 'Ali Valiyev' });
  await expect(row).toContainText(som('5 000 000'));
  await expect(row).toContainText(som('1 500 000'));
  await expect(row).toContainText(som('3 500 000'));
  await expect(row).toContainText('30%');

  // Delete second advance
  await page.getByRole('link', { name: 'Avanslar', exact: true }).click();
  await page
    .getByTestId('advance-row')
    .filter({ hasText: 'Ikkinchi avans' })
    .getByRole('button', { name: 'Avansni oʻchirish' })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Oʻchirish' }).click();
  await expect(page.getByText('Avans oʻchirildi').first()).toBeVisible();
  await expect(page.getByTestId('advances-total')).toHaveText(`Jami: ${som('500 000')}`);
  await expect(page.getByTestId('advance-row')).toHaveCount(1);

  await page.goto(detailUrl);
  await expectDetail(page, '500 000', '4 500 000');

  // Advance in previous month must not mix with current month
  await addAdvance(page, '300000', `${prevKey}-15`, 'Oldingi oy');
  await expectDetail(page, '500 000', '4 500 000');
  await page.goto(`/reports?month=${curKey}`);
  await expect(page.getByTestId('report-total-advances')).toHaveText(som('500 000'));
  await expect(page.getByTestId('report-total-remaining')).toHaveText(som('4 500 000'));
  await page.screenshot({ path: 'test-results/shots/05-report-current.png', fullPage: true });
  await page.getByRole('button', { name: 'Oldingi oy' }).click();
  await expect(page).toHaveURL(new RegExp(`month=${prevKey}`));
  await expect(page.getByTestId('report-total-advances')).toHaveText(som('300 000'));
  await expect(page.getByTestId('report-total-remaining')).toHaveText(som('4 700 000'));
  await page.goto(`/advances?month=${prevKey}`);
  await expect(page.getByTestId('advances-total')).toHaveText(`Jami: ${som('300 000')}`);

  // CSV export
  await page.goto(`/reports?month=${curKey}`);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`ish-haqqi-${curKey}.csv`);

  // Dashboard + persistence after reload
  await page.goto('/');
  await page.reload();
  await expect(page.getByTestId('stat-active')).toHaveText('1');
  await expect(page.getByTestId('stat-salary')).toHaveText(som('5 000 000'));
  await expect(page.getByTestId('stat-advances')).toHaveText(som('500 000'));
  await expect(page.getByTestId('stat-remaining')).toHaveText(som('4 500 000'));
  await expect(page.locator('.recharts-bar-rectangle path').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/shots/06-dashboard.png', fullPage: true });

  // Settings page works; logout protects routes again
  await page.getByRole('link', { name: 'Sozlamalar' }).click();
  await expect(page.getByRole('heading', { name: 'Parolni oʻzgartirish' })).toBeVisible();
  await page.getByRole('button', { name: 'Chiqish' }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/reports');
  await expect(page).toHaveURL(/\/login$/);
});
