import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { CheckPoint } from '../../shared/types';
import { fmtTime, ms } from '../format';

const H = 200;
const PAD = { top: 12, right: 12, bottom: 26, left: 52 };
const HOUR = 3_600_000;

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Response time over the last 24 hours. Failed checks sit on the baseline as red ticks. */
export function LatencyChart({ checks, now }: { checks: CheckPoint[]; now: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = now - 24 * HOUR;
  const okLat = checks.filter((c) => c.ok && c.latencyMs !== null).map((c) => c.latencyMs as number);
  // Scale to the 98th percentile so one slow outlier doesn't flatten the line
  const sorted = [...okLat].sort((a, b) => a - b);
  const p98 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))] : 0;
  const yMax = niceMax(p98 * 1.15);

  const iw = width - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - start) / (now - start)) * iw;
  const y = (v: number) => PAD.top + ih - (Math.min(v, yMax) / yMax) * ih;

  const path = useMemo(() => {
    let d = '';
    let pen = false;
    for (const c of checks) {
      if (!c.ok || c.latencyMs === null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${x(c.t).toFixed(1)},${y(c.latencyMs).toFixed(1)}`;
      pen = true;
    }
    return d;
  }, [checks, width, yMax, now]);

  const ticks = [0, yMax / 2, yMax];
  const hourTicks: number[] = [];
  const firstTick = Math.ceil(start / (6 * HOUR)) * 6 * HOUR;
  for (let t = firstTick; t <= now; t += 6 * HOUR) hourTicks.push(t);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (checks.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = start + ((e.clientX - rect.left - PAD.left) / iw) * (now - start);
    let best = 0;
    for (let i = 1; i < checks.length; i++) {
      if (Math.abs(checks[i].t - t) < Math.abs(checks[best].t - t)) best = i;
    }
    setHover(best);
  };

  const h = hover === null ? null : checks[hover];
  const avg = okLat.length ? okLat.reduce((a, b) => a + b, 0) / okLat.length : null;

  return (
    <div ref={box} className="latency">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Response time, last 24 hours. ${checks.length} checks, average ${ms(avg)}, ${checks.length - okLat.length} failed.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
            <text className="axis" x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end">
              {v >= 1000 ? `${v / 1000}s` : `${v}ms`}
            </text>
          </g>
        ))}
        {hourTicks.map((t) => (
          <text key={t} className="axis" x={x(t)} y={H - 8} textAnchor="middle">
            {fmtTime(t)}
          </text>
        ))}
        <path className="latency-line" d={path} />
        {checks.map((c) =>
          c.ok ? null : (
            <rect key={c.t} className="fail-tick" x={x(c.t) - 1.5} y={PAD.top + ih - 10} width={3} height={10} rx={1} />
          ),
        )}
        {h && (
          <g pointerEvents="none">
            <line className="crosshair" x1={x(h.t)} x2={x(h.t)} y1={PAD.top} y2={PAD.top + ih} />
            {h.ok && h.latencyMs !== null && (
              <circle className="latency-dot" cx={x(h.t)} cy={y(h.latencyMs)} r={4.5} />
            )}
          </g>
        )}
      </svg>
      {h && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(x(h.t), 90), width - 90) }}
        >
          <strong>{fmtTime(h.t)}</strong>
          {h.ok ? (
            <span>
              {ms(h.latencyMs)} · HTTP {h.statusCode}
            </span>
          ) : (
            <span className="tip-bad">✕ {h.error}</span>
          )}
        </div>
      )}
      {checks.length === 0 && <p className="chart-empty">No checks in the last 24 hours yet.</p>}
    </div>
  );
}

/** Tiny trend line for the monitor list. */
export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const W = 120;
  const SH = 32;
  const ok = values.filter((v): v is number => v !== null);
  if (values.length < 2) return <span className="spark-empty" aria-hidden="true" />;
  const max = Math.max(...ok, 1) * 1.1;
  const step = W / (values.length - 1);
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${(i * step).toFixed(1)},${(SH - 3 - (v / max) * (SH - 8)).toFixed(1)}`;
    pen = true;
  });
  const failed = values.length - ok.length;
  return (
    <svg className="spark" width={W} height={SH} viewBox={`0 0 ${W} ${SH}`} role="img" aria-label={`${label}: last ${values.length} checks${failed ? `, ${failed} failed` : ''}`}>
      <path d={d} />
      {values.map((v, i) => (v === null ? <rect key={i} className="fail-tick" x={i * step - 1.5} y={SH - 8} width={3} height={8} rx={1} /> : null))}
    </svg>
  );
}
