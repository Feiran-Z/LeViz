import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Icon } from '../components/ui/Icons';
import { TopBar } from '../components/layout/TopBar';
import { RightPanel } from '../components/panels/RightPanel';
import { SegmentOutline } from '../components/panels/SegmentOutline';
import { LessonOverview } from '../components/overview/LessonOverview';
import { NodeNoteTooltip } from '../canvas/NodeNoteTooltip';
import { LayoutSegmentEditor } from '../components/segments/LayoutSegmentEditor';
import { TextSegmentEditor } from '../components/segments/TextSegmentEditor';
import { LAYOUT_TEMPLATES } from '../domain/templates';
import { TEXT_TEMPLATES } from '../domain/textTemplates';
import type { Lesson } from '../domain/types';
import { lessonTotalMinutes, useLessonStore } from '../stores/lessonStore';
import { openLesson } from '../stores/lessonSession';
import { useLessonDocument } from '../hooks/useLessonDocument';
import { useLibraryStore } from '../stores/libraryStore';
import { useRosterStore } from '../stores/rosterStore';
import { useUiStore } from '../stores/uiStore';
import { useUndoRedoHotkeys } from '../hooks/useUndoRedo';
import { formatMinutes } from '../lib/format';

function LessonStart({ lesson }: { lesson: Lesson }) {
  const addTextSegment = useLessonStore((state) => state.addTextSegment);
  const addLayoutSegment = useLessonStore((state) => state.addLayoutSegment);
  const setActiveSegment = useUiStore((state) => state.setActiveSegment);
  const students = useRosterStore((state) => state.students);
  const planned = lessonTotalMinutes(lesson);

  return (
    <div className="h-full overflow-y-auto px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <p className="section-label">Lesson overview</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em]">{lesson.title}</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-secondary">
          A lesson is a sequence of segments. Text segments carry openings, debriefs, and exit tickets. Layout
          segments place furniture and stations on a canvas, with notes and students attached to each one.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Period', value: formatMinutes(lesson.durationMin) },
            { label: 'Planned', value: formatMinutes(planned) },
            { label: 'Class size', value: String(lesson.classSize) },
            { label: 'On roster', value: String(students.length) },
            { label: 'Segments', value: String(lesson.segments.length) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-md border border-default bg-surface px-3 py-2">
              <dt className="text-[11px] text-secondary">{stat.label}</dt>
              <dd className="text-[15px] font-semibold tabular">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const id = addTextSegment();
              if (id) setActiveSegment(id);
            }}
          >
            <Icon name="text" size={15} />
            Blank text segment
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const id = addLayoutSegment('custom');
              if (id) setActiveSegment(id);
            }}
          >
            <Icon name="layout" size={15} />
            Blank layout
          </button>
        </div>

        <h2 className="mt-8 text-[13px] font-semibold">Start with a routine</h2>
        <p className="text-xs text-secondary">
          Text-only structures that slot into the lesson flow. Every prompt and step stays editable.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TEXT_TEMPLATES.filter((template) => template.id !== 'blank').map((template) => (
            <button
              key={template.id}
              type="button"
              className="card flex flex-col items-start gap-0.5 p-3 text-left transition-colors hover:border-strong"
              onClick={() => {
                const id = addTextSegment(template.id);
                if (id) setActiveSegment(id);
              }}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{template.name}</span>
                <span className="shrink-0 text-[10px] tabular text-secondary">{template.durationMin} min</span>
              </span>
              <span className="text-[11px] leading-snug text-secondary">{template.description}</span>
            </button>
          ))}
        </div>

        <h2 className="mt-8 text-[13px] font-semibold">Start from an activity</h2>
        <p className="text-xs text-secondary">
          Templates build the room for your {lesson.classSize} students — no roster needed. Every node stays editable,
          and you can change the class size in the top bar.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {LAYOUT_TEMPLATES.filter((template) => template.id !== 'custom').map((template) => (
            <button
              key={template.id}
              type="button"
              className="card flex flex-col items-start gap-0.5 p-3 text-left transition-colors hover:border-strong"
              onClick={() => {
                const id = addLayoutSegment(template.id);
                if (id) setActiveSegment(id);
              }}
            >
              <span className="text-[13px] font-medium">{template.name}</span>
              <span className="text-[11px] leading-snug text-secondary">{template.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function EditorPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();

  const status = useLessonStore((state) => state.status);
  const lesson = useLessonStore((state) => state.lesson);
  const saveError = useLessonStore((state) => state.saveError);
  const removeNode = useLessonStore((state) => state.removeNode);
  const removeLesson = useLibraryStore((state) => state.remove);
  const notify = useUiStore((state) => state.notify);

  const activeSegmentId = useUiStore((state) => state.activeSegmentId);
  const viewMode = useUiStore((state) => state.viewMode);
  const leftCollapsed = useUiStore((state) => state.leftCollapsed);
  const rightCollapsed = useUiStore((state) => state.rightCollapsed);
  const toggleLeftPanel = useUiStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useUiStore((state) => state.toggleRightPanel);

  const [deleteOpen, setDeleteOpen] = useState(false);

  useUndoRedoHotkeys();
  useLessonDocument(lessonId, { saveOnClose: true });

  useEffect(() => {
    document.title = lesson ? `${lesson.title} · LeViz` : 'LeViz';
  }, [lesson?.title]);

  const segments = lesson?.segments ?? [];
  const activeSegment = segments.find((segment) => segment.id === activeSegmentId) ?? null;

  useEffect(() => {
    if (status !== 'ready') return;
    if (activeSegmentId && segments.some((segment) => segment.id === activeSegmentId)) return;
    useUiStore.getState().setActiveSegment(segments[0]?.id ?? null);
  }, [status, segments, activeSegmentId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        useUiStore.getState().openNoteEditor(null);
        useUiStore.getState().selectNode(null);
        return;
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const ui = useUiStore.getState();
      if (!ui.selectedNodeId || !ui.activeSegmentId) return;
      event.preventDefault();
      removeNode(ui.activeSegmentId, ui.selectedNodeId);
      useUiStore.getState().selectNode(null);
      notify('Node removed. Undo with ⌘Z.', 'info');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [removeNode, notify]);

  const handleDeleteLesson = async () => {
    if (!lessonId) return;
    try {
      await removeLesson(lessonId);
      setDeleteOpen(false);
      notify('Lesson deleted.', 'info');
      navigate('/');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Could not delete lesson.', 'error');
    }
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-page">
        <div className="h-8 w-8 animate-pulse rounded-md bg-surface" />
        <p className="text-sm text-secondary">Opening lesson…</p>
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-page px-6 text-center">
        <p className="section-label">Not found</p>
        <h1 className="text-xl font-semibold">This lesson is not in this browser</h1>
        <p className="max-w-sm text-sm text-secondary">
          It may have been deleted, or it lives in a different browser profile. Import a JSON export to restore it.
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
        <div className="flex gap-2">
          <Link to="/" className="btn btn-secondary">
            Back to lessons
          </Link>
          {lessonId ? (
            <button type="button" className="btn btn-primary" onClick={() => void openLesson(lessonId)}>
              Try again
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-page print:h-auto print:overflow-visible">
      <TopBar onRequestDelete={() => setDeleteOpen(true)} />

      {viewMode === 'overview' ? (
        <LessonOverview />
      ) : (
      <div className="flex min-h-0 flex-1">
        {leftCollapsed ? (
          <aside className="flex w-12 shrink-0 flex-col items-center border-r border-default bg-surface pt-3">
            <button
              type="button"
              className="icon-btn"
              onClick={toggleLeftPanel}
              title="Show lesson flow"
              aria-label="Show lesson flow"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </aside>
        ) : (
          <aside className="w-[260px] shrink-0 border-r border-default">
            <SegmentOutline />
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-hidden bg-page">
          {activeSegment && activeSegment.kind === 'text' ? (
            <TextSegmentEditor key={activeSegment.id} segment={activeSegment} />
          ) : activeSegment && activeSegment.kind === 'layout' ? (
            <LayoutSegmentEditor key={activeSegment.id} segment={activeSegment} />
          ) : segments.length === 0 ? (
            <LessonStart lesson={lesson} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-secondary">Choose a segment from the lesson flow to start editing.</p>
            </div>
          )}
        </main>

        {rightCollapsed ? (
          <aside className="flex w-12 shrink-0 flex-col items-center border-l border-default bg-surface pt-3">
            <button
              type="button"
              className="icon-btn"
              onClick={toggleRightPanel}
              title="Show side panel"
              aria-label="Show side panel"
            >
              <Icon name="chevron-left" size={16} />
            </button>
          </aside>
        ) : (
          <aside className="w-[300px] shrink-0 border-l border-default">
            <RightPanel />
          </aside>
        )}
      </div>
      )}

      <NodeNoteTooltip />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this lesson?"
        message={`“${lesson.title}” will be removed from this browser. Export it first if you want a backup.`}
        confirmLabel="Delete lesson"
        danger
        onConfirm={() => void handleDeleteLesson()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
