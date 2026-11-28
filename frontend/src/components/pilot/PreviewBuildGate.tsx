import { useEffect, useRef, useState } from 'react';
import { PILOT_FEEDBACK_URL, PREVIEW_GATE_ENABLED } from '../../lib/pilot';

const ACK_KEY = 'leviz-preview-gate-acknowledged';

function initiallyAcknowledged(): boolean {
  try {
    return window.sessionStorage.getItem(ACK_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Landing-page preview acknowledgment. It is deliberately not dismissible by
 * Escape or a backdrop click: only the "I understand." button closes it.
 * Acknowledgment lasts for the browser tab session so internal navigation does
 * not re-block the teacher. `enabled` lets a build mount it or leave it out;
 * the default comes from `VITE_PREVIEW_GATE`.
 */
export function PreviewBuildGate({
  enabled = PREVIEW_GATE_ENABLED,
}: {
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(() => !initiallyAcknowledged());
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!enabled || !open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    buttonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, open]);

  if (!enabled || !open) return null;

  const acknowledge = () => {
    try {
      window.sessionStorage.setItem(ACK_KEY, '1');
    } catch {
      // Blocked storage: the gate closes for this mount and returns next session.
    }
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 print:hidden"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/35"
        data-testid="preview-gate-backdrop"
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-gate-title"
        aria-describedby="preview-gate-description"
        className="relative w-full max-w-lg rounded-lg border border-strong bg-elevated p-6 shadow-xl"
      >
        <p className="section-label">Preview build</p>
        <h2 id="preview-gate-title" className="mt-1 text-xl font-semibold tracking-[-0.02em]">
          LeViz is in preview build.
        </h2>
        <p id="preview-gate-description" className="mt-3 text-sm leading-relaxed text-secondary">
          By using it, you solemnly swear that you will provide feedback and suggestions via the
          Microsoft Form:
        </p>
        <a
          href={PILOT_FEEDBACK_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block break-all text-sm font-medium text-primary underline underline-offset-2 hover:text-accent"
        >
          {PILOT_FEEDBACK_URL}
        </a>
        <div className="mt-6 flex justify-end">
          <button
            ref={buttonRef}
            type="button"
            className="btn btn-primary"
            onClick={acknowledge}
          >
            I understand.
          </button>
        </div>
      </div>
    </div>
  );
}
