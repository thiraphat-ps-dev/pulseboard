import { describe, expect, it } from 'vitest';
import { buildAlert, emailText, formatDuration, type Notice } from './notify';

const base: Notice = {
  event: 'down',
  monitorName: 'API',
  url: 'https://api.example.com/',
  error: 'HTTP 503',
  latencyMs: 120,
  downForMs: null,
  at: Date.UTC(2026, 10, 16, 9, 30),
};

describe('formatDuration', () => {
  it('rounds to minutes, at least one', () => {
    expect(formatDuration(5_000)).toBe('1 min');
    expect(formatDuration(12 * 60_000)).toBe('12 min');
    expect(formatDuration(125 * 60_000)).toBe('2 h 5 min');
  });
});

describe('buildAlert', () => {
  it('sends nothing for no notices', () => {
    expect(buildAlert([])).toBeNull();
  });

  it('formats a single down notice', () => {
    expect(buildAlert([base])).toEqual({
      subject: '🔴 API is down',
      text: '🔴 API is down: HTTP 503\nhttps://api.example.com/',
    });
  });

  it('formats a recovery with its duration', () => {
    const msg = buildAlert([{ ...base, event: 'recovered', error: null, downForMs: 7 * 60_000 }]);
    expect(msg?.subject).toBe('🟢 API is back up');
    expect(msg?.text).toBe('🟢 API is back up after 7 min (120 ms)\nhttps://api.example.com/');
  });

  it('combines several notices, down first', () => {
    const msg = buildAlert([
      { ...base, monitorName: 'Web', event: 'recovered', error: null },
      base,
      { ...base, monitorName: 'Docs', error: 'Timed out after 10s' },
    ]);
    expect(msg?.subject).toBe('🔴 3 monitors changed: 2 down, 1 back up');
    expect(msg?.text.split('\n\n').map((b) => b.split('\n')[0])).toEqual([
      '🔴 API is down: HTTP 503',
      '🔴 Docs is down: Timed out after 10s',
      '🟢 Web is back up (120 ms)',
    ]);
  });

  it('uses a green subject when everything recovered', () => {
    const up = { ...base, event: 'recovered' as const, error: null };
    expect(buildAlert([up, { ...up, monitorName: 'Web' }])?.subject).toBe('🟢 2 monitors changed: 2 back up');
  });
});

describe('emailText', () => {
  it('adds a UTC timestamp footer', () => {
    const msg = buildAlert([base])!;
    expect(emailText(msg, base.at)).toBe(`${msg.text}\n\n—\nChecked at 2026-11-16 09:30 UTC by Pulseboard.\nTurn email alerts off in Settings.`);
  });
});
