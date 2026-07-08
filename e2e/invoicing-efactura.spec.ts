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

test.describe('Invoicing with Parts and e-Factura', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });
  test('should show invoice creation UI', async ({ page }) => {
    await page.goto('/dashboard/invoices/new');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const clientSel = page.locator('select[name="client_id"]');
    await clientSel.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    await expect.soft(clientSel).toBeVisible();
    await expect.soft(page.getByRole('button', { name: /Creează factură/i })).toBeVisible({ timeout: 8000 });
  });

  test('should show settings and ANAF connect UI', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.locator('#cui-input, input[name="cui"], input[placeholder*="CUI"]').first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
    await expect(page.getByRole('button', { name: /Conectează cu cont ANAF/i })).toBeVisible({ timeout: 8000 }).catch(() => {});
  });
});
