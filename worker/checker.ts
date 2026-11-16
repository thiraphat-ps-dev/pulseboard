import { emailAvailable, sendEmail } from './email';
import type { Env, MonitorRow, UserRow } from './env';
import { buildAlert, emailText, type Notice } from './lib/notify';
import { nextState, type Transition } from './lib/state';

export interface CheckResult {
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
}

/**
 * Monitors per cron run. Free Workers allow 50 outgoing requests per invocation: 30 checks leave
 * 20 for alerts, i.e. 10 users (webhook + email each) with a state change in the same minute.
 */
const BATCH = 30;
const RETENTION_DAYS = 91;

export async function checkUrl(url: string, timeoutMs: number): Promise<CheckResult> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'Pulseboard uptime check', Accept: '*/*' },
    });
    const latencyMs = Date.now() - started;
    // We only need the status line; don't download the body
    await res.body?.cancel();
    const ok = res.status < 400;
    return { ok, statusCode: res.status, latencyMs, error: ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const name = err instanceof Error ? err.name : '';
    const error =
      name === 'TimeoutError' || name === 'AbortError'
        ? `Timed out after ${Math.round(timeoutMs / 1000)}s`
        : `Connection failed${err instanceof Error && err.message ? `: ${err.message}` : ''}`;
    return { ok: false, statusCode: null, latencyMs, error: error.slice(0, 200) };
  }
}

/** Store one result, move the monitor's state machine, open or close incidents. */
export async function recordCheck(
  db: D1Database,
  m: MonitorRow,
  r: CheckResult,
  now: number,
): Promise<Transition> {
  const next = nextState({ status: m.status, consecutiveFailures: m.consecutive_failures }, r.ok);
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        'INSERT INTO checks (monitor_id, checked_at, ok, status_code, latency_ms, error) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(m.id, now, r.ok ? 1 : 0, r.statusCode, r.latencyMs, r.error),
    db
      .prepare(
        'UPDATE monitors SET status = ?, consecutive_failures = ?, last_checked_at = ?, next_check_at = ? WHERE id = ?',
      )
      .bind(next.status, next.consecutiveFailures, now, now + m.interval_s * 1000, m.id),
  ];
  if (next.event === 'down') {
    stmts.push(
      db
        .prepare('INSERT INTO incidents (monitor_id, started_at, cause) VALUES (?, ?, ?)')
        .bind(m.id, now, r.error ?? 'Check failed'),
    );
  } else if (next.event === 'recovered') {
    stmts.push(
      db
        .prepare('UPDATE incidents SET resolved_at = ? WHERE monitor_id = ? AND resolved_at IS NULL')
        .bind(now, m.id),
    );
  }
  await db.batch(stmts);
  return next.event;
}

/** Post to a Discord or Slack-compatible incoming webhook. Failures are logged, never thrown. */
export async function sendAlert(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Discord reads `content`, Slack reads `text`
      body: JSON.stringify({ content: text, text }),
      signal: AbortSignal.timeout(8000),
    });
    await res.body?.cancel();
    return res.ok;
  } catch (err) {
    console.warn('alert failed', err);
    return false;
  }
}

/** Where a user's alerts go. */
export type AlertTarget = Pick<UserRow, 'webhook_url' | 'email' | 'email_alerts'>;

/** Send one combined alert for `notices` to every channel the user turned on. At most 2 sub-requests. */
export async function deliverAlerts(env: Env, to: AlertTarget, notices: Notice[], now = Date.now()): Promise<void> {
  const message = buildAlert(notices);
  if (!message) return;
  const sends: Promise<boolean>[] = [];
  if (to.webhook_url) sends.push(sendAlert(to.webhook_url, message.text));
  if (to.email_alerts && emailAvailable(env)) {
    sends.push(sendEmail(env, to.email, message.subject, emailText(message, now)));
  }
  await Promise.all(sends);
}

/** Check one monitor and record it. Returns the result and, on a state change, the notice to send. */
async function checkAndRecord(env: Env, m: MonitorRow, now: number): Promise<{ result: CheckResult; notice: Notice | null }> {
  const r = await checkUrl(m.url, m.timeout_ms);
  const event = await recordCheck(env.DB, m, r, now);
  if (!event) return { result: r, notice: null };
  let downForMs: number | null = null;
  if (event === 'recovered') {
    const closed = await env.DB.prepare(
      'SELECT started_at FROM incidents WHERE monitor_id = ? AND resolved_at = ? ORDER BY started_at DESC LIMIT 1',
    )
      .bind(m.id, now)
      .first<{ started_at: number }>();
    if (closed) downForMs = now - closed.started_at;
  }
  const notice: Notice = {
    event,
    monitorName: m.name,
    url: m.url,
    error: event === 'down' ? r.error : null,
    latencyMs: r.latencyMs,
    downForMs,
    at: now,
  };
  return { result: r, notice };
}

/** Check one monitor now (from the API) and alert its owner on a state change. */
export async function runMonitor(env: Env, m: MonitorRow, owner: AlertTarget, now = Date.now()): Promise<CheckResult> {
  const { result, notice } = await checkAndRecord(env, m, now);
  if (notice) await deliverAlerts(env, owner, [notice], now);
  return result;
}

type DueRow = MonitorRow & AlertTarget;

export async function runDueChecks(env: Env, now: number): Promise<number> {
  // A little slack so a monitor due a few seconds after the cron tick isn't pushed a whole minute
  const { results } = await env.DB.prepare(
    `SELECT m.*, u.webhook_url, u.email, u.email_alerts FROM monitors m JOIN users u ON u.id = m.user_id
     WHERE m.paused = 0 AND m.next_check_at <= ? ORDER BY m.next_check_at LIMIT ?`,
  )
    .bind(now + 5000, BATCH)
    .all<DueRow>();
  const settled = await Promise.allSettled(results.map((m) => checkAndRecord(env, m, now)));

  // One alert per user per run, so an outage that hits ten monitors sends one message, not ten
  const byUser = new Map<string, { to: AlertTarget; notices: Notice[] }>();
  settled.forEach((s, i) => {
    if (s.status === 'rejected') return console.error('check failed to record', s.reason);
    if (!s.value.notice) return;
    const m = results[i];
    const entry = byUser.get(m.user_id) ?? { to: m, notices: [] };
    entry.notices.push(s.value.notice);
    byUser.set(m.user_id, entry);
  });
  await Promise.allSettled([...byUser.values()].map((u) => deliverAlerts(env, u.to, u.notices, now)));
  return results.length;
}

export async function cleanup(env: Env, now: number): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM checks WHERE checked_at < ?').bind(now - RETENTION_DAYS * 86_400_000),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - 86_400_000),
  ]);
}

export async function onSchedule(env: Env, scheduledTime: number): Promise<void> {
  await runDueChecks(env, scheduledTime);
  if (new Date(scheduledTime).getUTCMinutes() === 0) await cleanup(env, scheduledTime);
}
