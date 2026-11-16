import { useState, type FormEvent } from 'react';
import { Button, Card, Input, Switch, useToast } from 'thira-ui';
import { api, ApiError } from '../api';
import { useSession } from '../App';
import { Shell } from '../components/Shell';

export function Settings() {
  const { me, setMe } = useSession();
  const { toast } = useToast();
  const [title, setTitle] = useState(me?.pageTitle ?? '');
  const [slug, setSlug] = useState(me?.slug ?? '');
  const [webhook, setWebhook] = useState(me?.webhookUrl ?? '');
  const [errors, setErrors] = useState<{ page?: string; webhook?: string }>({});
  const [busy, setBusy] = useState<'page' | 'webhook' | 'test' | 'email' | 'test-email' | null>(null);
  if (!me) return null;

  const savePage = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('page');
    setErrors({});
    try {
      setMe(await api.updateMe({ pageTitle: title, slug }));
      toast({ title: 'Status page saved', tone: 'success' });
    } catch (err) {
      setErrors({ page: err instanceof ApiError ? err.message : 'Could not save' });
    } finally {
      setBusy(null);
    }
  };

  const saveWebhook = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('webhook');
    setErrors({});
    try {
      setMe(await api.updateMe({ webhookUrl: webhook.trim() || null }));
      toast({ title: webhook.trim() ? 'Alerts will go to this webhook' : 'Alerts turned off', tone: 'success' });
    } catch (err) {
      setErrors({ webhook: err instanceof ApiError ? err.message : 'Could not save' });
    } finally {
      setBusy(null);
    }
  };

  const toggleEmail = async (on: boolean) => {
    setBusy('email');
    try {
      setMe(await api.updateMe({ emailAlerts: on }));
      toast({ title: on ? `Alerts will be emailed to ${me.email}` : 'Email alerts turned off', tone: 'success' });
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : 'Could not save', tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const test = async (channel: 'webhook' | 'email') => {
    setBusy(channel === 'email' ? 'test-email' : 'test');
    try {
      await api.testAlert(channel);
      toast({ title: channel === 'email' ? `Test email sent to ${me.email}` : 'Test alert sent', tone: 'success' });
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : 'Could not send', tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const pageUrl = `${location.origin}/s/${me.slug}`;

  return (
    <Shell>
      <h1>Settings</h1>

      <Card>
        <Card.Header>
          <Card.Title render={<h2 />}>Status page</Card.Title>
          <Card.Description>
            Live at{' '}
            <a href={`/s/${me.slug}`} target="_blank" rel="noreferrer">
              {pageUrl}
            </a>
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <form className="stack" onSubmit={(e) => void savePage(e)}>
            <Input label="Title" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input
              label="Address"
              hint={`${location.host}/s/${slug || '…'}`}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              error={errors.page}
            />
            <div>
              <Button type="submit" loading={busy === 'page'}>
                Save
              </Button>
            </div>
          </form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title render={<h2 />}>Alerts</Card.Title>
          <Card.Description>
            We alert you when a monitor goes down and when it recovers. Changes in the same minute arrive as
            one message.
          </Card.Description>
        </Card.Header>
        <Card.Body className="stack">
          <div className="row split">
            <Switch
              label="Email alerts"
              description={
                me.emailAvailable ? `Sent to ${me.email}` : 'Not set up on this server (needs RESEND_API_KEY)'
              }
              checked={me.emailAlerts}
              disabled={!me.emailAvailable || busy === 'email'}
              onCheckedChange={(on) => void toggleEmail(on)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void test('email')}
              loading={busy === 'test-email'}
              disabled={!me.emailAlerts}
            >
              Send test email
            </Button>
          </div>
          <form className="stack" onSubmit={(e) => void saveWebhook(e)}>
            <Input
              label="Discord or Slack webhook URL"
              type="url"
              placeholder="https://discord.com/api/webhooks/…"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              error={errors.webhook}
            />
            <div className="row">
              <Button type="submit" loading={busy === 'webhook'}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => void test('webhook')} loading={busy === 'test'} disabled={!me.webhookUrl}>
                Send test alert
              </Button>
            </div>
          </form>
        </Card.Body>
      </Card>
    </Shell>
  );
}
