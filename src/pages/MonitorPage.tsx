import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Dialog, Menu, Skeleton, Stat, useToast } from 'thira-ui';
import type { MonitorDetail } from '../../shared/types';
import { api, ApiError } from '../api';
import { LatencyChart } from '../components/LatencyChart';
import { MonitorForm } from '../components/MonitorForm';
import { Shell } from '../components/Shell';
import { StatusBadge } from '../components/StatusBadge';
import { UptimeBars, UptimeLegend } from '../components/UptimeBars';
import { IncidentList } from '../components/IncidentList';
import { ago, fmtDateTime, intervalLabel, ms, pct } from '../format';
import { Link, navigate } from '../router';
import { usePolling } from '../usePolling';

export function MonitorPage({ id }: { id: string }) {
  const { toast } = useToast();
  const [m, setM] = useState<MonitorDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    api
      .monitor(id)
      .then((d) => {
        setM(d);
        setNow(Date.now());
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else toast({ title: 'Could not load this monitor', tone: 'danger' });
      });
  }, [id, toast]);
  useEffect(load, [load]);
  usePolling(load, 30_000);

  // A brand-new monitor gets its first result a second or two after creation
  useEffect(() => {
    if (m && m.lastCheckedAt === null) {
      const t = setTimeout(load, 2500);
      return () => clearTimeout(t);
    }
  }, [m, load]);

  if (missing) {
    return (
      <Shell>
        <h1>Monitor not found</h1>
        <Link href="/app">Back to monitors</Link>
      </Shell>
    );
  }

  if (!m) {
    return (
      <Shell>
        <Skeleton variant="text" width={240} height={32} />
        <Skeleton variant="rect" height={260} />
      </Shell>
    );
  }

  const checkNow = async () => {
    setChecking(true);
    try {
      const r = await api.checkNow(m.id);
      toast({
        title: r.ok ? `Up · ${r.latencyMs} ms` : 'Check failed',
        description: r.ok ? undefined : r.error,
        tone: r.ok ? 'success' : 'danger',
      });
      load();
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : 'Check failed', tone: 'danger' });
    } finally {
      setChecking(false);
    }
  };

  const togglePause = async () => {
    const updated = await api.updateMonitor(m.id, { paused: !m.paused });
    toast({ title: updated.paused ? 'Paused. No checks or alerts.' : 'Resumed', tone: 'neutral' });
    load();
  };

  const remove = async () => {
    await api.deleteMonitor(m.id);
    toast({ title: `Deleted ${m.name}`, tone: 'neutral' });
    navigate('/app');
  };

  return (
    <Shell>
      <Link href="/app" className="back">
        ← Monitors
      </Link>
      <div className="page-head">
        <div className="title-block">
          <h1>
            {m.name} <StatusBadge status={m.status} paused={m.paused} />
          </h1>
          <a className="monitor-url" href={m.url} target="_blank" rel="noreferrer">
            {m.url}
          </a>
          <p className="muted small">
            {intervalLabel(m.intervalS)} · last checked {ago(m.lastCheckedAt, now)} · {m.isPublic ? 'public' : 'hidden from status page'}
          </p>
        </div>
        <div className="actions">
          <Button variant="outline" onClick={() => void checkNow()} loading={checking} disabled={m.paused}>
            Check now
          </Button>
          <Menu>
            <Menu.Trigger render={<Button variant="ghost" aria-label="More actions" />}>⋯</Menu.Trigger>
            <Menu.Content align="end">
              <Menu.Item onClick={() => setEditing(true)}>Edit</Menu.Item>
              <Menu.Item onClick={() => void togglePause()}>{m.paused ? 'Resume' : 'Pause'}</Menu.Item>
              <Menu.Separator />
              <Menu.Item tone="danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Menu.Item>
            </Menu.Content>
          </Menu>
        </div>
      </div>

      <div className="stats">
        <Stat label="Uptime 24h" value={pct(m.uptime24h)} />
        <Stat label="Uptime 7d" value={pct(m.uptime7d)} />
        <Stat label="Uptime 30d" value={pct(m.uptime30d)} />
        <Stat label="Last response" value={m.lastLatencyMs === null ? '—' : m.lastLatencyMs} unit={m.lastLatencyMs === null ? undefined : 'ms'} />
      </div>

      <Card>
        <Card.Header>
          <Card.Title render={<h2 />}>Response time</Card.Title>
          <Card.Description>Last 24 hours. Red ticks are failed checks.</Card.Description>
        </Card.Header>
        <Card.Body>
          <LatencyChart checks={m.checks} now={now} />
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title render={<h2 />}>Uptime, last 90 days</Card.Title>
        </Card.Header>
        <Card.Body>
          <UptimeBars days={m.days} label={m.name} />
          <UptimeLegend />
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title render={<h2 />}>Incidents</Card.Title>
        </Card.Header>
        <Card.Body>
          <IncidentList incidents={m.incidents} now={now} showMonitor={false} />
        </Card.Body>
      </Card>

      <RecentChecks detail={m} />

      {editing && (
        <MonitorForm
          open={editing}
          onOpenChange={setEditing}
          initial={{ name: m.name, url: m.url, intervalS: m.intervalS, isPublic: m.isPublic }}
          onSave={async (input) => {
            await api.updateMonitor(m.id, input);
            toast({ title: 'Saved', tone: 'success' });
            load();
          }}
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Dialog.Content title={`Delete ${m.name}?`} description="Its check history and incidents are deleted too. This can't be undone." size="sm">
          <Dialog.Footer>
            <Dialog.Close render={<Button variant="ghost" />}>Cancel</Dialog.Close>
            <Button variant="danger" onClick={() => void remove()}>
              Delete monitor
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </Shell>
  );
}

/** The last few checks as a table: the accessible view of the chart's data. */
function RecentChecks({ detail }: { detail: MonitorDetail }) {
  const rows = detail.checks.slice(-10).reverse();
  if (rows.length === 0) return null;
  return (
    <Card>
      <Card.Header>
        <Card.Title render={<h2 />}>Recent checks</Card.Title>
      </Card.Header>
      <Card.Body>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Result</th>
                <th scope="col" className="num">Response</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.t}>
                  <td>{fmtDateTime(c.t)}</td>
                  <td>{c.ok ? `✓ HTTP ${c.statusCode}` : `✕ ${c.error}`}</td>
                  <td className="num">{c.ok ? ms(c.latencyMs) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card.Body>
    </Card>
  );
}
