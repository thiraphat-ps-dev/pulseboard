import { useCallback, useEffect, useState } from 'react';
import { Skeleton } from 'thira-ui';
import type { PublicStatus } from '../../shared/types';
import { api, ApiError } from '../api';
import { IncidentList } from '../components/IncidentList';
import { Logo } from '../components/Shell';
import { ThemeToggle } from '../components/ThemeToggle';
import { UptimeBars, UptimeLegend } from '../components/UptimeBars';
import { fmtDateTime, pct } from '../format';
import { usePolling } from '../usePolling';

const HEADLINE: Record<PublicStatus['overall'], { text: string; icon: string }> = {
  operational: { text: 'All systems operational', icon: '✓' },
  degraded: { text: 'Some systems are down', icon: '!' },
  outage: { text: 'Major outage', icon: '✕' },
  empty: { text: 'Nothing to show yet', icon: '·' },
};

export function StatusPage({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicStatus | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(() => {
    api
      .status(slug)
      .then((d) => {
        setData(d);
        document.title = `${d.title} · Status`;
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) setMissing(true);
      });
  }, [slug]);
  useEffect(load, [load]);
  usePolling(load, 60_000);

  return (
    <div className="status-page">
      <header className="status-top">
        <h1>{data?.title ?? (missing ? 'Status page not found' : <Skeleton variant="text" width={200} />)}</h1>
        <ThemeToggle />
      </header>

      {missing && <p className="muted">There's no status page at this address.</p>}

      {data && (
        <>
          <div className="headline" data-overall={data.overall} role="status">
            <span className="headline-icon" aria-hidden="true">
              {HEADLINE[data.overall].icon}
            </span>
            {HEADLINE[data.overall].text}
          </div>

          {data.monitors.length > 0 && (
            <section className="status-card" aria-label="Services">
              {data.monitors.map((m) => (
                <div key={m.id} className="service">
                  <div className="service-head">
                    <span className="service-name">{m.name}</span>
                    <span className="service-state" data-status={m.status}>
                      {m.status === 'up' ? 'Operational' : m.status === 'down' ? 'Down' : 'Checking'}
                    </span>
                  </div>
                  <UptimeBars days={m.days} label={m.name} />
                  <div className="service-foot muted small">
                    <span>
                      <span className="range-90">90 days ago</span>
                      <span className="range-30">30 days ago</span>
                    </span>
                    <span>{pct(m.uptime90d)} uptime</span>
                    <span>Today</span>
                  </div>
                </div>
              ))}
              <UptimeLegend />
            </section>
          )}

          <section className="status-incidents">
            <h2>Past incidents</h2>
            <IncidentList incidents={data.incidents} now={data.updatedAt} showMonitor empty="No incidents in the last 14 days." />
          </section>

          <footer className="status-foot muted small">
            <span>Updated {fmtDateTime(data.updatedAt)}</span>
            <a href="/" className="powered">
              Powered by <Logo />
            </a>
          </footer>
        </>
      )}
    </div>
  );
}
