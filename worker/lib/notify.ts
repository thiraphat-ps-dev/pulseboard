// Pure alert formatting: the same notices become one webhook post and one email.

export interface Notice {
  event: 'down' | 'recovered';
  monitorName: string;
  url: string;
  /** Why the check failed (down only) */
  error: string | null;
  latencyMs: number;
  /** How long the incident lasted (recovered only, when known) */
  downForMs: number | null;
  at: number;
}

export interface AlertMessage {
  subject: string;
  /** Plain text. One line per notice plus its URL. */
  text: string;
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${Math.max(min, 1)} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

function line(n: Notice): string {
  if (n.event === 'down') return `🔴 ${n.monitorName} is down: ${n.error ?? 'check failed'}`;
  const took = n.downForMs !== null ? ` after ${formatDuration(n.downForMs)}` : '';
  return `🟢 ${n.monitorName} is back up${took} (${n.latencyMs} ms)`;
}

function subject(notices: Notice[]): string {
  if (notices.length === 1) {
    const n = notices[0];
    return n.event === 'down' ? `🔴 ${n.monitorName} is down` : `🟢 ${n.monitorName} is back up`;
  }
  const down = notices.filter((n) => n.event === 'down').length;
  const up = notices.length - down;
  const parts = [down && `${down} down`, up && `${up} back up`].filter(Boolean);
  return `${down ? '🔴' : '🟢'} ${notices.length} monitors changed: ${parts.join(', ')}`;
}

/** Down notices first, so the bad news leads. Empty input → null (nothing to send). */
export function buildAlert(notices: Notice[]): AlertMessage | null {
  if (notices.length === 0) return null;
  const sorted = [...notices].sort((a, b) => (a.event === b.event ? a.at - b.at : a.event === 'down' ? -1 : 1));
  return {
    subject: subject(sorted),
    text: sorted.map((n) => `${line(n)}\n${n.url}`).join('\n\n'),
  };
}

/** The email body adds a footer the chat webhook doesn't need. */
export function emailText(message: AlertMessage, at: number): string {
  const when = new Date(at).toISOString().replace('T', ' ').slice(0, 16);
  return `${message.text}\n\n—\nChecked at ${when} UTC by Pulseboard.\nTurn email alerts off in Settings.`;
}
