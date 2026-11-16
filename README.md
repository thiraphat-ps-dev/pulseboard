# Pulseboard

Uptime monitoring with a public status page. Add the URLs you care about. Pulseboard checks them on a schedule, alerts you on Discord or Slack when one goes down (and when it comes back), and publishes a status page with 90 days of history.

Multi-user: anyone can sign up and gets their own monitors and their own status page at `/s/<name>`.

## Features

- **HTTP checks** every 1, 5, 10, 30 or 60 minutes, with response time for every check
- **No false alarms:** a monitor only counts as down after two failed checks in a row; recovery closes the incident
- **Alerts** to any Discord or Slack-compatible incoming webhook, with a test button
- **Dashboard:** status, 24h uptime, sparkline per monitor; a detail page with a 24-hour response-time chart, 90-day uptime bars, incidents and recent checks
- **Public status page:** overall status, 90-day bars per service, incidents from the last 14 days. Shows names only, never the monitored URLs
- Light and dark themes, responsive down to phone width, keyboard-accessible charts

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Cloudflare Workers (one Worker serves the API and the static app) |
| Scheduler | Cron Trigger, every minute |
| Database | Cloudflare D1 (SQLite) |
| API | [Hono](https://hono.dev) |
| UI | React 19 + [thira-ui](https://github.com/thiraphat-ps-dev/thira-ui), [Thira Sans](https://github.com/thiraphat-ps-dev/thira-sans) |
| Build | Vite + `@cloudflare/vite-plugin` (dev runs the Worker in workerd) |

Everything fits Cloudflare's free plan for personal use.

## How it works

```
             ┌──────── Cron, every minute ───────┐
             ▼                                    │
  monitors due (next_check_at <= now) ──► fetch(url, 10 s timeout)
             │                                    │
             ▼                                    ▼
  checks row + state machine (up / down) ──► incident opened or resolved ──► webhook alert
```

- `worker/checker.ts`: picks due monitors (up to 30 per run, under the Workers sub-request limit), runs them in parallel, records results in one D1 batch, and sends alerts. Hourly cleanup keeps 91 days of checks.
- `worker/lib/state.ts`: the pure up/down state machine.
- `worker/routes/*`: auth, monitors, account settings, public status.
- `src/`: the React app. A small history router; charts are hand-written SVG.

## Security notes

- **Passwords:** PBKDF2-SHA256 (100k iterations, per-user salt) via Web Crypto. Logins are rate-limited per IP and per email, and an unknown email takes as long as a wrong password.
- **Sessions:** a random 256-bit token in an `HttpOnly; Secure; SameSite=Lax` cookie. Only its SHA-256 is stored.
- **CSRF:** Hono's `csrf()` rejects cross-origin form posts, and the API only accepts JSON.
- **SSRF:** monitor and webhook URLs must be http(s) without credentials. Loopback, private, link-local and metadata addresses are refused, including numeric tricks such as `http://2130706433`. Local dev can allow them with `ALLOW_PRIVATE_TARGETS=true` in `.dev.vars`.
- **Data isolation:** every monitor query is scoped to the session's user. The public endpoint returns names and uptime only.

## Develop

```sh
npm install
echo ALLOW_PRIVATE_TARGETS=true > .dev.vars   # optional: monitor localhost while developing
npm run db:migrate:local
npm run dev                                   # http://localhost:5173
```

- **Trigger the cron by hand:** `curl http://localhost:5173/cdn-cgi/handler/scheduled`
- **Load 90 days of demo data:**
  ```sh
  node scripts/seed-demo.ts > .wrangler/seed.sql
  npx wrangler d1 execute DB --local --file .wrangler/seed.sql
  ```
  Then open `/s/acme`, or log in as `demo@pulseboard.test` / `demo-password-123`.

`npm test` runs the unit tests. `npm run build` typechecks and builds.

## Deploy

```sh
npx wrangler login
npx wrangler d1 create pulseboard        # copy the database_id into wrangler.jsonc
npm run db:migrate:remote
npm run deploy
```

## License

MIT
