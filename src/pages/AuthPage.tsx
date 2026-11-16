import { useState, type FormEvent } from 'react';
import { Button, Card, Input } from 'thira-ui';
import { api, ApiError } from '../api';
import { useSession } from '../App';
import { Logo } from '../components/Shell';
import { Link, navigate } from '../router';

function nextPath(): string {
  const next = new URLSearchParams(location.search).get('next');
  // Only same-site paths, never //evil.example
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { setMe } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = signup ? await api.signup(email, password) : await api.login(email, password);
      setMe(me);
      navigate(signup ? '/app' : nextPath(), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server');
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <Link href="/" className="brand auth-brand">
        <Logo />
      </Link>
      <Card className="auth-card">
        <Card.Header>
          <Card.Title render={<h1 />}>{signup ? 'Create your account' : 'Log in'}</Card.Title>
          <Card.Description>
            {signup ? 'Free. No credit card.' : 'Welcome back.'}
          </Card.Description>
        </Card.Header>
        <Card.Body>
          <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              minLength={signup ? 10 : undefined}
              hint={signup ? 'At least 10 characters' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" loading={busy}>
              {signup ? 'Create account' : 'Log in'}
            </Button>
          </form>
        </Card.Body>
      </Card>
      <p className="muted">
        {signup ? (
          <>
            Already have an account? <Link href="/login">Log in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup">Create an account</Link>
          </>
        )}
      </p>
    </div>
  );
}
