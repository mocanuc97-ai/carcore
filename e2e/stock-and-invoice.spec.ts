import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const credsPath = path.join(__dirname, '.auth/creds.json');
const creds = fs.existsSync(credsPath) ? JSON.parse(fs.readFileSync(credsPath, 'utf8')) : null;

async function ensureLoggedIn(page: any) {
  if (page.url().includes('/login') || !(await page.getByText(/CarCore/i).isVisible().catch(() => false))) {
    await page.goto('/login');
    if (creds) {
      await page.locator('input[type="email"]').fill(creds.email);
      await page.locator('input[type="password"]').fill(creds.password);
      await page.getByRole('button', { name: /Intră în cont/i }).click();
      await page.waitForURL(/dashboard/, { timeout: 15000 }).catch(() => {});
    }
  }
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Parts Stock and Invoicing Edges', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });
  test('should show parts inventory and invoice forms and record purchase', async ({ page }) => {
    await page.goto('/dashboard/parts-inventory');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const partName = `E2E Part ${Date.now()}`;
    await page.locator('input[name="name"]').fill(partName);
    await page.locator('input[name="distributor"]').fill('TestDist');
    await page.locator('input[name="qty"]').fill('3');
    await page.locator('input[name="price"]').fill('100');
    await page.getByRole('button', { name: /Adaugă la stoc/i }).click();

    await expect.soft(page.getByText(partName)).toBeVisible({ timeout: 10000 });

    await page.goto('/dashboard/invoices/new');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.locator('select[name="client_id"]').waitFor({ state: 'attached', timeout: 10000 });
  });
});
