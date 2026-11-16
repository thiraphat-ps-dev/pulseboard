import { Badge } from 'thira-ui';
import type { MonitorStatus } from '../../shared/types';

export function StatusBadge({ status, paused }: { status: MonitorStatus; paused?: boolean }) {
  if (paused) return <Badge tone="neutral" dot>Paused</Badge>;
  if (status === 'up') return <Badge tone="success" dot>Up</Badge>;
  if (status === 'down') return <Badge tone="danger" dot>Down</Badge>;
  return <Badge tone="neutral" dot>Checking…</Badge>;
}
