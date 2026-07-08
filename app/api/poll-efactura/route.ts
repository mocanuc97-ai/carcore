import { pollAllPendingEfactura } from '@/app/(dashboard)/invoices/poll-all-efactura';
import { NextResponse } from 'next/server';

export async function GET() {
  // For Vercel Cron or manual trigger
  // In prod, protect with secret header
  try {
    const result = await pollAllPendingEfactura();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
