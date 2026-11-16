import type { Env } from './env';

/** Resend's shared sender. Works without a domain, but only delivers to the Resend account's own email. */
const DEFAULT_FROM = 'Pulseboard <onboarding@resend.dev>';

export function emailAvailable(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/** Send a plain-text email through Resend's HTTP API. Failures are logged, never thrown. */
export async function sendEmail(env: Env, to: string, subject: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.ALERT_EMAIL_FROM || DEFAULT_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn('email failed', res.status, (await res.text()).slice(0, 300));
    else await res.body?.cancel();
    return res.ok;
  } catch (err) {
    console.warn('email failed', err);
    return false;
  }
}
