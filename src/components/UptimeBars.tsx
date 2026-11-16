import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { DayBar } from '../../shared/types';
import { fmtDay, pct } from '../format';

export type UptimeTone = 'good' | 'warn' | 'bad' | 'none';

export function uptimeTone(u: number | null): UptimeTone {
  if (u === null) return 'none';
  if (u >= 0.995) return 'good';
  if (u >= 0.95) return 'warn';
  return 'bad';
}

const TONE_LABEL: Record<UptimeTone, string> = {
  good: 'Operational',
  warn: 'Partial outage',
  bad: 'Major outage',
  none: 'No data',
};

/**
 * 90 daily bars, one per UTC day, colored by uptime. On narrow screens only the last 30 show.
 * Hover or arrow keys reveal the day's numbers.
 */
export function UptimeBars({ days, label }: { days: DayBar[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const visibleFrom = () => {
    // The CSS hides the first 60 bars below 640px; keep pointer math in step with that
    const el = ref.current;
    return el && el.clientWidth < 420 && days.length > 30 ? days.length - 30 : 0;
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const from = visibleFrom();
    const n = days.length - from;
    const i = Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * n)));
    setActive(from + i);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = days.length - 1;
    const cur = active ?? last;
    const next =
      e.key === 'ArrowLeft' ? Math.max(visibleFrom(), cur - 1)
      : e.key === 'ArrowRight' ? Math.min(last, cur + 1)
      : e.key === 'Home' ? visibleFrom()
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  const day = active === null ? null : days[active];
  const tipLeft = active === null ? 0 : ((active - visibleFrom() + 0.5) / (days.length - visibleFrom())) * 100;

  return (
    <div className="bars-wrap">
      <div
        ref={ref}
        className="bars"
        role="group"
        aria-label={`${label}: daily uptime, last ${days.length} days. Use arrow keys to inspect a day.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {days.map((d, i) => (
          <span key={d.date} className="bar" data-tone={uptimeTone(d.uptime)} data-active={i === active || undefined} />
        ))}
      </div>
      {day && (
        <div
          className="bars-tip"
          style={{ left: `clamp(80px, ${tipLeft}%, calc(100% - 80px))` }}
          role="status"
        >
          <strong>{fmtDay(day.date)}</strong>
          <span>
            {day.uptime === null ? 'No checks' : `${pct(day.uptime)} uptime · ${day.checks} checks`}
          </span>
          <span className="bars-tip-tone" data-tone={uptimeTone(day.uptime)}>
            {TONE_LABEL[uptimeTone(day.uptime)]}
          </span>
        </div>
      )}
    </div>
  );
}

export function UptimeLegend() {
  return (
    <ul className="legend" aria-label="Bar colors">
      {(['good', 'warn', 'bad', 'none'] as const).map((t) => (
        <li key={t}>
          <span className="legend-swatch" data-tone={t} aria-hidden="true" />
          {t === 'good' ? '≥ 99.5%' : t === 'warn' ? '95–99.5%' : t === 'bad' ? '< 95%' : 'No data'}
        </li>
      ))}
    </ul>
  );
}
