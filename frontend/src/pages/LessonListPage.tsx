import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PilotNotice } from '../components/pilot/PilotNotice';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Icon } from '../components/ui/Icons';
import { serializeLesson } from '../domain/serialize';
import type { LessonSummary } from '../domain/types';
import { useThemeToggle } from '../hooks/useTheme';
import { downloadText, readFileAsText } from '../lib/download';
import { formatMinutes, formatShortDate, formatTimestamp, slugify } from '../lib/format';
import { useLibraryStore } from '../stores/libraryStore';
import { useUiStore } from '../stores/uiStore';

function ThemeButton() {
  const { preference, cycle } = useThemeToggle();
  const label = preference === 'system' ? 'Theme: system' : preference === 'dark' ? 'Theme: dark' : 'Theme: light';
  return (
    <button type="button" className="icon-btn" onClick={cycle} title={label} aria-label={label}>
      <Icon name={preference === 'system' ? 'monitor' : preference === 'dark' ? 'moon' : 'sun'} size={17} />
    </button>
  );
}

export function LessonListPage() {
  const navigate = useNavigate();
  const notify = useUiStore((state) => state.notify);
  const summaries = useLibraryStore((state) => state.summaries);
  const error = useLibraryStore((state) => state.error);
  const refresh = useLibraryStore((state) => state.refresh);
  const createLesson = useLibraryStore((state) => state.create);
  const removeLesson = useLibraryStore((state) => state.remove);
  const getDocument = useLibraryStore((state) => state.getDocument);
  const importFromJson = useLibraryStore((state) => state.importFromJson);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<LessonSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'LeViz';
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!summaries) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return summaries;
    return summaries.filter((summary) => summary.title.toLowerCase().includes(needle));
  }, [query, summaries]);

  const handleNew = async () => {
    setBusy(true);
    try {
      const lesson = await createLesson();
      navigate(`/lessons/${lesson.id}`);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Could not create lesson.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File) => {
    try {
      const lesson = await importFromJson(await readFileAsText(file));
      notify(`Imported “${lesson.title}”.`, 'success');
      await refresh();
      navigate(`/lessons/${lesson.id}`);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Could not import that file.', 'error');
    }
  };

  const handleExport = async (summary: LessonSummary) => {
    try {
      const lesson = await getDocument(summary.id);
      if (!lesson) throw new Error('Lesson not found.');
      downloadText(`${slugify(summary.title)}.leviz.json`, serializeLesson(lesson));
      notify('Lesson exported.', 'success');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Export failed.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await removeLesson(pendingDelete.id);
      notify(`Deleted “${pendingDelete.title}”.`, 'info');
      setPendingDelete(null);
      await refresh();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Delete failed.', 'error');
    }
  };

  return (
    <div className="min-h-full bg-page">
      <header className="sticky top-0 z-10 border-b border-default bg-page/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-5">
          <Link to="/" className="flex items-center gap-2.5" aria-label="LeViz home">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-inverse"
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M2.5 4.5h7M2.5 8h11M2.5 11.5h5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.02em]">LeViz</span>
          </Link>
          <span className="hidden text-sm text-secondary sm:inline">Visual lesson planning</span>
          <div className="flex-1" />
          <ThemeButton />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="upload" size={15} />
            <span className="hidden sm:inline">Import</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Import a lesson file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void handleImport(file);
            }}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleNew()} disabled={busy}>
            <Icon name="plus" size={15} />
            New lesson
          </button>
        </div>
      </header>

      <PilotNotice />

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em]">Your lessons</h1>
            <p className="mt-1 text-sm text-secondary">
              Plans, spatial layouts, rosters, and notes live together in one document.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <input
              className="input pl-8"
              type="search"
              placeholder="Search lessons"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search lessons"
            />
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            </span>
          </div>
        </div>

        {error ? (
          <div className="card mb-6 border-danger/30 p-4 text-sm text-danger" role="alert">
            {error}
          </div>
        ) : null}

        {summaries === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="card h-40 animate-pulse opacity-60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-strong px-6 py-20 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-secondary">
              <Icon name="layout" size={22} />
            </div>
            <h2 className="text-lg font-semibold">
              {summaries.length === 0 ? 'Plan your first lesson' : 'No lessons match that search'}
            </h2>
            <p className="mt-1.5 max-w-sm text-sm text-secondary">
              {summaries.length === 0
                ? 'Start with a Do Now, lay out the room for an activity, and finish with an exit ticket.'
                : 'Try a different title, or clear the search field.'}
            </p>
            {summaries.length === 0 ? (
              <button type="button" className="btn btn-primary mt-5" onClick={() => void handleNew()} disabled={busy}>
                <Icon name="plus" size={15} />
                New lesson
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((summary) => {
              const over = summary.totalMinutes > summary.durationMin;
              return (
                <li key={summary.id}>
                  <article className="card group flex h-44 flex-col p-4 transition-colors hover:border-strong">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/lessons/${summary.id}`}
                        className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] hover:text-accent"
                      >
                        {summary.title || 'Untitled lesson'}
                      </Link>
                      <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Export lesson"
                          aria-label={`Export ${summary.title}`}
                          onClick={() => void handleExport(summary)}
                        >
                          <Icon name="download" size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn hover:text-danger"
                          title="Delete lesson"
                          aria-label={`Delete ${summary.title}`}
                          onClick={() => setPendingDelete(summary)}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>

                    <Link to={`/lessons/${summary.id}`} className="flex flex-1 flex-col justify-end" tabIndex={-1}>
                      <p className="mt-1 text-xs text-secondary">{formatShortDate(summary.lessonDate)}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-secondary">
                        <span className="inline-flex items-center gap-1">
                          <Icon name="text" size={13} />
                          {summary.segmentCount} {summary.segmentCount === 1 ? 'segment' : 'segments'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Icon name="users" size={13} />
                          {summary.studentCount} {summary.studentCount === 1 ? 'student' : 'students'}
                        </span>
                        <span className={`inline-flex items-center gap-1 tabular ${over ? 'text-warning' : ''}`}>
                          <Icon name="clock" size={13} />
                          {formatMinutes(summary.totalMinutes)} / {formatMinutes(summary.durationMin)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-default pt-2.5 text-[11px] text-secondary">
                        <span>Edited {formatTimestamp(summary.updatedAt)}</span>
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <Icon name="cloud" size={12} />
                          This browser
                        </span>
                      </div>
                    </Link>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this lesson?"
        message={
          pendingDelete
            ? `“${pendingDelete.title}” will be removed from this browser. Export it first if you want a backup.`
            : ''
        }
        confirmLabel="Delete lesson"
        danger
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
