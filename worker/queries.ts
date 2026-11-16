import type { DayBar, Incident, MonitorSummary } from '../shared/types';
import type { MonitorRow } from './env';
import { DAY_MS, dayBars } from './lib/uptime';

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(',');

export async function summaries(db: D1Database, monitors: MonitorRow[], now: number): Promise<MonitorSummary[]> {
  if (monitors.length === 0) return [];
  const ids = monitors.map((m) => m.id);
  const ph = placeholders(ids.length);
  const [recent, day] = await db.batch([
    db
      .prepare(
        `SELECT monitor_id, ok, latency_ms FROM (
           SELECT monitor_id, checked_at, ok, latency_ms,
                  ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY checked_at DESC) AS rn
           FROM checks WHERE monitor_id IN (${ph}) AND checked_at >= ?
         ) WHERE rn <= 30 ORDER BY checked_at`,
      )
      .bind(...ids, now - 2 * DAY_MS),
    db
      .prepare(
        `SELECT monitor_id, COUNT(*) AS total, SUM(ok) AS up FROM checks
         WHERE monitor_id IN (${ph}) AND checked_at >= ? GROUP BY monitor_id`,
      )
      .bind(...ids, now - DAY_MS),
  ]);
  const recentBy = new Map<string, (number | null)[]>();
  for (const r of recent.results as { monitor_id: string; ok: number; latency_ms: number | null }[]) {
    const list = recentBy.get(r.monitor_id) ?? [];
    list.push(r.ok ? r.latency_ms : null);
    recentBy.set(r.monitor_id, list);
  }
  const dayBy = new Map(
    (day.results as { monitor_id: string; total: number; up: number }[]).map((r) => [r.monitor_id, r]),
  );
  return monitors.map((m) => {
    const list = recentBy.get(m.id) ?? [];
    const d = dayBy.get(m.id);
    return {
      id: m.id,
      name: m.name,
      url: m.url,
      intervalS: m.interval_s,
      isPublic: m.is_public === 1,
      paused: m.paused === 1,
      status: m.status,
      lastCheckedAt: m.last_checked_at,
      lastLatencyMs: list.length ? list[list.length - 1] : null,
      uptime24h: d && d.total > 0 ? d.up / d.total : null,
      recent: list,
    };
  });
}

export async function dayBarsFor(
  db: D1Database,
  ids: string[],
  days: number,
  now: number,
): Promise<Map<string, DayBar[]>> {
  const out = new Map<string, DayBar[]>();
  if (ids.length === 0) return out;
  const since = Date.parse(new Date(now - (days - 1) * DAY_MS).toISOString().slice(0, 10));
  const { results } = await db
    .prepare(
      `SELECT monitor_id, date(checked_at / 1000, 'unixepoch') AS d, COUNT(*) AS total, SUM(ok) AS up
       FROM checks WHERE monitor_id IN (${placeholders(ids.length)}) AND checked_at >= ?
       GROUP BY monitor_id, d`,
    )
    .bind(...ids, since)
    .all<{ monitor_id: string; d: string; total: number; up: number }>();
  for (const id of ids) {
    out.set(
      id,
      dayBars(
        results.filter((r) => r.monitor_id === id),
        days,
        now,
      ),
    );
  }
  return out;
}

export async function incidentsFor(db: D1Database, ids: string[], since: number, limit = 50): Promise<Incident[]> {
  if (ids.length === 0) return [];
  const { results } = await db
    .prepare(
      `SELECT i.id, i.monitor_id, m.name, i.started_at, i.resolved_at, i.cause
       FROM incidents i JOIN monitors m ON m.id = i.monitor_id
       WHERE i.monitor_id IN (${placeholders(ids.length)}) AND (i.started_at >= ? OR i.resolved_at IS NULL)
       ORDER BY i.started_at DESC LIMIT ?`,
    )
    .bind(...ids, since, limit)
    .all<{ id: number; monitor_id: string; name: string; started_at: number; resolved_at: number | null; cause: string }>();
  return results.map((r) => ({
    id: r.id,
    monitorId: r.monitor_id,
    monitorName: r.name,
    startedAt: r.started_at,
    resolvedAt: r.resolved_at,
    cause: r.cause,
  }));
}
