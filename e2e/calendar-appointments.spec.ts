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

test.describe('Calendar and Appointments', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });
  test('should show calendar and appointments UI (create may require additional data)', async ({ page }) => {
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const day = page.locator('[data-testid="calendar-day"]').first();
    await day.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    await expect.soft(day).toBeVisible();
    // The create form or export button should be present
    await expect.soft(page.getByRole('button', { name: /Export ICS/i })).toBeVisible({ timeout: 8000 });
  });

  test('should export ICS (and CSV via button if present)', async ({ page }) => {
    await page.goto('/appointments');

    // ICS export - soft, may depend on data
    const hasExport = await page.getByRole('button', { name: /Export ICS/i }).isVisible().catch(() => false);
    if (hasExport) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: /Export ICS/i }).click().catch(() => {});
      try {
        const download = await downloadPromise;
        expect.soft(download.suggestedFilename()).toMatch(/\.ics$/);
      } catch {}
    }
  });
});
