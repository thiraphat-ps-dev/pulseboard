import { Hono } from 'hono';
import { MAX_MONITORS_PER_USER, type MonitorDetail } from '../../shared/types';
import { requireUser } from '../auth';
import { runMonitor } from '../checker';
import { HttpError, type AppEnv, type MonitorRow } from '../env';
import { randomId } from '../lib/crypto';
import { validateTarget } from '../lib/target';
import { DAY_MS, overallUptime } from '../lib/uptime';
import { cleanText, isInterval } from '../lib/validate';
import { dayBarsFor, incidentsFor, summaries } from '../queries';
import { readJson } from './util';

export const monitors = new Hono<AppEnv>();
monitors.use('*', requireUser);

async function own(c: { env: AppEnv['Bindings'] }, userId: string, id: string): Promise<MonitorRow> {
  const m = await c.env.DB.prepare('SELECT * FROM monitors WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<MonitorRow>();
  if (!m) throw new HttpError(404, 'Monitor not found');
  return m;
}

monitors.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM monitors WHERE user_id = ? ORDER BY created_at')
    .bind(c.get('user').id)
    .all<MonitorRow>();
  return c.json(await summaries(c.env.DB, results, Date.now()));
});

monitors.post('/', async (c) => {
  const user = c.get('user');
  const body = await readJson(c);
  const name = cleanText(body.name, 60);
  if (!name) throw new HttpError(400, 'Name must be 1–60 characters');
  const target = validateTarget(String(body.url ?? ''), { allowPrivate: c.env.ALLOW_PRIVATE_TARGETS === 'true' });
  if (!target.ok) throw new HttpError(400, target.error);
  const interval = body.intervalS ?? 300;
  if (!isInterval(interval)) throw new HttpError(400, 'Pick one of the listed intervals');

  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM monitors WHERE user_id = ?')
    .bind(user.id)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_MONITORS_PER_USER) {
    throw new HttpError(400, `You can have up to ${MAX_MONITORS_PER_USER} monitors`);
  }

  const now = Date.now();
  const m: MonitorRow = {
    id: randomId(),
    user_id: user.id,
    name,
    url: target.url,
    interval_s: interval,
    timeout_ms: 10_000,
    is_public: body.isPublic === false ? 0 : 1,
    paused: 0,
    status: 'pending',
    consecutive_failures: 0,
    last_checked_at: null,
    next_check_at: now,
    created_at: now,
  };
  await c.env.DB.prepare(
    `INSERT INTO monitors (id, user_id, name, url, interval_s, timeout_ms, is_public, paused, status,
       consecutive_failures, last_checked_at, next_check_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(m.id, m.user_id, m.name, m.url, m.interval_s, m.timeout_ms, m.is_public, m.paused, m.status,
      m.consecutive_failures, m.last_checked_at, m.next_check_at, m.created_at)
    .run();
  // First check right away instead of waiting for the next cron tick
  c.executionCtx.waitUntil(runMonitor(c.env, { ...m, webhook_url: user.webhook_url }, now));
  const [summary] = await summaries(c.env.DB, [m], now);
  return c.json(summary, 201);
});

monitors.get('/:id', async (c) => {
  const m = await own(c, c.get('user').id, c.req.param('id'));
  const now = Date.now();
  const [[summary], checks, bars, incidents] = await Promise.all([
    summaries(c.env.DB, [m], now),
    c.env.DB.prepare(
      'SELECT checked_at, ok, latency_ms, status_code, error FROM checks WHERE monitor_id = ? AND checked_at >= ? ORDER BY checked_at',
    )
      .bind(m.id, now - DAY_MS)
      .all<{ checked_at: number; ok: number; latency_ms: number | null; status_code: number | null; error: string | null }>(),
    dayBarsFor(c.env.DB, [m.id], 90, now),
    incidentsFor(c.env.DB, [m.id], now - 90 * DAY_MS, 20),
  ]);
  const days = bars.get(m.id) ?? [];
  const detail: MonitorDetail = {
    ...summary,
    timeoutMs: m.timeout_ms,
    uptime7d: overallUptime(days.slice(-7)),
    uptime30d: overallUptime(days.slice(-30)),
    checks: checks.results.map((r) => ({
      t: r.checked_at,
      ok: r.ok === 1,
      latencyMs: r.latency_ms,
      statusCode: r.status_code,
      error: r.error,
    })),
    days,
    incidents,
  };
  return c.json(detail);
});

monitors.patch('/:id', async (c) => {
  const user = c.get('user');
  const m = await own(c, user.id, c.req.param('id'));
  const body = await readJson(c);
  const next = { ...m };

  if (body.name !== undefined) {
    const name = cleanText(body.name, 60);
    if (!name) throw new HttpError(400, 'Name must be 1–60 characters');
    next.name = name;
  }
  if (body.url !== undefined) {
    const target = validateTarget(String(body.url), { allowPrivate: c.env.ALLOW_PRIVATE_TARGETS === 'true' });
    if (!target.ok) throw new HttpError(400, target.error);
    if (target.url !== m.url) {
      // A new target starts with a clean slate
      Object.assign(next, { url: target.url, status: 'pending', consecutive_failures: 0, next_check_at: Date.now() });
    }
  }
  if (body.intervalS !== undefined) {
    if (!isInterval(body.intervalS)) throw new HttpError(400, 'Pick one of the listed intervals');
    next.interval_s = body.intervalS;
  }
  if (body.isPublic !== undefined) next.is_public = body.isPublic ? 1 : 0;
  if (body.paused !== undefined) {
    next.paused = body.paused ? 1 : 0;
    if (!body.paused && m.paused) next.next_check_at = Date.now();
  }

  await c.env.DB.prepare(
    `UPDATE monitors SET name = ?, url = ?, interval_s = ?, is_public = ?, paused = ?, status = ?,
       consecutive_failures = ?, next_check_at = ? WHERE id = ?`,
  )
    .bind(next.name, next.url, next.interval_s, next.is_public, next.paused, next.status,
      next.consecutive_failures, next.next_check_at, m.id)
    .run();
  if (next.status === 'pending' && m.status !== 'pending') {
    // Close any open incident that belonged to the old URL
    await c.env.DB.prepare('UPDATE incidents SET resolved_at = ? WHERE monitor_id = ? AND resolved_at IS NULL')
      .bind(Date.now(), m.id)
      .run();
  }
  const [summary] = await summaries(c.env.DB, [next], Date.now());
  return c.json(summary);
});

monitors.delete('/:id', async (c) => {
  const m = await own(c, c.get('user').id, c.req.param('id'));
  // D1 enforces foreign keys, so checks and incidents go with it
  await c.env.DB.prepare('DELETE FROM monitors WHERE id = ?').bind(m.id).run();
  return c.body(null, 204);
});

monitors.post('/:id/check', async (c) => {
  const user = c.get('user');
  const m = await own(c, user.id, c.req.param('id'));
  if (m.last_checked_at && Date.now() - m.last_checked_at < 10_000) {
    throw new HttpError(429, 'Checked a moment ago. Try again in a few seconds.');
  }
  const r = await runMonitor(c.env, { ...m, webhook_url: user.webhook_url });
  return c.json(r);
});
