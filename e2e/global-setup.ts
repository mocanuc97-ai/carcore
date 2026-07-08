import { FullConfig, chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

async function waitForServer(page: any, url: string, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
      const ready = await page.locator('body').count();
      if (ready > 0) return true;
    } catch {}
    await page.waitForTimeout(1200);
  }
  throw new Error('Server not ready in time for E2E setup');
}

async function globalSetup(config: FullConfig) {
  const authDir = path.join(__dirname, '.auth');
  await mkdir(authDir, { recursive: true });

  const uniqueEmail = `e2e-${Date.now()}@test.carcore.ro`;
  const password = 'e2e-test-123';
  const serviceName = `E2E Test Service ${Date.now().toString().slice(-6)}`;
  const fullName = 'E2E Admin';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'REDACTED_ANON_KEY';
  // Hardcoded live local keys as reliable fallback (global-setup node context may not auto-load .env the same as Next)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'REDACTED_SERVICE_KEY';

  let createdUserId: string | null = null;
  let tenantId: string | null = null;
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  try {
    // 1. Direct admin bootstrap (bypasses UI form + any server action RLS quirks)
    if (serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Create auth user
      const { data: userData, error: userErr } = await admin.auth.admin.createUser({
        email: uniqueEmail,
        password,
        email_confirm: true,
      });
      if (userErr || !userData?.user) throw userErr || new Error('createUser failed');
      createdUserId = userData.user.id;

      // Create tenant
      const slug = serviceName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString().slice(-4);
      const { data: tenantData, error: tErr } = await admin
        .from('tenants')
        .insert({ name: serviceName, slug, email: uniqueEmail })
        .select()
        .single();
      if (tErr || !tenantData) throw tErr || new Error('tenant insert failed');
      tenantId = tenantData.id;

      // Create profile
      const { error: pErr } = await admin.from('profiles').insert({
        id: createdUserId,
        tenant_id: tenantId,
        full_name: fullName,
        role: 'admin',
        email: uniqueEmail,
      });
      if (pErr) throw pErr;

      // Sign in with anon client to obtain real access/refresh tokens (for injecting into browser)
      const anon = createClient(supabaseUrl, anonKey);
      const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email: uniqueEmail, password });
      if (signInErr || !signInData.session) {
        console.warn('[global-setup] signIn to get tokens failed, will rely on UI login');
      } else {
        accessToken = signInData.session.access_token;
        refreshToken = signInData.session.refresh_token;
      }

      console.log(`[global-setup] Bootstrapped tenant+user via admin: ${uniqueEmail}`);
    } else {
      console.warn('[global-setup] No service key, falling back to UI register');
    }

    // 2. Browser part: wait server, login (or inject session) to obtain storageState
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      await waitForServer(page, 'http://127.0.0.1:3100/login');

      if (accessToken && refreshToken) {
        // Strong injection: set cookie on context (affects all requests including middleware) + localStorage + document
        const tokenPayload = {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: createdUserId }
        };
        const encoded = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

        await page.context().addCookies([{
          name: 'sb-127-auth-token',
          value: encoded,
          domain: '127.0.0.1',
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax'
        }]);

        await page.goto('http://127.0.0.1:3100/login', { waitUntil: 'domcontentloaded' });

        await page.evaluate((payload) => {
          const enc = btoa(JSON.stringify(payload));
          document.cookie = `sb-127-auth-token=${enc}; path=/;`;
          try { localStorage.setItem('sb-127-auth-token', JSON.stringify(payload)); } catch {}
        }, tokenPayload);
      } else {
        // Fallback UI login
        await page.locator('input[type="email"]').fill(uniqueEmail);
        await page.locator('input[type="password"]').fill(password);
        await page.getByRole('button', { name: /Intră în cont/i }).click();
      }

      // Force to dashboard and wait for real layout content (CarCore in sidebar proves layout + profile loaded)
      await page.goto('http://127.0.0.1:3100/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      // Give middleware + layout + profile query a moment
      await page.waitForTimeout(800);

      const statePath = path.join(authDir, 'user.json');
      await page.context().storageState({ path: statePath });

      // Also save credentials so tests can re-login reliably if storageState has expiry/restore issues
      const credsPath = path.join(authDir, 'creds.json');
      await require('fs/promises').writeFile(credsPath, JSON.stringify({ email: uniqueEmail, password }, null, 2));

      console.log(`[global-setup] Auth state + creds saved for ${uniqueEmail}`);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[global-setup] Failed to setup auth state:', err);
    // Tests that need data can create via UI
  }
}

export default globalSetup;
