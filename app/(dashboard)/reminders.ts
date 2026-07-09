'use server';

import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { sendSMS } from '@/lib/sms/smsro';

const resend = new Resend(process.env.RESEND_API_KEY || '');

export async function sendUnpaidInvoiceReminders() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not auth' };

  const { data: profile } = await supabase.from('profiles').select('tenant_id, tenants(name)').eq('id', user.id).single();
  const tenantId = profile?.tenant_id;
  const tenantName = (profile as any)?.tenants?.name || 'Service';

  // Find sent but not paid invoices older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: unpaid } = await supabase
    .from('invoices')
    .select('id, number, total, issued_at, clients(name, email, phone)')
    .eq('tenant_id', tenantId)
    .eq('status', 'sent')
    .lt('issued_at', sevenDaysAgo)
    .limit(10);

  let sent = 0;
  for (const inv of unpaid || []) {
    if (!(inv.clients as any)?.email) continue;

    try {
      await resend.emails.send({
        from: 'facturi@carcore.ro',
        to: (inv.clients as any)?.email,
        subject: `Reminder plată factură ${inv.number} - ${tenantName}`,
        text: `Bună ${(inv.clients as any)?.name},\n\nVă reamintim de factura ${inv.number} în valoare de ${inv.total} RON, emisă pe ${new Date(inv.issued_at).toLocaleDateString('ro-RO')}.\n\nVă rugăm să efectuați plata.\n\nMulțumim,\n${tenantName}`
      });

      // Also SMS if phone
      if ((inv.clients as any)?.phone) {
        await sendSMS((inv.clients as any).phone, `Reminder: Factura ${inv.number} ${inv.total} RON la ${tenantName}. Plata urgenta.`);
      }
      sent++;
    } catch (e) {
      console.error('Reminder email failed', e);
    }
  }

  // no return needed for server action
}