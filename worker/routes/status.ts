import { Hono } from 'hono';
import type { PublicStatus } from '../../shared/types';
import { HttpError, type AppEnv, type MonitorRow } from '../env';
import { DAY_MS, overallUptime } from '../lib/uptime';
import { dayBarsFor, incidentsFor } from '../queries';

export const status = new Hono<AppEnv>();

status.get('/:slug', async (c) => {
  const owner = await c.env.DB.prepare('SELECT id, page_title, slug FROM users WHERE slug = ?')
    .bind(c.req.param('slug').toLowerCase())
    .first<{ id: string; page_title: string; slug: string }>();
  if (!owner) throw new HttpError(404, 'Status page not found');

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM monitors WHERE user_id = ? AND is_public = 1 ORDER BY created_at',
  )
    .bind(owner.id)
    .all<MonitorRow>();
  const now = Date.now();
  const ids = results.map((m) => m.id);
  const [bars, incidents] = await Promise.all([
    dayBarsFor(c.env.DB, ids, 90, now),
    incidentsFor(c.env.DB, ids, now - 14 * DAY_MS, 30),
  ]);

  // Paused monitors still show their history, but don't count toward the headline
  const live = results.filter((m) => !m.paused);
  const down = live.filter((m) => m.status === 'down').length;
  const overall: PublicStatus['overall'] =
    results.length === 0 ? 'empty' : down === 0 ? 'operational' : down === live.length ? 'outage' : 'degraded';

  const body: PublicStatus = {
    title: owner.page_title,
    slug: owner.slug,
    overall,
    // URLs stay private; the public page only shows names
    monitors: results.map((m) => {
      const days = bars.get(m.id) ?? [];
      return { id: m.id, name: m.name, status: m.status, uptime90d: overallUptime(days), days };
    }),
    incidents,
    updatedAt: now,
  };
  c.header('Cache-Control', 'public, max-age=30');
  return c.json(body);
});
