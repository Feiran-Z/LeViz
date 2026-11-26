import { useUiStore } from '../../stores/uiStore';
import { Icon } from './Icons';

const TONE_CLASSES: Record<string, string> = {
  info: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
};

export function Toasts() {
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-50 print:hidden flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="card pointer-events-auto flex items-start gap-2 px-3 py-2.5 shadow-sm"
        >
          <span className={`mt-0.5 ${TONE_CLASSES[toast.tone] ?? 'text-primary'}`}>
            <Icon name={toast.tone === 'success' ? 'check' : toast.tone === 'warning' || toast.tone === 'error' ? 'warning' : 'circle-dot'} />
          </span>
          <p className="flex-1 text-sm leading-snug">{toast.message}</p>
          <button
            type="button"
            className="icon-btn -mr-1 -mt-1 shrink-0"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
