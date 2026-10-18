import { expect, test } from '@playwright/test';
import { login } from './helpers';

const PAGES = [
  { link: 'Bosh sahifa', heading: 'Bosh sahifa', path: '/' },
  { link: 'Xodimlar', heading: 'Xodimlar', path: '/employees' },
  { link: 'Avanslar', heading: 'Avanslar', path: '/advances' },
  { link: 'Hisobotlar', heading: 'Oylik hisobot', path: '/reports' },
  { link: 'Sozlamalar', heading: 'Sozlamalar', path: '/settings' },
];

test('mobile navigation and layout without horizontal overflow', async ({ page }) => {
  await login(page);
  for (const p of PAGES) {
    await page.getByRole('button', { name: 'Menyuni ochish' }).click();
    await page.getByRole('dialog').getByRole('link', { name: p.link }).click();
    await expect(page).toHaveURL(new RegExp(`${p.path === '/' ? '/$' : p.path}`));
    await expect(page.getByRole('heading', { name: p.heading, exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${p.path}`).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: `test-results/shots/mobile-${p.path === '/' ? 'dashboard' : p.path.slice(1)}.png`,
      fullPage: true,
    });
  }
  // Employee card list and advance dialog fit the screen
  await page.goto('/employees');
  await page.getByRole('link', { name: /Ali Valiyev/ }).click();
  await page.getByRole('button', { name: 'Avans berish' }).click();
  const vw = page.viewportSize()!.width;
  // Poll until the open animation settles, then verify the dialog fits horizontally.
  await expect
    .poll(async () => {
      const box = await page.getByRole('dialog').boundingBox();
      return box ? box.x >= 0 && box.x + box.width <= vw : false;
    })
    .toBe(true);
  await page.screenshot({ path: 'test-results/shots/mobile-advance-dialog.png' });
});
