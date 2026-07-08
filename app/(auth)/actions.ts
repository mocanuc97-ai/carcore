'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function createTenantAndProfile(formData: FormData) {
  const serviceName = formData.get('serviceName') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string || 'Administrator';

  if (!serviceName || !email || !password) {
    return { error: 'Toate câmpurile sunt obligatorii' };
  }

  const supabase = createAdminClient();

  // 1. Create auth user
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto confirm in local
  });

  if (userError || !userData.user) {
    return { error: userError?.message || 'Eroare la crearea utilizatorului' };
  }

  const userId = userData.user.id;

  // 2. Create tenant
  const slug = serviceName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString().slice(-4);

  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: serviceName,
      slug,
      email,
    })
    .select()
    .single();

  if (tenantError || !tenantData) {
    // Cleanup user if tenant creation fails
    await supabase.auth.admin.deleteUser(userId);
    return { error: tenantError?.message || 'Eroare la crearea service-ului' };
  }

  // 3. Create profile as admin
  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    tenant_id: tenantData.id,
    full_name: fullName,
    role: 'admin',
    email,
  });

  if (profileError) {
    // cleanup
    await supabase.from('tenants').delete().eq('id', tenantData.id);
    await supabase.auth.admin.deleteUser(userId);
    return { error: profileError.message };
  }

  // 4. Sign in the user (we can redirect and let client handle login)
  return { success: true, tenant: tenantData };
}
