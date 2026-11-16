// API shapes shared by the Worker and the React app.

export type MonitorStatus = 'pending' | 'up' | 'down';

/** One day on a 90-day uptime bar. `uptime` is null when there were no checks that day. */
export interface DayBar {
  date: string; // YYYY-MM-DD (UTC)
  uptime: number | null; // 0..1
  checks: number;
}

export interface Me {
  id: string;
  email: string;
  slug: string;
  pageTitle: string;
  webhookUrl: string | null;
  /** Email alerts to `email` are on */
  emailAlerts: boolean;
  /** The server has an email provider configured */
  emailAvailable: boolean;
}

export interface MonitorSummary {
  id: string;
  name: string;
  url: string;
  intervalS: number;
  isPublic: boolean;
  paused: boolean;
  status: MonitorStatus;
  lastCheckedAt: number | null;
  lastLatencyMs: number | null;
  uptime24h: number | null;
  /** Latency of the last 30 checks, oldest first, for the sparkline. null = failed check */
  recent: (number | null)[];
}

export interface CheckPoint {
  t: number;
  ok: boolean;
  latencyMs: number | null;
  statusCode: number | null;
  error: string | null;
}

export interface Incident {
  id: number;
  monitorId: string;
  monitorName: string;
  startedAt: number;
  resolvedAt: number | null;
  cause: string;
}

export interface MonitorDetail extends MonitorSummary {
  timeoutMs: number;
  uptime7d: number | null;
  uptime30d: number | null;
  checks: CheckPoint[]; // last 24 hours
  days: DayBar[]; // last 90 days
  incidents: Incident[];
}

export interface PublicStatus {
  title: string;
  slug: string;
  overall: 'operational' | 'degraded' | 'outage' | 'empty';
  monitors: {
    id: string;
    name: string;
    status: MonitorStatus;
    uptime90d: number | null;
    days: DayBar[];
  }[];
  incidents: Incident[]; // last 14 days
  updatedAt: number;
}

export interface MonitorInput {
  name: string;
  url: string;
  intervalS: number;
  isPublic: boolean;
  paused?: boolean;
}

export const INTERVALS = [60, 300, 600, 1800, 3600] as const;
export const MAX_MONITORS_PER_USER = 20;
