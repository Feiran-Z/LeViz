import { useState } from 'react';
import { BUILD_ID, PILOT_FEEDBACK_URL } from '../../lib/pilot';
import { Icon } from '../ui/Icons';

const DISMISS_KEY = 'leviz-pilot-notice-dismissed';

function initiallyDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Pilot expectations on the lesson list only: where lessons live, how to back
 * them up, which build is deployed, and (once configured) how to send feedback.
 * Dismissal is remembered in this browser.
 */
export function PilotNotice() {
  const [dismissed, setDismissed] = useState(initiallyDismissed);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Blocked storage: the banner simply returns next visit.
    }
    setDismissed(true);
  };

  return (
    <div className="border-b border-default bg-surface print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 text-[11px] text-secondary">
        <span className="tag">Preview build</span>
        <span>Lessons are saved only in this browser. Export to back up.</span>
        {PILOT_FEEDBACK_URL ? (
          <a
            className="font-medium text-primary underline underline-offset-2 hover:text-accent"
            href={PILOT_FEEDBACK_URL}
            target="_blank"
            rel="noreferrer"
          >
            Share feedback
          </a>
        ) : null}
        {BUILD_ID !== 'dev' ? <span className="tabular">build {BUILD_ID.slice(0, 7)}</span> : null}
        <button
          type="button"
          className="icon-btn ml-auto"
          aria-label="Dismiss preview notice"
          title="Dismiss"
          onClick={dismiss}
        >
          <Icon name="x" size={12} />
        </button>
      </div>
    </div>
  );
}
