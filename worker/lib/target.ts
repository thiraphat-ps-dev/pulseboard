// Validation for user-supplied URLs the checker will fetch (and webhook URLs it will post to).
// Anyone can sign up, so refuse targets that point at private or loopback addresses.

const PRIVATE_V4 = [
  [10, 0, 0, 0, 8],
  [127, 0, 0, 0, 8],
  [169, 254, 0, 0, 16],
  [172, 16, 0, 0, 12],
  [192, 168, 0, 0, 16],
  [100, 64, 0, 0, 10],
  [0, 0, 0, 0, 8],
] as const;

function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const n = m.slice(1).map(Number);
  if (n.some((x) => x > 255)) return true; // malformed: refuse
  const ip = ((n[0] << 24) >>> 0) + (n[1] << 16) + (n[2] << 8) + n[3];
  return PRIVATE_V4.some(([a, b, c, d, bits]) => {
    const base = ((a << 24) >>> 0) + (b << 16) + (c << 8) + d;
    const mask = (~0 << (32 - bits)) >>> 0;
    return ((ip & mask) >>> 0) === ((base & mask) >>> 0);
  });
}

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.startsWith('[')) {
    // IPv6 literal: refuse loopback, unspecified, link-local, unique-local and IPv4-mapped
    const v6 = h.slice(1, -1);
    return v6 === '::1' || v6 === '::' || /^(fe8|fe9|fea|feb|fc|fd)/.test(v6) || v6.startsWith('::ffff:');
  }
  // Bare numbers like http://2130706433 resolve to 127.0.0.1 in some clients
  if (/^\d+$/.test(h) || /^0x[0-9a-f]+$/.test(h)) return true;
  return isPrivateIPv4(h);
}

export type TargetResult = { ok: true; url: string } | { ok: false; error: string };

export function validateTarget(raw: string, opts: { allowPrivate?: boolean; httpsOnly?: boolean } = {}): TargetResult {
  const input = raw.trim();
  if (input.length === 0) return { ok: false, error: 'Enter a URL' };
  if (input.length > 2048) return { ok: false, error: 'URL is too long' };
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: 'Not a valid URL' };
  }
  const allowed = opts.httpsOnly ? ['https:'] : ['http:', 'https:'];
  if (!allowed.includes(url.protocol)) {
    return { ok: false, error: opts.httpsOnly ? 'URL must start with https://' : 'URL must start with http:// or https://' };
  }
  if (url.username || url.password) return { ok: false, error: 'URLs with a username or password are not allowed' };
  if (!opts.allowPrivate && isPrivateHost(url.hostname)) {
    return { ok: false, error: 'Private and local addresses cannot be monitored' };
  }
  return { ok: true, url: url.toString() };
}
