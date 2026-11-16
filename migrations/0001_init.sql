-- Times are Unix milliseconds.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,          -- public status page lives at /s/<slug>
  page_title    TEXT NOT NULL,
  webhook_url   TEXT,                          -- Discord or Slack-compatible incoming webhook
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,                 -- SHA-256 of the cookie token, never the token itself
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE monitors (
  id                   TEXT PRIMARY KEY,
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  url                  TEXT NOT NULL,
  interval_s           INTEGER NOT NULL DEFAULT 300,
  timeout_ms           INTEGER NOT NULL DEFAULT 10000,
  is_public            INTEGER NOT NULL DEFAULT 1,
  paused               INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'pending',   -- pending | up | down
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_checked_at      INTEGER,
  next_check_at        INTEGER NOT NULL,
  created_at           INTEGER NOT NULL
);
CREATE INDEX monitors_user ON monitors(user_id);
CREATE INDEX monitors_due ON monitors(paused, next_check_at);

CREATE TABLE checks (
  id          INTEGER PRIMARY KEY,
  monitor_id  TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at  INTEGER NOT NULL,
  ok          INTEGER NOT NULL,
  status_code INTEGER,
  latency_ms  INTEGER,
  error       TEXT
);
CREATE INDEX checks_monitor_time ON checks(monitor_id, checked_at);

CREATE TABLE incidents (
  id          INTEGER PRIMARY KEY,
  monitor_id  TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  started_at  INTEGER NOT NULL,
  resolved_at INTEGER,
  cause       TEXT NOT NULL
);
CREATE INDEX incidents_monitor_time ON incidents(monitor_id, started_at);

-- Fixed-window counters for login / signup throttling
CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
