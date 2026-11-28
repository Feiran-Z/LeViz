import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buildPrintMaterials } from '../domain/printMaterials';
import type { Lesson } from '../domain/types';
import { PrintPack } from '../components/print/PrintPack';
import { Icon } from '../components/ui/Icons';
import { useLessonDocument } from '../hooks/useLessonDocument';
import { useLessonStore } from '../stores/lessonStore';

export function PrintMaterialsPage() {
  const { lessonId, segmentId } = useParams<{ lessonId: string; segmentId: string }>();
  useLessonDocument(lessonId, { saveOnClose: false });

  const status = useLessonStore((state) => state.status);
  const lesson = useLessonStore((state) => state.lesson);
  const saveError = useLessonStore((state) => state.saveError);

  useEffect(() => {
    document.title = lesson
      ? `Print materials · ${lesson.title} · LeViz`
      : 'Print materials · LeViz';
  }, [lesson]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-page">
        <div className="h-8 w-8 animate-pulse rounded-md bg-surface" />
        <p className="text-sm text-secondary">Opening print preview…</p>
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

  return <PrintMaterialsContent lesson={lesson} segmentId={segmentId ?? ''} />;
}

function PrintMaterialsContent({ lesson, segmentId }: { lesson: Lesson; segmentId: string }) {
  const segment = lesson.segments.find((candidate) => candidate.id === segmentId);
  const layout = segment?.kind === 'layout' ? segment : null;
  const materials = useMemo(
    () => (layout ? buildPrintMaterials(layout, lesson.roster) : null),
    [layout, lesson.roster],
  );

  if (!layout || !materials) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-page px-6 text-center">
        <p className="section-label">Print materials</p>
        <h1 className="text-xl font-semibold">This layout segment is not available</h1>
        <p className="max-w-sm text-sm text-secondary">
          It may have been removed, or the link points at a text segment.
        </p>
        <Link to={`/lessons/${lesson.id}`} className="btn btn-secondary mt-2">
          Back to editor
        </Link>
      </div>
    );
  }

  return (
    <div className="print-materials min-h-full bg-page print:bg-white">
      <header className="print-toolbar sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-default bg-surface px-5 py-2.5 print:hidden">
        <Link to={`/lessons/${lesson.id}`} className="btn btn-secondary btn-sm">
          <Icon name="arrow-left" size={14} />
          Back to editor
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-secondary">Print materials</p>
          <h1 className="truncate text-[15px] font-semibold">{lesson.title}</h1>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
          <Icon name="printer" size={14} />
          Print
        </button>
      </header>

      <main className="mx-auto w-full max-w-[9in] px-4 py-6 print:max-w-none print:p-0">
        <PrintPack lesson={lesson} segment={layout} materials={materials} />
      </main>
    </div>
  );
}
