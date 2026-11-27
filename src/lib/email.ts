/**
 * Transactional email through Resend (https://resend.com) when RESEND_API_KEY and EMAIL_FROM are set.
 * Without them, development prints the message to the server log. Production never logs the body:
 * messages carry one-time password links, and anyone who can read the logs could use them.
 */
export async function sendEmail(msg: { to: string; subject: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV === 'production')
      console.warn(`[email] not sent (RESEND_API_KEY / EMAIL_FROM not set): "${msg.subject}"`);
    else console.info(`[email:dev] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
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
