/**
 * Transactional email through Resend (https://resend.com) when RESEND_API_KEY and EMAIL_FROM are set.
 * Without them (local development) the message is printed to the server log instead.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.info(`[email:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text }),
    });
    if (!res.ok) console.error(`[email] Resend returned ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error('[email] send failed', err);
    return false;
  }
}

export function appUrl(path = ''): string {
  return `${(process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')}${path}`;
}
