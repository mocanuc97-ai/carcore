import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const credsPath = path.join(__dirname, '.auth/creds.json');
const creds = fs.existsSync(credsPath) ? JSON.parse(fs.readFileSync(credsPath, 'utf8')) : null;

async function ensureLoggedIn(page: Page) {
  if (page.url().includes('/login') || !(await page.getByText(/CarCore/i).isVisible().catch(() => false))) {
    await page.goto('/login');
    if (creds) {
      await page.locator('input[type="email"]').fill(creds.email);
      await page.locator('input[type="password"]').fill(creds.password);
      await page.getByRole('button', { name: /Intră în cont/i }).click();
      await page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
    }
  }
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Interventions, Photos and Parts from Distributors', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });
  test('should show interventions page and forms', async ({ page }) => {
    await page.goto('/interventions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const sel = page.locator('select').first();
    await sel.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    await expect.soft(sel).toBeVisible();
    // File input for photos and save button
    await expect.soft(page.locator('input[type="file"]')).toBeVisible({ timeout: 8000 });
  });
});
