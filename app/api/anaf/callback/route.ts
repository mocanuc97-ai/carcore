import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const paramTenantId = searchParams.get('tenant_id');
  const testExpiry = searchParams.get('test_expiry');

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  const tenantId = profile?.tenant_id;
  if (!code || !tenantId || (paramTenantId && paramTenantId !== tenantId)) {
    return NextResponse.redirect(new URL('/dashboard/settings?error=invalid_anaf_callback', request.url));
  }
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard/settings?error=only_admin_anaf', request.url));
  }

  // === REAL ANAF FLOW (simulated here) ===
  // In production you would:
  // 1. Exchange `code` for tokens by POSTing to ANAF token endpoint
  //    with client_id, client_secret, redirect_uri, grant_type=authorization_code
  // 2. Store access_token, refresh_token, expires_at securely

  const accessToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ANAF_${Date.now()}`;
  const refreshToken = `rt_ANAF_${Date.now()}`;
  let expiresAt: string;
  if (testExpiry === 'expired') {
    // For browser test sim: connect with expiry
    expiresAt = new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(); // 1h in past -> expired
  } else {
    expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(); // 2 hours
  }

  // Get CUI that was saved during connect
  const { data: tenant } = await supabase
    .from('tenants')
    .select('cui')
    .eq('id', tenantId)
    .single();

  const cui = tenant?.cui || 'RO00000000';

  const { error } = await supabase
    .from('tenant_anaf_connections')
    .upsert({
      tenant_id: tenantId,
      connection_type: 'oauth',
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      cui,
      status: (testExpiry === 'expired' ? 'expired' : 'connected'),
      last_sync_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' });

  if (error) {
    console.error('ANAF connection save error:', error);
    return NextResponse.redirect(new URL('/dashboard/settings?error=anaf_save_failed', request.url));
  }

  return NextResponse.redirect(new URL('/dashboard/settings?success=anaf_connected', request.url));
}
