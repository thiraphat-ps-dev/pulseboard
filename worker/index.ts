import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { onSchedule } from './checker';
import { HttpError, type AppEnv, type Env } from './env';
import { auth } from './routes/auth';
import { me } from './routes/me';
import { monitors } from './routes/monitors';
import { status } from './routes/status';

const app = new Hono<AppEnv>().basePath('/api');

// Reject cross-site form posts: state-changing requests must come from this origin
app.use('*', csrf());
app.use('*', async (c, next) => {
  await next();
  if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store');
});

app.route('/auth', auth);
app.route('/me', me);
app.route('/monitors', monitors);
app.route('/status', status);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  if (err instanceof HTTPException) return c.json({ error: err.message || 'Forbidden' }, err.status);
  console.error(err);
  return c.json({ error: 'Something went wrong' }, 500);
});

export default {
  fetch: app.fetch,
  scheduled(event, env, ctx) {
    ctx.waitUntil(onSchedule(env, event.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
