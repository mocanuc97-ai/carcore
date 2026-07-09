'use server';

import { createClient } from '@/lib/supabase/server';
import { getResendClient } from '@/lib/resend/client';
import { sendSMS } from '@/lib/sms/smsro';
import { revalidatePath } from 'next/cache';

export async function sendAppointmentReminder(appointmentId: string) {
  const supabase = await createClient();

  try {
    const { data: profileForTenant } = await supabase.from('profiles').select('tenant_id').eq('id', (await supabase.auth.getUser()).data.user!.id).single();
    const { data: appt } = await supabase
      .from('appointments')
      .select('*, clients(name, email, phone), vehicles(make, model)')
      .eq('id', appointmentId)
      .eq('tenant_id', profileForTenant?.tenant_id)
      .single();

    if (!appt) return { error: 'Programare negăsită' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenants(name)')
      .eq('id', (await supabase.auth.getUser()).data.user!.id)
      .single();

    const tenantName = (profile as any)?.tenants?.name || 'Service Auto';

    // Email
    if (appt.clients?.email) {
      const resend = getResendClient();
      if (!resend) {
        console.log('[Email STUB] RESEND_API_KEY not set, skipping appointment reminder email');
      } else {
        try {
          await resend.emails.send({
            from: 'programari@carcore.ro',
            to: appt.clients.email,
            subject: `Reminder programare - ${tenantName}`,
            text: `Bună ${appt.clients.name},\n\nTe reamintim de programarea ta pentru ${appt.vehicles?.make} ${appt.vehicles?.model} pe data de ${new Date(appt.scheduled_at).toLocaleDateString('ro-RO')}.\n\nVă așteptăm!\n${tenantName}`,
          });
        } catch (e) {
          console.error('Email reminder failed');
        }
      }
    }

    // SMS (via sms.ro stub or real)
    if (appt.clients?.phone) {
      const msg = `Reminder: Programare ${appt.vehicles?.make} ${appt.vehicles?.model} la ${tenantName} pe ${new Date(appt.scheduled_at).toLocaleDateString('ro-RO')}.`;
      await sendSMS(appt.clients.phone, msg);
    }

    revalidatePath('/appointments');
  } catch (e) {
    console.error('[sendAppointmentReminder error]', e);
  }
}

export async function updateAppointmentStatus(appointmentId: string, newStatus: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', (await supabase.auth.getUser()).data.user!.id).single();
  const { error } = await supabase
    .from('appointments')
    .update({ status: newStatus })
    .eq('id', appointmentId)
    .eq('tenant_id', profile?.tenant_id);

  if (error) throw new Error(error.message);
  revalidatePath('/appointments');
}


export async function createAppointment(formData: FormData) {
  const supabase = await createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile) throw new Error('No tenant');

    const clientId = formData.get('client_id') as string;
    const vehicleId = formData.get('vehicle_id') as string;
    const scheduledAt = formData.get('scheduled_at') as string;
    const notes = formData.get('notes') as string || null;

    const { error } = await supabase.from('appointments').insert({
      tenant_id: profile.tenant_id,
      client_id: clientId,
      vehicle_id: vehicleId,
      scheduled_at: scheduledAt,
      status: 'pending',
      notes,
    });

    if (error) throw new Error(error.message);
    revalidatePath('/appointments');
    // redirect can be added if using next/navigation
  } catch (err: any) {
    console.error('[createAppointment error]', err);
    throw new Error(err.message || 'Eroare la creare programare');
  }
}

