import { useEffect, useState } from 'react';
import type { Segment } from '../../domain/types';
import { useLessonStore } from '../../stores/lessonStore';
import { Icon } from '../ui/Icons';

export function SegmentHeader({ segment }: { segment: Segment }) {
  const updateSegment = useLessonStore((state) => state.updateSegment);
  const [title, setTitle] = useState(segment.title);
  const [minutes, setMinutes] = useState(String(segment.durationMin));

  useEffect(() => {
    setTitle(segment.title);
    setMinutes(String(segment.durationMin));
  }, [segment.id]);

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== segment.title) updateSegment(segment.id, { title: trimmed });
    else if (!trimmed) setTitle(segment.title);
  };

  const commitMinutes = () => {
    const parsed = Number.parseFloat(minutes);
    const next = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : segment.durationMin;
    setMinutes(String(next));
    if (next !== segment.durationMin) updateSegment(segment.id, { durationMin: next });
  };

  return (
    <div className="flex items-center gap-3 border-b border-default bg-surface px-4 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-page text-secondary">
        <Icon name={segment.kind === 'text' ? 'text' : 'layout'} size={15} />
      </span>
      <input
        className="min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-[17px] font-semibold tracking-[-0.01em] text-primary transition-colors hover:border-default focus:border-accent focus:outline-none"
        value={title}
        aria-label="Segment title"
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commitTitle}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-secondary">
        <Icon name="clock" size={14} />
        <input
          className="input h-7 w-16 px-2 text-center tabular"
          type="number"
          min={0}
          max={480}
          step={1}
          value={minutes}
          aria-label="Segment duration in minutes"
          onChange={(event) => setMinutes(event.target.value)}
          onBlur={commitMinutes}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <span>min</span>
      </label>
    </div>
  );
}
