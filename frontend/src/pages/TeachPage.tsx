import { useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { buildTeachRun } from '../domain/teach';
import type { Lesson, Student } from '../domain/types';
import { useLessonDocument } from '../hooks/useLessonDocument';
import { useTeachRun } from '../hooks/useTeachRun';
import { useLessonStore } from '../stores/lessonStore';
import { useRosterStore } from '../stores/rosterStore';
import { RotationGuide } from '../components/teach/RotationGuide';
import { TeachContent } from '../components/teach/TeachContent';
import { TeachTimer } from '../components/teach/TeachTimer';
import { Icon } from '../components/ui/Icons';

export function TeachPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  useLessonDocument(lessonId, { saveOnClose: false });

  const status = useLessonStore((state) => state.status);
  const lesson = useLessonStore((state) => state.lesson);
  const saveError = useLessonStore((state) => state.saveError);
  const students = useRosterStore((state) => state.students);

  const exit = useCallback(() => {
    if (lessonId) navigate(`/lessons/${lessonId}`);
  }, [lessonId, navigate]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-page">
        <div className="h-8 w-8 animate-pulse rounded-md bg-surface" />
        <p className="text-sm text-secondary">Opening teach mode…</p>
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-page px-6 text-center">
        <p className="section-label">Not found</p>
        <h1 className="text-xl font-semibold">This lesson is not in this browser</h1>
        <p className="max-w-sm text-sm text-secondary">
          It may have been deleted, or it lives in a different browser profile.
        </p>
        <Link to="/" className="btn btn-secondary mt-2">
          Back to lessons
        </Link>
      </div>
    );
  }

  if (status === 'error' || !lesson) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-page px-6 text-center">
        <p className="flex items-center gap-2 text-sm text-danger">
          <Icon name="warning" size={16} />
          {saveError ?? 'The lesson could not be loaded.'}
        </p>
        <Link to="/" className="btn btn-secondary">
          Back to lessons
        </Link>
      </div>
    );
  }

  return (
    <TeachRunner
      lesson={lesson}
      lessonId={lessonId ?? lesson.id}
      students={students}
      onExit={exit}
    />
  );
}

function TeachRunner({
  lesson,
  lessonId,
  students,
  onExit,
}: {
  lesson: Lesson;
  lessonId: string;
  students: Student[];
  onExit: () => void;
}) {
  const run = useMemo(() => buildTeachRun(lesson.segments), [lesson.segments]);
  const teach = useTeachRun({ lessonId, run });
  const { state, segment, actions } = teach;

  useEffect(() => {
    document.title = `Teach · ${lesson.title} · LeViz`;
  }, [lesson.title]);

  const exit = useCallback(() => {
    actions.clearSession();
    onExit();
  }, [actions, onExit]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      if (event.key === ' ') {
        // Let a focused button/link handle its own Space activation.
        if (target instanceof HTMLElement && target.closest('button, a, [role="button"]')) return;
        event.preventDefault();
        actions.toggle();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        actions.previous();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        actions.next();
      } else if (event.key.toLowerCase() === 'r') {
        actions.reset();
      } else if (event.key === 'Escape') {
        exit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions, exit]);

  if (!segment) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-page px-6 text-center">
        <p className="section-label">Teach mode</p>
        <h1 className="text-xl font-semibold">{lesson.title}</h1>
        <p className="max-w-sm text-sm text-secondary">
          This lesson has no timed segments. Add time to a segment before teaching.
        </p>
        <button type="button" className="btn btn-secondary mt-2" onClick={exit}>
          Back to editor
        </button>
      </div>
    );
  }

  const next = run.segments[state.segmentIndex + 1] ?? null;
  const layout = segment.segment.kind === 'layout' ? segment.segment : null;
  const activeStopNodeId = teach.rotation?.stops[state.stopIndex]?.id ?? null;
  const plannedEnd = new Date(teach.plannedEndAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-page">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-default bg-surface px-5 py-2.5">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={exit}
          aria-label="Exit teach mode"
        >
          <Icon name="arrow-left" size={14} />
          Exit
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-secondary">Teach mode</p>
          <h2 className="truncate text-[15px] font-semibold">{lesson.title}</h2>
        </div>
        <span className="text-[11px] text-secondary">{students.length} on roster</span>
        <span className="text-[11px] tabular text-secondary">Planned end ~{plannedEnd}</span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => actions.setSound(!state.soundOn)}
          aria-pressed={state.soundOn}
          aria-label={state.soundOn ? 'Mute chime' : 'Enable chime'}
          title={state.soundOn ? 'Chime on' : 'Chime off'}
        >
          <Icon name={state.soundOn ? 'volume' : 'volume-off'} size={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-5">
          <TeachTimer
            title={segment.segment.title}
            segmentIndex={state.segmentIndex + 1}
            segmentCount={run.segments.length}
            durationMs={teach.liveDurationMs}
            remainingMs={state.remainingMs}
            running={state.running}
            completed={state.completed}
            canPrevious={state.segmentIndex > 0}
            canNext={state.segmentIndex < run.segments.length - 1}
            onStart={actions.start}
            onPause={actions.pause}
            onReset={actions.reset}
            onAddMinute={actions.addMinute}
            onPrevious={actions.previous}
            onNext={actions.next}
          />
          {layout ? (
            <RotationGuide
              segment={layout}
              rotation={teach.rotation}
              enabled={state.rotationEnabled}
              remainingMs={teach.rotationRemainingMs}
              stopIndex={state.stopIndex}
              onToggle={actions.setRotation}
              onNext={actions.nextStop}
            />
          ) : null}
          <TeachContent
            segment={segment.segment}
            students={students}
            activeStopNodeId={activeStopNodeId}
          />
          <p className="text-xs text-secondary">
            {next ? `Next: ${next.segment.title} · ${next.durationMin} min` : 'Last segment'}
          </p>
        </div>
      </div>
    </div>
  );
}
