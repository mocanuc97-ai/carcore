import { sendUnpaidInvoiceRemindersForAllTenants } from '@/lib/cron/send-reminders';
import { isAuthorizedCronRequest } from '@/lib/cron/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendUnpaidInvoiceRemindersForAllTenants();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
