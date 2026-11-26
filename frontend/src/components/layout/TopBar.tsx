import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_CLASS_SIZE, DEFAULT_PERIOD_MINUTES, clampClassSize } from '../../domain/lesson';
import { lessonTotalMinutes, currentLessonDocument } from '../../stores/lessonStore';
import { useLessonStore } from '../../stores/lessonStore';
import { useUiStore } from '../../stores/uiStore';
import { redoLesson, undoLesson, useLessonHistory } from '../../hooks/useUndoRedo';
import { useThemeToggle } from '../../hooks/useTheme';
import { serializeLesson } from '../../domain/serialize';
import { downloadText } from '../../lib/download';
import { slugify } from '../../lib/format';
import { Icon } from '../ui/Icons';

function SaveIndicator() {
  const saveState = useLessonStore((state) => state.saveState);
  const save = useLessonStore((state) => state.save);
  const saveError = useLessonStore((state) => state.saveError);

  if (saveState === 'saving') {
    return <span className="text-[11px] text-secondary">Saving…</span>;
  }
  if (saveState === 'error') {
    return (
      <button
        type="button"
        className="flex items-center gap-1 text-[11px] text-danger"
        onClick={() => void save()}
        title={saveError ?? 'Save failed'}
      >
        <Icon name="warning" size={12} />
        Save failed · retry
      </button>
    );
  }
  if (saveState === 'saved') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-success" title="Saved to this browser">
        <Icon name="check" size={12} />
        Saved
      </span>
    );
  }
  return null;
}

export function TopBar({ onRequestDelete }: { onRequestDelete: () => void }) {
  const lesson = useLessonStore((state) => state.lesson);
  const setTitle = useLessonStore((state) => state.setTitle);
  const setLessonDate = useLessonStore((state) => state.setLessonDate);
  const setPeriodMinutes = useLessonStore((state) => state.setPeriodMinutes);
  const setClassSize = useLessonStore((state) => state.setClassSize);
  const viewMode = useUiStore((state) => state.viewMode);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const leftCollapsed = useUiStore((state) => state.leftCollapsed);
  const rightCollapsed = useUiStore((state) => state.rightCollapsed);
  const toggleLeftPanel = useUiStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useUiStore((state) => state.toggleRightPanel);
  const notify = useUiStore((state) => state.notify);
  const { canUndo, canRedo } = useLessonHistory();
  const { preference, cycle } = useThemeToggle();

  const [title, setTitleDraft] = useState(lesson?.title ?? '');
  const [period, setPeriod] = useState(String(lesson?.durationMin ?? DEFAULT_PERIOD_MINUTES));
  const [classSize, setClassSizeDraft] = useState(String(lesson?.classSize ?? DEFAULT_CLASS_SIZE));

  useEffect(() => {
    setTitleDraft(lesson?.title ?? '');
    setPeriod(String(lesson?.durationMin ?? DEFAULT_PERIOD_MINUTES));
    setClassSizeDraft(String(lesson?.classSize ?? DEFAULT_CLASS_SIZE));
  }, [lesson?.id]);

  if (!lesson) return <header className="h-12 shrink-0 border-b border-strong bg-chrome" />;

  const planned = lessonTotalMinutes(lesson);
  const over = lesson.durationMin > 0 && planned > lesson.durationMin;
  const fill = lesson.durationMin > 0 ? Math.min(100, (planned / lesson.durationMin) * 100) : 0;

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== lesson.title) setTitle(trimmed);
    else if (!trimmed) setTitleDraft(lesson.title);
  };

  const commitPeriod = () => {
    const parsed = Number.parseInt(period, 10);
    const next = Number.isFinite(parsed) ? Math.max(0, Math.min(600, parsed)) : lesson.durationMin;
    setPeriod(String(next));
    if (next !== lesson.durationMin) setPeriodMinutes(next);
  };

  const commitClassSize = () => {
    const parsed = Number.parseInt(classSize, 10);
    const next = Number.isFinite(parsed) ? clampClassSize(parsed) : lesson.classSize;
    setClassSizeDraft(String(next));
    if (next !== lesson.classSize) setClassSize(next);
  };

  const exportLesson = () => {
    const document = currentLessonDocument();
    if (!document) return;
    downloadText(`${slugify(document.title)}.leviz.json`, serializeLesson(document));
    notify('Lesson exported as JSON.', 'success');
  };

  const themeLabel =
    preference === 'system' ? 'Theme: system' : preference === 'dark' ? 'Theme: dark' : 'Theme: light';

  return (
    <header className="shrink-0 border-b border-strong bg-chrome print:hidden">
      <div className="flex h-12 items-center gap-2 px-3">
        <Link to="/" className="icon-btn shrink-0" title="All lessons" aria-label="Back to all lessons">
          <Icon name="arrow-left" size={16} />
        </Link>

        <input
          className="min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1.5 py-1 text-[15px] font-semibold tracking-[-0.01em] text-primary transition-colors hover:border-strong focus:border-accent focus:outline-none sm:max-w-xs"
          value={title}
          aria-label="Lesson title"
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />

        <div className="hidden items-center gap-2 md:flex">
          <label className="flex items-center gap-1 text-[11px] text-secondary">
            <span className="sr-only">Lesson date</span>
            <input
              type="date"
              className="h-7 rounded-sm border border-default bg-page px-1.5 text-[11px] text-primary"
              value={lesson.lessonDate ?? ''}
              aria-label="Lesson date"
              onChange={(event) => setLessonDate(event.target.value || null)}
            />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-secondary">
            <Icon name="clock" size={13} />
            <input
              className="h-7 w-14 rounded-sm border border-default bg-page px-1.5 text-center text-[11px] tabular text-primary"
              type="number"
              min={0}
              max={600}
              value={period}
              aria-label="Class period length in minutes"
              onChange={(event) => setPeriod(event.target.value)}
              onBlur={commitPeriod}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
            <span>min period</span>
          </label>
          <label className="flex items-center gap-1 text-[11px] text-secondary" title="Planned class size — templates size the room from this">
            <Icon name="users" size={13} />
            <input
              className="h-7 w-12 rounded-sm border border-default bg-page px-1 text-center text-[11px] tabular text-primary"
              type="number"
              min={1}
              max={200}
              value={classSize}
              aria-label="Class size in students"
              onChange={(event) => setClassSizeDraft(event.target.value)}
              onBlur={commitClassSize}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
            <span>students</span>
          </label>
          <span className={`text-[11px] tabular ${over ? 'font-medium text-warning' : 'text-secondary'}`}>
            {planned} min planned{over ? ` · ${planned - lesson.durationMin} over` : ''}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <SaveIndicator />
          <span className="mx-1 h-5 w-px bg-strong" aria-hidden="true" />
          <button
            type="button"
            className="icon-btn"
            onClick={undoLesson}
            disabled={!canUndo}
            title="Undo (⌘Z)"
            aria-label="Undo"
          >
            <Icon name="undo" size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={redoLesson}
            disabled={!canRedo}
            title="Redo (⇧⌘Z)"
            aria-label="Redo"
          >
            <Icon name="redo" size={15} />
          </button>
          <span className="mx-1 h-5 w-px bg-strong" aria-hidden="true" />
          <button
            type="button"
            className={`btn btn-sm px-2 ${viewMode === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode(viewMode === 'overview' ? 'edit' : 'overview')}
            title={viewMode === 'overview' ? 'Back to the lesson editor' : 'See every segment on one page'}
            aria-label={viewMode === 'overview' ? 'Back to the lesson editor' : 'Open lesson overview'}
          >
            <Icon name={viewMode === 'overview' ? 'pencil' : 'list'} size={14} />
            <span className="hidden lg:inline">{viewMode === 'overview' ? 'Editor' : 'Overview'}</span>
          </button>
          {viewMode === 'edit' ? (
            <>
              <span className="mx-1 h-5 w-px bg-strong" aria-hidden="true" />
              <button
                type="button"
                className={`icon-btn ${leftCollapsed ? '' : 'text-primary'}`}
                onClick={toggleLeftPanel}
                title={leftCollapsed ? 'Show lesson flow' : 'Hide lesson flow'}
                aria-label={leftCollapsed ? 'Show lesson flow' : 'Hide lesson flow'}
                aria-pressed={!leftCollapsed}
              >
                <Icon name="panel-left" size={15} />
              </button>
              <button
                type="button"
                className={`icon-btn ${rightCollapsed ? '' : 'text-primary'}`}
                onClick={toggleRightPanel}
                title={rightCollapsed ? 'Show side panel' : 'Hide side panel'}
                aria-label={rightCollapsed ? 'Show side panel' : 'Hide side panel'}
                aria-pressed={!rightCollapsed}
              >
                <Icon name="panel-right" size={15} />
              </button>
            </>
          ) : null}
          <button type="button" className="icon-btn" onClick={cycle} title={themeLabel} aria-label={themeLabel}>
            <Icon name={preference === 'system' ? 'monitor' : preference === 'dark' ? 'moon' : 'sun'} size={15} />
          </button>
          <span className="mx-1 h-5 w-px bg-strong" aria-hidden="true" />
          <button type="button" className="icon-btn" onClick={exportLesson} title="Export lesson" aria-label="Export lesson">
            <Icon name="download" size={15} />
          </button>
          <button
            type="button"
            className="icon-btn hover:text-danger"
            onClick={onRequestDelete}
            title="Delete lesson"
            aria-label="Delete lesson"
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
      <div className="h-1 w-full bg-strong" role="presentation" title={`${planned} of ${lesson.durationMin} minutes planned`}>
        <div
          className={`h-full transition-[width] duration-150 ${over ? 'bg-warning' : 'bg-accent'}`}
          style={{ width: `${fill}%` }}
        />
      </div>
    </header>
  );
}
