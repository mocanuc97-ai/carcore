/**
 * SMS Integration Stub - sms.ro (recommended cheap & reliable for RO)
 * 
 * To activate:
 * 1. Create account at https://sms.ro
 * 2. Get API key
 * 3. Add SMSRO_API_KEY to .env
 * 
 * Current implementation is a stub that logs the message.
 */

export async function sendSMS(phone: string, message: string) {
  const apiKey = process.env.SMSRO_API_KEY;

  if (!apiKey) {
    console.log('[SMS STUB - sms.ro] Would send to', phone, ':', message);
    return { success: true, stub: true, message: 'Adaugă SMSRO_API_KEY pentru trimitere reală' };
  }

  try {
    // Example real integration (adjust to actual sms.ro API docs)
    const res = await fetch('https://www.sms.ro/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        to: phone,
        message,
        sender: 'CarCore', // or approved sender
      }),
    });

    if (!res.ok) throw new Error('SMS API error');

    return { success: true };
  } catch (e: any) {
    console.error('SMS error:', e);
    return { success: false, error: e.message };
  }
}
