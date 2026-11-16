import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './crypto';
import { nextState } from './state';
import { validateTarget } from './target';
import { DAY_MS, dayBars, overallUptime } from './uptime';
import { slugFromEmail, slugProblem } from './validate';

describe('validateTarget', () => {
  it('accepts public http(s) URLs and normalizes them', () => {
    expect(validateTarget(' https://example.com ')).toEqual({ ok: true, url: 'https://example.com/' });
    expect(validateTarget('http://example.com:8080/health?x=1').ok).toBe(true);
  });

  it.each([
    'ftp://example.com',
    'javascript:alert(1)',
    'not a url',
    'https://user:pass@example.com',
  ])('rejects %s', (url) => {
    expect(validateTarget(url).ok).toBe(false);
  });

  it.each([
    'http://localhost:3000',
    'http://app.localhost',
    'http://127.0.0.1',
    'http://10.1.2.3',
    'http://172.20.0.1',
    'http://192.168.1.1',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://2130706433/', // 127.0.0.1 as a single number
    'http://0x7f.0.0.1/',
    'http://printer.local',
  ])('refuses private target %s', (url) => {
    expect(validateTarget(url)).toEqual({ ok: false, error: 'Private and local addresses cannot be monitored' });
  });

  it('allows private targets when asked (local dev)', () => {
    expect(validateTarget('http://localhost:5173', { allowPrivate: true }).ok).toBe(true);
  });

  it('can require https (webhooks)', () => {
    expect(validateTarget('http://hooks.example.com/x', { httpsOnly: true }).ok).toBe(false);
    expect(validateTarget('https://hooks.example.com/x', { httpsOnly: true }).ok).toBe(true);
  });

  it('does not treat public addresses next to private ranges as private', () => {
    expect(validateTarget('http://172.32.0.1').ok).toBe(true);
    expect(validateTarget('http://11.0.0.1').ok).toBe(true);
  });
});

describe('nextState', () => {
  it('needs two failures in a row before going down', () => {
    const a = nextState({ status: 'up', consecutiveFailures: 0 }, false);
    expect(a).toEqual({ status: 'up', consecutiveFailures: 1, event: null });
    const b = nextState(a, false);
    expect(b).toEqual({ status: 'down', consecutiveFailures: 2, event: 'down' });
    const c = nextState(b, false);
    expect(c.event).toBeNull();
  });

  it('a single blip resets without an incident', () => {
    const a = nextState({ status: 'up', consecutiveFailures: 0 }, false);
    expect(nextState(a, true)).toEqual({ status: 'up', consecutiveFailures: 0, event: null });
  });

  it('reports recovery once', () => {
    const r = nextState({ status: 'down', consecutiveFailures: 5 }, true);
    expect(r).toEqual({ status: 'up', consecutiveFailures: 0, event: 'recovered' });
    expect(nextState(r, true).event).toBeNull();
  });

  it('a new monitor goes up on its first success', () => {
    expect(nextState({ status: 'pending', consecutiveFailures: 0 }, true).status).toBe('up');
  });
});

describe('dayBars / overallUptime', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');

  it('fills missing days with null, oldest first', () => {
    const bars = dayBars([{ d: '2026-11-15', total: 4, up: 3 }], 3, now);
    expect(bars).toEqual([
      { date: '2026-11-14', checks: 0, uptime: null },
      { date: '2026-11-15', checks: 4, uptime: 0.75 },
      { date: '2026-11-16', checks: 0, uptime: null },
    ]);
  });

  it('weights uptime by number of checks', () => {
    const bars = dayBars(
      [
        { d: '2026-11-15', total: 100, up: 100 },
        { d: '2026-11-16', total: 10, up: 0 },
      ],
      2,
      now,
    );
    expect(overallUptime(bars)).toBeCloseTo(100 / 110);
    expect(overallUptime(dayBars([], 90, now))).toBeNull();
  });

  it('covers exactly the requested number of days', () => {
    const bars = dayBars([], 90, now);
    expect(bars).toHaveLength(90);
    expect(bars[0].date).toBe(new Date(now - 89 * DAY_MS).toISOString().slice(0, 10));
  });
});

describe('passwords', () => {
  it('verifies the right password and rejects others', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored).toMatch(/^pbkdf2-sha256\$100000\$/);
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('wrong password!', stored)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });
});

describe('slugs', () => {
  it('derives a slug from the email', () => {
    expect(slugFromEmail('Jane.Doe+ops@example.com')).toBe('jane-doe-ops');
    expect(slugFromEmail('a@example.com')).toBe('status-a');
    expect(slugFromEmail('admin@example.com')).toBe('status-admin');
  });

  it('validates slugs', () => {
    expect(slugProblem('acme-status')).toBeNull();
    expect(slugProblem('ab')).not.toBeNull();
    expect(slugProblem('-acme')).not.toBeNull();
    expect(slugProblem('Acme')).not.toBeNull();
    expect(slugProblem('api')).toBe('That address is reserved');
  });
});
