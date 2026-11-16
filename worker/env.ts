export interface Env {
  DB: D1Database;
  /** "true" lets monitors point at localhost / private IPs. Local dev only. */
  ALLOW_PRIVATE_TARGETS?: string;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  slug: string;
  page_title: string;
  webhook_url: string | null;
  created_at: number;
}

export interface MonitorRow {
  id: string;
  user_id: string;
  name: string;
  url: string;
  interval_s: number;
  timeout_ms: number;
  is_public: number;
  paused: number;
  status: 'pending' | 'up' | 'down';
  consecutive_failures: number;
  last_checked_at: number | null;
  next_check_at: number;
  created_at: number;
}

export type AppEnv = { Bindings: Env; Variables: { user: UserRow } };

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 429,
    message: string,
  ) {
    super(message);
  }
}
