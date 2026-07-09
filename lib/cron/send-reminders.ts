import { createAdminClient } from '@/lib/supabase/admin';
import { getResendClient } from '@/lib/resend/client';
import { sendSMS } from '@/lib/sms/smsro';

interface UnpaidInvoiceRow {
  id: string;
  number: string;
  total: number;
  issued_at: string;
  tenants: { name: string } | null;
  clients: { name: string; email: string | null; phone: string | null } | null;
}

// Cron-safe variant of sendUnpaidInvoiceReminders: runs with the service role
// across all tenants, instead of just the current session's tenant.
export async function sendUnpaidInvoiceRemindersForAllTenants() {
  const supabase = createAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: unpaid } = await supabase
    .from('invoices')
    .select('id, number, total, issued_at, tenants(name), clients(name, email, phone)')
    .eq('status', 'sent')
    .lt('issued_at', sevenDaysAgo)
    .limit(200)
    .returns<UnpaidInvoiceRow[]>();

  const resend = getResendClient();
  let sent = 0;
  for (const inv of unpaid || []) {
    if (!inv.clients?.email || !resend) continue;
    const tenantName = inv.tenants?.name || 'Service';

    try {
      await resend.emails.send({
        from: 'facturi@carcore.ro',
        to: inv.clients.email,
        subject: `Reminder plată factură ${inv.number} - ${tenantName}`,
        text: `Bună ${inv.clients.name},\n\nVă reamintim de factura ${inv.number} în valoare de ${inv.total} RON, emisă pe ${new Date(inv.issued_at).toLocaleDateString('ro-RO')}.\n\nVă rugăm să efectuați plata.\n\nMulțumim,\n${tenantName}`,
      });

      if (inv.clients.phone) {
        await sendSMS(inv.clients.phone, `Reminder: Factura ${inv.number} ${inv.total} RON la ${tenantName}. Plata urgenta.`);
      }
      sent++;
    } catch (e) {
      console.error('[cron reminders] failed for invoice', inv.id, e);
    }
  }

  return { checked: unpaid?.length || 0, sent };
}
