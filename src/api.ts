import type { Me, MonitorDetail, MonitorInput, MonitorSummary, PublicStatus } from '../shared/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'error' in data ? String(data.error) : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  me: () => request<Me>('GET', '/auth/me'),
  config: () => request<{ signups: 'open' | 'invite' | 'closed' }>('GET', '/auth/config'),
  signup: (email: string, password: string) => request<Me>('POST', '/auth/signup', { email, password }),
  login: (email: string, password: string) => request<Me>('POST', '/auth/login', { email, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  updateMe: (patch: Partial<Pick<Me, 'slug' | 'pageTitle' | 'webhookUrl' | 'emailAlerts'>>) => request<Me>('PATCH', '/me', patch),
  testAlert: (channel: 'webhook' | 'email') => request<{ ok: true }>('POST', '/me/test-alert', { channel }),

  monitors: () => request<MonitorSummary[]>('GET', '/monitors'),
  monitor: (id: string) => request<MonitorDetail>('GET', `/monitors/${id}`),
  createMonitor: (input: MonitorInput) => request<MonitorSummary>('POST', '/monitors', input),
  updateMonitor: (id: string, patch: Partial<MonitorInput>) => request<MonitorSummary>('PATCH', `/monitors/${id}`, patch),
  deleteMonitor: (id: string) => request<void>('DELETE', `/monitors/${id}`),
  checkNow: (id: string) => request<{ ok: boolean; latencyMs: number; error: string | null }>('POST', `/monitors/${id}/check`),

  status: (slug: string) => request<PublicStatus>('GET', `/status/${encodeURIComponent(slug)}`),
};
