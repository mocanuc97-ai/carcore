import { createClient } from '@/lib/supabase/server';
import SettingsClient from './SettingsClient';
import { getCurrentProfile } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return <div>Nu ești autentificat</div>;

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', profile.tenant_id)
    .single();

  const { data: anafConnection } = await supabase
    .from('tenant_anaf_connections')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .single();

  return <SettingsClient tenant={tenant} anafConnection={anafConnection} role={profile.role} />;
}
