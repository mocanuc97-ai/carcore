import { Resend } from 'resend';

let client: Resend | null = null;

// The Resend SDK throws in its constructor when given an empty/missing key,
// so it must never be instantiated eagerly at module scope with a key that
// might not be configured yet (e.g. RESEND_API_KEY unset in this environment).
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}
