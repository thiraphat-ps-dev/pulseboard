import { INTERVALS } from '../../shared/types';

const RESERVED_SLUGS = new Set(['admin', 'api', 'app', 'login', 'signup', 'status', 'settings', 'www', 'help']);

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function passwordProblem(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'Enter a password';
  if (raw.length < 10) return 'Use at least 10 characters';
  if (raw.length > 200) return 'Use at most 200 characters';
  return null;
}

export function slugProblem(slug: string): string | null {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(slug)) {
    return 'Use 3–32 lowercase letters, numbers or dashes, starting and ending with a letter or number';
  }
  if (RESERVED_SLUGS.has(slug)) return 'That address is reserved';
  return null;
}

/** A starting slug from the email's local part, e.g. "Jane.Doe+x@…" -> "jane-doe-x". */
export function slugFromEmail(email: string): string {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return base.length >= 3 && !RESERVED_SLUGS.has(base) ? base : `status-${base}`.replace(/-+$/, '');
}

export type SignupMode = 'open' | 'invite' | 'closed';

export function signupMode(setting: string | undefined): SignupMode {
  const v = (setting ?? '').trim();
  return v === '*' ? 'open' : v === '' ? 'closed' : 'invite';
}

/** Whether `email` (already normalized) may create an account under `setting`. */
export function canSignUp(setting: string | undefined, email: string): boolean {
  const mode = signupMode(setting);
  if (mode !== 'invite') return mode === 'open';
  return (setting ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(email);
}

export function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().replace(/\s+/g, ' ');
  return s.length === 0 || s.length > max ? null : s;
}

export function isInterval(v: unknown): v is (typeof INTERVALS)[number] {
  return INTERVALS.includes(v as (typeof INTERVALS)[number]);
}
