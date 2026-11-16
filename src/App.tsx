import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Spinner } from 'thira-ui';
import type { Me } from '../shared/types';
import { api, ApiError } from './api';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';
import { MonitorPage } from './pages/MonitorPage';
import { Settings } from './pages/Settings';
import { StatusPage } from './pages/StatusPage';
import { match, navigate, usePath } from './router';

interface Session {
  me: Me | null;
  setMe: (me: Me | null) => void;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession outside App');
  return s;
}

function Loading() {
  return (
    <div className="center-screen">
      <Spinner label="Loading" />
    </div>
  );
}

/** Routes under /app need an account. */
function Private({ me, children }: { me: Me | null; children: ReactNode }) {
  useEffect(() => {
    if (!me) navigate(`/login?next=${encodeURIComponent(location.pathname)}`, { replace: true });
  }, [me]);
  return me ? children : <Loading />;
}

export function App() {
  const path = usePath();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    // The public status page doesn't need to know who's logged in
    if (path.startsWith('/s/')) return;
    if (me !== undefined) return;
    api
      .me()
      .then(setMe)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) setMe(null);
        else setMe(null);
      });
  }, [path, me]);

  const status = match('/s/:slug', path);
  if (status) return <StatusPage slug={status.slug} />;
  if (me === undefined) return <Loading />;

  const session: Session = { me, setMe };
  let page: ReactNode;
  let params: Record<string, string> | null;
  if (path === '/' || path === '') page = <Landing />;
  else if (path === '/login') page = <AuthPage mode="login" />;
  else if (path === '/signup') page = <AuthPage mode="signup" />;
  else if (path === '/app') page = <Private me={me}><Dashboard /></Private>;
  else if (path === '/app/settings') page = <Private me={me}><Settings /></Private>;
  else if ((params = match('/app/monitors/:id', path))) page = <Private me={me}><MonitorPage id={params.id} /></Private>;
  else page = <NotFound />;

  return <SessionContext.Provider value={session}>{page}</SessionContext.Provider>;
}

function NotFound() {
  return (
    <div className="center-screen stack">
      <h1>Page not found</h1>
      <a href="/">Go home</a>
    </div>
  );
}
