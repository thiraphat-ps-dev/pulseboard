export function pct(v: number | null, digits = 2): string {
  if (v === null) return '—';
  const p = v * 100;
  // 99.999…% shouldn't round up to a perfect 100
  if (p < 100 && p.toFixed(digits) === (100).toFixed(digits)) return `${(100 - 10 ** -digits).toFixed(digits)}%`;
  return `${p.toFixed(p === 100 ? 0 : digits)}%`;
}

export function ms(v: number | null): string {
  return v === null ? '—' : `${Math.round(v)} ms`;
}

export function ago(t: number | null, now = Date.now()): string {
  if (t === null) return 'never';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function duration(from: number, to: number): string {
  const m = Math.max(1, Math.round((to - from) / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} days ${h % 24} h`;
}

export function intervalLabel(s: number): string {
  return s < 3600 ? `Every ${s / 60} min` : `Every ${s / 3600} h`;
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

export const fmtDay = (isoDate: string) => dateFmt.format(new Date(`${isoDate}T00:00:00Z`));
export const fmtDateTime = (t: number) => dateTimeFmt.format(t);
export const fmtTime = (t: number) => timeFmt.format(t);
