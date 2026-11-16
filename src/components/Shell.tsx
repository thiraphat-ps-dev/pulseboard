import type { ReactNode } from 'react';
import { Button, Menu } from 'thira-ui';
import { api } from '../api';
import { useSession } from '../App';
import { Link, navigate } from '../router';
import { ThemeToggle } from './ThemeToggle';

export function Logo() {
  return (
    <span className="logo">
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--pb-good)" />
        <path d="M5 17h6l3-7 4 13 3-6h6" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Pulseboard
    </span>
  );
}

/** Signed-in layout: top bar with the account menu. */
export function Shell({ children }: { children: ReactNode }) {
  const { me, setMe } = useSession();
  const logout = async () => {
    await api.logout().catch(() => undefined);
    setMe(null);
    navigate('/');
  };
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/app" className="brand" aria-label="Pulseboard dashboard">
          <Logo />
        </Link>
        <nav className="topnav" aria-label="Main">
          <Link href="/app">Monitors</Link>
          {me && (
            <a href={`/s/${me.slug}`} target="_blank" rel="noreferrer">
              Status page ↗
            </a>
          )}
        </nav>
        <div className="topbar-end">
          <ThemeToggle />
          <Menu>
            <Menu.Trigger render={<Button variant="ghost" size="sm" />}>
              <span className="account-email">{me?.email}</span>
              <span aria-hidden="true">▾</span>
            </Menu.Trigger>
            <Menu.Content align="end">
              <Menu.Item onClick={() => navigate('/app/settings')}>Settings</Menu.Item>
              <Menu.Separator />
              <Menu.Item onClick={() => void logout()}>Log out</Menu.Item>
            </Menu.Content>
          </Menu>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
