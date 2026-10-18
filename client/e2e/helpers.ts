import { expect, type Page } from '@playwright/test';

export const ADMIN = { username: 'admin', password: 'Admin12345' };

function tashkentToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export const today = tashkentToday();
export const curKey = today.slice(0, 7);
const [y, m] = curKey.split('-').map(Number);
const prevIdx = y * 12 + (m - 1) - 1;
export const prevKey = `${Math.floor(prevIdx / 12)}-${String((prevIdx % 12) + 1).padStart(2, '0')}`;

export async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Login').fill(ADMIN.username);
  await page.getByLabel('Parol', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Kirish' }).click();
  await expect(page.getByRole('heading', { name: 'Bosh sahifa' })).toBeVisible();
}

/** Money as rendered by the UI. */
export const som = (n: string) => `${n} so’m`;
