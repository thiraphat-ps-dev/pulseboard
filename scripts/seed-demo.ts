// Generates SQL for a demo account with 90 days of fake history, for local development and screenshots.
//   node scripts/seed-demo.ts > .wrangler/seed.sql && npx wrangler d1 execute DB --local --file .wrangler/seed.sql
// Log in as demo@pulseboard.test / demo-password-123, or open /s/acme.

import { hashPassword, randomId } from '../worker/lib/crypto.ts';

const DAY = 86_400_000;
const now = Date.now();
const userId = randomId();

let seed = 42;
const rand = () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
  return seed / 2 ** 31;
};

const q = (v: string | number | null) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);

const out: string[] = [
  "DELETE FROM users WHERE email = 'demo@pulseboard.test';",
  `INSERT INTO users (id, email, password_hash, slug, page_title, webhook_url, created_at) VALUES (${[
    userId,
    'demo@pulseboard.test',
    await hashPassword('demo-password-123'),
    'acme',
    'Acme status',
    null,
    now - 95 * DAY,
  ]
    .map(q)
    .join(', ')});`,
];

// [name, url, base latency, outages as [days ago, duration in minutes]]
const monitors: [string, string, number, [number, number][]][] = [
  ['Website', 'https://www.example.com/', 180, [[61, 95]]],
  ['API', 'https://api.example.com/health', 95, [[34, 20], [12, 240]]],
  ['Dashboard', 'https://app.example.com/', 260, [[77, 35]]],
  ['Docs', 'https://docs.example.com/', 140, []],
];

for (const [i, [name, url, base, outages]] of monitors.entries()) {
  const id = randomId();
  const windows = outages.map(([ago, mins]) => {
    const start = now - ago * DAY + 3 * 3_600_000;
    return [start, start + mins * 60_000] as const;
  });
  const down = (t: number) => windows.some(([a, b]) => t >= a && t < b);

  out.push(
    `INSERT INTO monitors (id, user_id, name, url, interval_s, timeout_ms, is_public, paused, status, consecutive_failures, last_checked_at, next_check_at, created_at) VALUES (${[
      id, userId, name, url, 300, 10000, 1, 0, 'up', 0, now - 60_000, now + 240_000, now - 92 * DAY + i,
    ]
      .map(q)
      .join(', ')});`,
  );

  const rows: string[] = [];
  // Every 30 min for 90 days, every 5 min for the last day
  for (let t = now - 90 * DAY; t < now; t += t < now - DAY ? 1_800_000 : 300_000) {
    const fail = down(t) || rand() < 0.0004;
    const hour = new Date(t).getUTCHours();
    const busy = hour >= 1 && hour <= 10 ? 1.35 : 1; // daytime in Asia
    const lat = Math.round(base * busy * (0.8 + rand() * 0.5) + (rand() < 0.02 ? base * 3 : 0));
    rows.push(`(${q(id)}, ${t}, ${fail ? 0 : 1}, ${fail ? 'NULL' : 200}, ${fail ? 10000 : lat}, ${fail ? q('Timed out after 10s') : 'NULL'})`);
  }
  for (let k = 0; k < rows.length; k += 400) {
    out.push(`INSERT INTO checks (monitor_id, checked_at, ok, status_code, latency_ms, error) VALUES ${rows.slice(k, k + 400).join(',\n')};`);
  }
  for (const [a, b] of windows) {
    out.push(`INSERT INTO incidents (monitor_id, started_at, resolved_at, cause) VALUES (${q(id)}, ${a}, ${b}, 'Timed out after 10s');`);
  }
}

console.log(out.join('\n'));
