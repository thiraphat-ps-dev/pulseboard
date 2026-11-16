import { Hono } from 'hono';
import { allow, clientIp, endSession, requireUser, startSession, toMe } from '../auth';
import { HttpError, type AppEnv, type UserRow } from '../env';
import { hashPassword, randomId, verifyPassword } from '../lib/crypto';
import { normalizeEmail, passwordProblem, slugFromEmail } from '../lib/validate';
import { readJson } from './util';

// Compared against when the email doesn't exist, so a miss takes as long as a wrong password
const DUMMY_HASH = 'pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export const auth = new Hono<AppEnv>();

auth.post('/signup', async (c) => {
  if (!(await allow(c.env.DB, `signup:${clientIp(c)}`, 5, 3_600_000))) {
    throw new HttpError(429, 'Too many sign-ups from this network. Try again later.');
  }
  const body = await readJson(c);
  const email = normalizeEmail(body.email);
  if (!email) throw new HttpError(400, 'Enter a valid email');
  const problem = passwordProblem(body.password);
  if (problem) throw new HttpError(400, problem);

  const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first();
  if (exists) throw new HttpError(409, 'An account with this email already exists');

  // Find a free slug: base, base-2, base-3, …
  const base = slugFromEmail(email);
  const { results } = await c.env.DB.prepare("SELECT slug FROM users WHERE slug = ? OR slug LIKE ? || '-%'")
    .bind(base, base)
    .all<{ slug: string }>();
  const taken = new Set(results.map((r) => r.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

  const user: UserRow = {
    id: randomId(),
    email,
    password_hash: await hashPassword(body.password as string),
    slug,
    page_title: 'Service status',
    webhook_url: null,
    created_at: Date.now(),
  };
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, slug, page_title, webhook_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(user.id, user.email, user.password_hash, user.slug, user.page_title, user.webhook_url, user.created_at)
    .run();
  await startSession(c, user.id);
  return c.json(toMe(user), 201);
});

auth.post('/login', async (c) => {
  const body = await readJson(c);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const ipOk = await allow(c.env.DB, `login-ip:${clientIp(c)}`, 30, 900_000);
  const emailOk = email ? await allow(c.env.DB, `login-email:${email}`, 10, 900_000) : true;
  if (!ipOk || !emailOk) throw new HttpError(429, 'Too many attempts. Wait 15 minutes and try again.');

  const user = email
    ? await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
    : null;
  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'Email or password is incorrect');
  await startSession(c, user.id);
  return c.json(toMe(user));
});

auth.post('/logout', async (c) => {
  await endSession(c);
  return c.body(null, 204);
});

auth.get('/me', requireUser, (c) => c.json(toMe(c.get('user'))));
