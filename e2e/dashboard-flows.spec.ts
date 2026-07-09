import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const credsPath = path.join(__dirname, '.auth/creds.json');
const creds = fs.existsSync(credsPath) ? JSON.parse(fs.readFileSync(credsPath, 'utf8')) : null;

async function ensureLoggedIn(page: Page) {
  await page.goto('/login');
  if (creds) {
    await page.locator('input[type="email"]').fill(creds.email);
    await page.locator('input[type="password"]').fill(creds.password);
    await page.getByRole('button', { name: /Intră în cont/i }).click();

    await Promise.race([
      page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), { timeout: 8000 }).catch(() => {}),
      page.waitForTimeout(4000)
    ]);

    // Force the dashboard to ensure layout + sidebar is in DOM
    await page.goto('/');
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
}

test.describe('Dashboard and Core Flows', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });
  test('should visit main sections and see core forms (layout + pages render)', async ({ page }) => {
    // Direct visits (bypass ensures no auth 404)
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await expect.soft(page.locator('input[name="name"]')).toBeVisible({ timeout: 10000 }); // add client form

    await page.goto('/vehicles');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await expect.soft(page.getByText(/Adaugă mașină/i).first()).toBeVisible({ timeout: 10000 });

    await page.goto('/interventions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await expect.soft(page.locator('select').first()).toBeVisible({ timeout: 10000 });

    await page.goto('/parts-inventory');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await expect.soft(page.getByText(/Stoc Piese/i).first()).toBeVisible({ timeout: 10000 });

    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await expect.soft(page.getByText(/Programări/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should see add forms on clients and vehicles (data creation may be limited by RLS in test env)', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    // Use testids added to the form
    const clientName = `Test Client ${Date.now()}`;
    await page.getByTestId('client-name').fill(clientName);
    await page.getByTestId('client-phone').fill('0712345678');
    await page.getByTestId('add-client').click();

    // Expect the name appears in the list (soft for E2E env)
    await expect.soft(page.getByText(clientName)).toBeVisible({ timeout: 10000 });

    await page.goto('/vehicles');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await expect.soft(page.getByText(/Adaugă mașină/i).first()).toBeVisible({ timeout: 8000 });
  });
});
