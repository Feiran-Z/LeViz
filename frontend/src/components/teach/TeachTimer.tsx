import { formatCountdown } from '../../domain/teach';
import { Icon } from '../ui/Icons';

interface TeachTimerProps {
  title: string;
  segmentIndex: number;
  segmentCount: number;
  durationMs: number;
  remainingMs: number;
  running: boolean;
  completed: boolean;
  canPrevious: boolean;
  canNext: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onAddMinute: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function TeachTimer({
  title,
  segmentIndex,
  segmentCount,
  durationMs,
  remainingMs,
  running,
  completed,
  canPrevious,
  canNext,
  onStart,
  onPause,
  onReset,
  onAddMinute,
  onPrevious,
  onNext,
}: TeachTimerProps) {
  const stateLabel = completed ? "Time's up" : running ? 'Running' : 'Paused';
  const finalSeconds = remainingMs > 0 && remainingMs <= 30_000;
  const progress = durationMs > 0 ? Math.min(100, Math.max(0, ((durationMs - remainingMs) / durationMs) * 100)) : 0;
  const timerTone = completed || finalSeconds ? 'text-warning' : 'text-primary';

  return (
    <section className="card bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-label">
            Segment {segmentIndex} of {segmentCount}
          </p>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-[-0.02em]">{title}</h1>
        </div>
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`tag ${completed || finalSeconds ? 'text-warning' : ''}`}
        >
          {stateLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div
          role="timer"
          aria-label="Time remaining"
          aria-live="off"
          className={`text-5xl font-semibold tabular tracking-[-0.03em] ${timerTone}`}
        >
          {formatCountdown(remainingMs)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>
            <Icon name="refresh" size={14} />
            Reset
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAddMinute}>
            +1:00
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={running ? onPause : onStart}
            disabled={completed}
          >
            <Icon name={running ? 'pause' : 'play'} size={14} />
            {running ? 'Pause' : 'Start'}
          </button>
        </div>
      </div>

      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-default"
        role="presentation"
        title={`${formatCountdown(remainingMs)} remaining of ${formatCountdown(durationMs)}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-150 ${finalSeconds || completed ? 'bg-warning' : 'bg-accent'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onPrevious}
          disabled={!canPrevious}
        >
          <Icon name="skip-back" size={14} />
          Previous
        </button>
        <button
          type="button"
          className={`btn btn-sm ${completed ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onNext}
          disabled={!canNext}
        >
          Next
          <Icon name="skip-forward" size={14} />
        </button>
      </div>
    </section>
  );
}
