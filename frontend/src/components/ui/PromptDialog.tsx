import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from './Icons';

/**
 * A small text-prompt modal. `onConfirm` returns an inline error string (or
 * throws) to keep the dialog open; a null/undefined result closes it.
 */
export function PromptDialog({
  open,
  title,
  label,
  initialValue = '',
  confirmLabel = 'Save',
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => string | null | Promise<string | null>;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setError(null);
    setBusy(false);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const message = await onConfirm(value);
      if (message) setError(message);
      else onCancel();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/25" onClick={onCancel} aria-hidden="true" />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-dialog-title"
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-lg border border-default bg-elevated p-5 shadow-xl"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 id="prompt-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close dialog">
            <Icon name="x" />
          </button>
        </div>
        <label className="label" htmlFor="prompt-dialog-input">
          {label}
        </label>
        <input
          id="prompt-dialog-input"
          className="input"
          value={value}
          aria-label={label}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
        />
        {error ? (
          <p className="mt-1.5 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
