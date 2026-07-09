import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL('/settings?error=no_profile', request.url));
  }
  if (profile.role !== 'admin') {
    return NextResponse.redirect(new URL('/settings?error=only_admin_anaf', request.url));
  }

  const tenantId = profile.tenant_id;
  const state = crypto.randomUUID();

  // Get CUI from query if provided (from settings form)
  const cui = request.nextUrl.searchParams.get('cui') || 'RO00000000';

  // Save CUI to tenant
  await supabase
    .from('tenants')
    .update({ cui })
    .eq('id', tenantId);

  const clientId = process.env.ANAF_CLIENT_ID;
  const redirectUri = process.env.ANAF_REDIRECT_URI || new URL('/api/anaf/callback', request.url).toString();
  const scope = process.env.ANAF_SCOPE || 'e-factura';

  if (clientId) {
    // Real ANAF OAuth2
    const anafAuthUrl = new URL('https://logincert.anaf.ro/anaf-oauth2/v1/authorize');
    anafAuthUrl.searchParams.set('client_id', clientId);
    anafAuthUrl.searchParams.set('redirect_uri', redirectUri);
    anafAuthUrl.searchParams.set('scope', scope);
    anafAuthUrl.searchParams.set('state', state);
    anafAuthUrl.searchParams.set('response_type', 'code');

    return NextResponse.redirect(anafAuthUrl);
  }

  // Fallback to local simulator (for development without real ANAF credentials)
  const { data: tenantInfo } = await supabase.from('tenants').select('name').eq('id', tenantId).single();

  const authorizeUrl = new URL('/anaf/authorize', request.url);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('tenant_id', tenantId);
  if (tenantInfo?.name) authorizeUrl.searchParams.set('tenant_name', tenantInfo.name);
  // Forward test_expiry for browser sim of connect-with-expiry
  const testExpiry = request.nextUrl.searchParams.get('test_expiry');
  if (testExpiry) authorizeUrl.searchParams.set('test_expiry', testExpiry);

  return NextResponse.redirect(authorizeUrl);
}

