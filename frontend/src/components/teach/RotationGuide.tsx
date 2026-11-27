import { formatCountdown, rotationEligibleStops, type RotationConfig } from '../../domain/teach';
import type { LayoutSegment } from '../../domain/types';

export function RotationGuide({
  segment,
  rotation,
  enabled,
  remainingMs,
  stopIndex,
  onToggle,
  onNext,
}: {
  segment: LayoutSegment;
  rotation: RotationConfig | null;
  enabled: boolean;
  remainingMs: number;
  stopIndex: number;
  onToggle: (enabled: boolean) => void;
  onNext: () => void;
}) {
  const eligible = rotationEligibleStops(segment).length >= 2;
  if (!eligible) return null;

  const stop = rotation?.stops[stopIndex];
  const count = rotation?.stops.length ?? 0;
  const isLast = count > 0 && stopIndex >= count - 1;
  const noun = rotation?.kind === 'station' ? 'station' : 'stop';
  const Noun = noun === 'station' ? 'Station' : 'Stop';

  return (
    <section className="card bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className={`btn btn-sm ${enabled ? 'btn-primary' : 'btn-secondary'}`}
          aria-pressed={enabled}
          onClick={() => onToggle(!enabled)}
        >
          Rotation guide
        </button>
        {enabled && rotation && stop ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-xs font-medium">
              {Noun} {stopIndex + 1} of {count} · {stop.label}
            </span>
            <span className={`text-xs tabular ${remainingMs <= 0 ? 'font-medium text-warning' : 'text-secondary'}`}>
              {remainingMs > 0 ? 'Rotate in ' : 'Rotate now '}
              {formatCountdown(remainingMs)}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onNext}
              disabled={isLast}
            >
              {isLast ? `Last ${noun}` : `Next ${noun}`}
            </button>
          </div>
        ) : enabled ? (
          <span className="text-xs text-secondary">Add at least two stops to use the guide.</span>
        ) : (
          <span className="text-xs text-secondary">Automatic for station rotation and gallery walk.</span>
        )}
      </div>
    </section>
  );
}
