import { useState, type FormEvent } from 'react';
import { Button, Dialog, Input, Select, Switch } from 'thira-ui';
import { INTERVALS, type MonitorInput } from '../../shared/types';
import { ApiError } from '../api';
import { intervalLabel } from '../format';

const INTERVAL_ITEMS = INTERVALS.map((s) => ({ value: s, label: intervalLabel(s) }));

/** Create or edit a monitor. The parent owns `open` and does the API call in `onSave`. */
export function MonitorForm({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: MonitorInput;
  onSave: (input: MonitorInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? 'https://');
  const [intervalS, setIntervalS] = useState<number>(initial?.intervalS ?? 300);
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({ name, url, intervalS, isPublic });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content title={initial ? 'Edit monitor' : 'New monitor'} description="We'll send a GET request and expect a status below 400.">
        <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
          <Input label="Name" placeholder="Website" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            label="URL"
            type="url"
            inputMode="url"
            required
            placeholder="https://example.com/health"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Select
            label="Check"
            items={INTERVAL_ITEMS}
            value={intervalS}
            onValueChange={(v) => {
              if (v !== null) setIntervalS(v);
            }}
          />
          <Switch
            label="Show on public status page"
            description="Only the name and uptime are shown, never the URL."
            checked={isPublic}
            onCheckedChange={setIsPublic}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Dialog.Footer>
            <Dialog.Close render={<Button variant="ghost" type="button" />}>Cancel</Dialog.Close>
            <Button type="submit" loading={busy}>
              {initial ? 'Save' : 'Add monitor'}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog>
  );
}
