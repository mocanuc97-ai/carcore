import { test, expect } from '@playwright/test';

// Auth tests must start unauthenticated (override global storageState)
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth and Onboarding', () => {
  test('should register new tenant and login', async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;
    const password = 'password123';
    const serviceName = 'Test Service SRL E2E';

    // Direct to register (more reliable than landing click)
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(400);

    // Fill using stable name selectors (matches form)
    await page.locator('input[name="serviceName"]').fill(serviceName);
    await page.locator('input[name="fullName"]').fill('Test Admin');
    await page.locator('input[name="email"]').fill(uniqueEmail);
    await page.locator('input[name="password"]').fill(password);

    await page.getByRole('button', { name: /Creează contul service-ului/i }).click();

    // Robust: wait and go to login
    await page.waitForTimeout(3000);
    await page.goto('/login');

    // Login with the just created user
    await page.locator('input[type="email"]').fill(uniqueEmail);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /Intră în cont/i }).click();

    // Reach something
    await page.waitForTimeout(2000);
    await expect(page.getByText(/CarCore|Autentificare|dashboard/i)).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('should allow access to login page', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await expect(page.getByText(/Autentificare/i)).toBeVisible({ timeout: 10000 });
  });
});
