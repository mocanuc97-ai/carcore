import { NextRequest } from 'next/server';

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when
// the CRON_SECRET env var is set on the project. See:
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn('[cron] CRON_SECRET is not set - allowing request unauthenticated. Set CRON_SECRET before deploying to production.');
    return true;
  }
  return request.headers.get('authorization') === `Bearer ${secret}`;
}
