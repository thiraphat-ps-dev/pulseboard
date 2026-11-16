import type { DayBar } from '../../shared/types';

export const DAY_MS = 86_400_000;

export function utcDate(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Fill every day in the window, oldest first, so days without checks show as gaps. */
export function dayBars(rows: { d: string; total: number; up: number }[], days: number, now: number): DayBar[] {
  const byDay = new Map(rows.map((r) => [r.d, r]));
  const out: DayBar[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = utcDate(now - i * DAY_MS);
    const r = byDay.get(date);
    out.push({ date, checks: r?.total ?? 0, uptime: r && r.total > 0 ? r.up / r.total : null });
  }
  return out;
}

/** Check-weighted uptime over a set of day bars. */
export function overallUptime(bars: DayBar[]): number | null {
  let total = 0;
  let up = 0;
  for (const b of bars) {
    if (b.uptime === null) continue;
    total += b.checks;
    up += b.uptime * b.checks;
  }
  return total === 0 ? null : up / total;
}
