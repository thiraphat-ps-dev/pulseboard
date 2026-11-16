import { Button } from 'thira-ui';
import { useSession } from '../App';
import { Logo } from '../components/Shell';
import { ThemeToggle } from '../components/ThemeToggle';
import { UptimeBars } from '../components/UptimeBars';
import { Link } from '../router';

// Illustrative bars for the hero: mostly green with one bad day and one partial day
const DEMO_DAYS = Array.from({ length: 90 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
  checks: 288,
  uptime: i === 61 ? 0.91 : i === 34 || i === 77 ? 0.982 : 1,
}));

export function Landing() {
  const { me } = useSession();
  return (
    <div className="landing">
      <header className="topbar">
        <Logo />
        <div className="topbar-end">
          <ThemeToggle />
          {me ? (
            <Button size="sm" render={<Link href="/app" />}>Open dashboard</Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" render={<Link href="/login" />}>Log in</Button>
              <Button size="sm" render={<Link href="/signup" />}>Sign up</Button>
            </>
          )}
        </div>
      </header>
      <main className="hero">
        <h1>Know when your site goes down, before your users tell you.</h1>
        <p className="lead">
          Pulseboard checks your sites every minute, alerts you on Discord or Slack when one fails, and gives you a
          public status page to share.
        </p>
        <div className="hero-actions">
          <Button size="lg" render={<Link href={me ? '/app' : '/signup'} />}>
            {me ? 'Open dashboard' : 'Start monitoring, free'}
          </Button>
        </div>
        <section className="hero-demo" aria-label="Example status page">
          <div className="demo-head">
            <strong>API</strong>
            <span className="muted">99.93% uptime</span>
          </div>
          <UptimeBars days={DEMO_DAYS} label="Example" />
        </section>
        <ul className="features">
          <li>
            <h2>Checks every minute</h2>
            <p>HTTP checks from Cloudflare's network, with response times for every check.</p>
          </li>
          <li>
            <h2>No false alarms</h2>
            <p>A monitor is only marked down after two failed checks in a row.</p>
          </li>
          <li>
            <h2>Public status page</h2>
            <p>90 days of history and incidents at your own address. URLs stay private.</p>
          </li>
        </ul>
      </main>
    </div>
  );
}
