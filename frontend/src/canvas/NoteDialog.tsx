import { useEffect, useState } from 'react';
import type { LayoutSegment } from '../domain/types';
import { useLessonStore } from '../stores/lessonStore';
import { useUiStore } from '../stores/uiStore';
import { Icon } from '../components/ui/Icons';

/** Double-click note editor (implementation step 1.6). Plain text, never rich text. */
export function NoteDialog({ segment }: { segment: LayoutSegment | null }) {
  const noteNodeId = useUiStore((state) => state.noteNodeId);
  const openNoteEditor = useUiStore((state) => state.openNoteEditor);
  const setNodeNote = useLessonStore((state) => state.setNodeNote);

  const node = segment && noteNodeId ? segment.canvas.nodes.find((candidate) => candidate.id === noteNodeId) ?? null : null;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!node) return;
    setTitle(node.note?.title ?? '');
    setBody(node.note?.body ?? '');
    // Reset only when switching nodes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  useEffect(() => {
    if (!noteNodeId) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') openNoteEditor(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [noteNodeId, openNoteEditor]);

  if (!segment || !noteNodeId || !node) return null;

  const save = () => {
    const hasContent = title.trim().length > 0 || body.trim().length > 0;
    setNodeNote(segment.id, node.id, hasContent ? { title: title.trim(), body: body.trim() } : null);
    openNoteEditor(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/25" onClick={() => openNoteEditor(null)} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-dialog-title"
        className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-lg border border-default bg-elevated p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="section-label">Note on</p>
            <h2 id="note-dialog-title" className="text-lg font-semibold leading-tight">
              {node.label}
            </h2>
            <p className="mt-0.5 text-xs text-secondary">
              {node.assignedStudentIds.length} of {node.capacity || '—'} assigned
            </p>
            {node.type !== 'teacher' ? (
              <p className="mt-1 text-xs text-secondary">
                This note prints on the station card — write it for students.
              </p>
            ) : null}
          </div>
          <button type="button" className="icon-btn" onClick={() => openNoteEditor(null)} aria-label="Close note editor">
            <Icon name="x" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <label className="label" htmlFor="note-title">
            Title
          </label>
          <input
            id="note-title"
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Station A prompt"
            autoFocus
          />
          <label className="label mt-3" htmlFor="note-body">
            Body
          </label>
          <textarea
            id="note-body"
            className="textarea min-h-[140px]"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="The discussion question, role, or instruction for this spot…"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm text-danger"
            onClick={() => {
              setNodeNote(segment.id, node.id, null);
              openNoteEditor(null);
            }}
          >
            Clear note
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => openNoteEditor(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={save}>
              Save note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
