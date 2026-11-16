import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Skeleton, Stat, useToast } from 'thira-ui';
import { MAX_MONITORS_PER_USER, type MonitorSummary } from '../../shared/types';
import { api } from '../api';
import { Sparkline } from '../components/LatencyChart';
import { MonitorForm } from '../components/MonitorForm';
import { Shell } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import { ago, intervalLabel, ms, pct } from '../format';
import { Link, navigate } from '../router';
import { usePolling } from '../usePolling';

export function Dashboard() {
  const { toast } = useToast();
  const [monitors, setMonitors] = useState<MonitorSummary[] | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.monitors().then(setMonitors).catch(() => toast({ title: 'Could not load monitors', tone: 'danger' }));
  }, [toast]);
  useEffect(load, [load]);
  usePolling(load, 30_000);

  const down = monitors?.filter((m) => m.status === 'down' && !m.paused).length ?? 0;
  const up = monitors?.filter((m) => m.status === 'up' && !m.paused).length ?? 0;
  const latencies = monitors?.map((m) => m.lastLatencyMs).filter((v): v is number => v !== null) ?? [];
  const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;
  const full = (monitors?.length ?? 0) >= MAX_MONITORS_PER_USER;

  return (
    <Shell>
      <div className="page-head">
        <h1>Monitors</h1>
        <Button onClick={() => setAdding(true)} disabled={full}>
          Add monitor
        </Button>
      </div>

      {monitors && monitors.length > 0 && (
        <div className="stats stats-3">
          <Stat label="Up" value={up} />
          <Stat label="Down" value={down} hint={down ? 'Alerts sent' : 'All clear'} />
          <Stat label="Avg response" value={avgLatency === null ? '—' : Math.round(avgLatency)} unit={avgLatency === null ? undefined : 'ms'} />
        </div>
      )}

      {monitors === null ? (
        <div className="monitor-list">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rect" height={72} />
          ))}
        </div>
      ) : monitors.length === 0 ? (
        <Card className="empty">
          <Card.Body>
            <h2>Add your first monitor</h2>
            <p className="muted">Paste a URL. We'll check it on a schedule and tell you when it stops responding.</p>
            <Button onClick={() => setAdding(true)}>Add monitor</Button>
          </Card.Body>
        </Card>
      ) : (
        <ul className="monitor-list" aria-label="Monitors">
          {monitors.map((m) => (
            <li key={m.id}>
              <Link href={`/app/monitors/${m.id}`} className="monitor-row" data-status={m.paused ? 'paused' : m.status}>
                <div className="monitor-main">
                  <span className="monitor-name">{m.name}</span>
                  <span className="monitor-url">{m.url.replace(/^https?:\/\//, '')}</span>
                </div>
                <StatusBadge status={m.status} paused={m.paused} />
                <Sparkline values={m.recent} label={`${m.name} response time`} />
                <dl className="monitor-meta">
                  <div>
                    <dt>24h</dt>
                    <dd>{pct(m.uptime24h)}</dd>
                  </div>
                  <div>
                    <dt>Last</dt>
                    <dd>{ms(m.lastLatencyMs)}</dd>
                  </div>
                  <div className="meta-wide">
                    <dt>{intervalLabel(m.intervalS)}</dt>
                    <dd>{ago(m.lastCheckedAt)}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {full && <p className="muted">You've reached the limit of {MAX_MONITORS_PER_USER} monitors.</p>}

      {adding && (
        <MonitorForm
          open={adding}
          onOpenChange={setAdding}
          onSave={async (input) => {
            const m = await api.createMonitor(input);
            toast({ title: `Monitoring ${m.name}`, description: 'The first check runs now.', tone: 'success' });
            navigate(`/app/monitors/${m.id}`);
          }}
        />
      )}
    </Shell>
  );
}
