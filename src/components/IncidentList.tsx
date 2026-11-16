import { Badge } from 'thira-ui';
import type { Incident } from '../../shared/types';
import { duration, fmtDateTime } from '../format';

export function IncidentList({
  incidents,
  now,
  showMonitor,
  empty = 'No incidents. 🎉',
}: {
  incidents: Incident[];
  now: number;
  showMonitor: boolean;
  empty?: string;
}) {
  if (incidents.length === 0) return <p className="muted">{empty}</p>;
  return (
    <ol className="incidents">
      {incidents.map((i) => (
        <li key={i.id} className="incident" data-open={i.resolvedAt === null || undefined}>
          <div className="incident-head">
            {i.resolvedAt === null ? (
              <Badge tone="danger" dot>
                Ongoing
              </Badge>
            ) : (
              <Badge tone="success" variant="outline">
                Resolved
              </Badge>
            )}
            <strong>{showMonitor ? `${i.monitorName} was down` : 'Down'}</strong>
          </div>
          <p className="muted small">
            {fmtDateTime(i.startedAt)} ·{' '}
            {i.resolvedAt === null ? `for ${duration(i.startedAt, now)} so far` : `lasted ${duration(i.startedAt, i.resolvedAt)}`}
            {!showMonitor && ` · ${i.cause}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
