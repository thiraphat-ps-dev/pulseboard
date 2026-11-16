import type { MonitorStatus } from '../../shared/types';

/** Failures in a row before a monitor counts as down. One blip shouldn't page anyone. */
export const FAILURES_TO_DOWN = 2;

export interface MonitorState {
  status: MonitorStatus;
  consecutiveFailures: number;
}

export type Transition = 'down' | 'recovered' | null;

/** Pure state machine for one check result. */
export function nextState(prev: MonitorState, ok: boolean): MonitorState & { event: Transition } {
  if (ok) {
    return { status: 'up', consecutiveFailures: 0, event: prev.status === 'down' ? 'recovered' : null };
  }
  const failures = prev.consecutiveFailures + 1;
  if (prev.status === 'down') return { status: 'down', consecutiveFailures: failures, event: null };
  if (failures >= FAILURES_TO_DOWN) return { status: 'down', consecutiveFailures: failures, event: 'down' };
  // Still "up" (or pending) while we wait for confirmation
  return { status: prev.status, consecutiveFailures: failures, event: null };
}
