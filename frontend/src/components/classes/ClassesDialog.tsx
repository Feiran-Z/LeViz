import { useEffect, useState } from 'react';
import type { ClassRoster } from '../../domain/types';
import { formatTimestamp } from '../../lib/format';
import { useClassRosterStore } from '../../stores/classRosterStore';
import { useUiStore } from '../../stores/uiStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Icon } from '../ui/Icons';
import { PromptDialog } from '../ui/PromptDialog';

/** Rename and delete reusable classes. Creating a class happens from a lesson roster. */
export function ClassesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const classes = useClassRosterStore((state) => state.classes);
  const status = useClassRosterStore((state) => state.status);
  const error = useClassRosterStore((state) => state.error);
  const refresh = useClassRosterStore((state) => state.refresh);
  const rename = useClassRosterStore((state) => state.rename);
  const remove = useClassRosterStore((state) => state.remove);
  const notify = useUiStore((state) => state.notify);

  const [renaming, setRenaming] = useState<ClassRoster | null>(null);
  const [deleting, setDeleting] = useState<ClassRoster | null>(null);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !renaming && !deleting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, renaming, deleting, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
        <div className="absolute inset-0 bg-black/25" onClick={onClose} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="classes-dialog-title"
          className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-default bg-elevated p-5 shadow-xl"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="classes-dialog-title" className="text-lg font-semibold">
                Classes
              </h2>
              <p className="text-xs text-secondary">
                Reusable rosters. Lessons keep a snapshot; refresh them from the Roster tab.
              </p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Close classes"
            >
              <Icon name="x" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {status === 'loading' && classes === null ? (
              <p className="py-4 text-sm text-secondary">Loading classes…</p>
            ) : classes && classes.length === 0 ? (
              <p className="py-4 text-sm text-secondary">
                No classes yet. Save a lesson roster as a class from the Roster tab.
              </p>
            ) : (
              <ul>
                {classes?.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 border-b border-default py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-[11px] text-secondary">
                        {item.students.length} {item.students.length === 1 ? 'student' : 'students'} ·
                        updated {formatTimestamp(item.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        className="icon-btn h-6 w-6"
                        aria-label={`Rename ${item.name}`}
                        title="Rename class"
                        onClick={() => setRenaming(item)}
                      >
                        <Icon name="pencil" size={12} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn h-6 w-6 hover:text-danger"
                        aria-label={`Delete ${item.name}`}
                        title="Delete class"
                        onClick={() => setDeleting(item)}
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
          </div>

          <div className="mt-4 flex justify-end">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      <PromptDialog
        open={renaming !== null}
        title="Rename class"
        label="Class name"
        initialValue={renaming?.name ?? ''}
        confirmLabel="Rename"
        onCancel={() => setRenaming(null)}
        onConfirm={async (name) => {
          if (!renaming) return null;
          try {
            await rename(renaming.id, name);
            notify('Class renamed.', 'success');
            return null;
          } catch (cause) {
            return cause instanceof Error ? cause.message : 'Could not rename the class.';
          }
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'class'}?`}
        message="Lessons using this class keep their roster snapshots and will show the class as unavailable."
        confirmLabel="Delete class"
        danger
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (!target) return;
          void remove(target.id)
            .then(() => notify('Class deleted.', 'info'))
            .catch((cause) =>
              notify(cause instanceof Error ? cause.message : 'Could not delete the class.', 'error'),
            );
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
