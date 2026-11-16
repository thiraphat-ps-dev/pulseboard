import { Hono } from 'hono';
import { requireUser, toMe } from '../auth';
import { sendAlert } from '../checker';
import { HttpError, type AppEnv } from '../env';
import { validateTarget } from '../lib/target';
import { cleanText, slugProblem } from '../lib/validate';
import { readJson } from './util';

export const me = new Hono<AppEnv>();
me.use('*', requireUser);

me.patch('/', async (c) => {
  const user = c.get('user');
  const body = await readJson(c);
  const next = { ...user };

  if (body.slug !== undefined) {
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const problem = slugProblem(slug);
    if (problem) throw new HttpError(400, problem);
    if (slug !== user.slug) {
      const taken = await c.env.DB.prepare('SELECT 1 FROM users WHERE slug = ?').bind(slug).first();
      if (taken) throw new HttpError(409, 'That address is taken');
    }
    next.slug = slug;
  }
  if (body.pageTitle !== undefined) {
    const title = cleanText(body.pageTitle, 60);
    if (!title) throw new HttpError(400, 'Title must be 1–60 characters');
    next.page_title = title;
  }
  if (body.webhookUrl !== undefined) {
    if (body.webhookUrl === null || body.webhookUrl === '') {
      next.webhook_url = null;
    } else {
      const t = validateTarget(String(body.webhookUrl), { httpsOnly: true });
      if (!t.ok) throw new HttpError(400, t.error);
      next.webhook_url = t.url;
    }
  }

  await c.env.DB.prepare('UPDATE users SET slug = ?, page_title = ?, webhook_url = ? WHERE id = ?')
    .bind(next.slug, next.page_title, next.webhook_url, user.id)
    .run();
  return c.json(toMe(next));
});

me.post('/test-alert', async (c) => {
  const user = c.get('user');
  if (!user.webhook_url) throw new HttpError(400, 'Add a webhook URL first');
  const ok = await sendAlert(user.webhook_url, '✅ Pulseboard test alert. Down and recovery alerts will arrive here.');
  if (!ok) throw new HttpError(400, 'The webhook did not accept the message. Check the URL.');
  return c.json({ ok: true });
});
