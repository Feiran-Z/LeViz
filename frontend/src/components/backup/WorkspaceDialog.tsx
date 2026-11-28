import { useEffect, useRef, useState } from 'react';
import {
  parseWorkspace,
  serializeWorkspace,
  type WorkspaceBackup,
  type WorkspaceRestoreMode,
} from '../../domain/workspace';
import { downloadText, readFileAsText } from '../../lib/download';
import { formatTimestamp } from '../../lib/format';
import {
  requestPersistentStorage,
  type StoragePersistenceState,
} from '../../lib/storage';
import { useClassRosterStore } from '../../stores/classRosterStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { useUiStore } from '../../stores/uiStore';
import type { WorkspaceConflicts } from '../../stores/workspaceStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { Icon } from '../ui/Icons';

const LAST_BACKUP_KEY = 'leviz-last-workspace-backup';

function readLastBackup(): string | null {
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

function writeLastBackup(value: string): void {
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, value);
  } catch {
    // Blocked storage: the timestamp just won't survive a reload.
  }
}

function storageLabel(state: StoragePersistenceState | null): string {
  if (state === 'persisted') return 'Protected: the browser will not clear this data automatically.';
  if (state === 'best-effort') return 'Best-effort: the browser may clear this data under pressure.';
  if (state === 'unsupported') return 'This browser cannot protect local storage.';
  return 'Checking storage protection…';
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function WorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createBackup = useWorkspaceStore((state) => state.createBackup);
  const inspect = useWorkspaceStore((state) => state.inspect);
  const restore = useWorkspaceStore((state) => state.restore);
  const notify = useUiStore((state) => state.notify);
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [storageState, setStorageState] = useState<StoragePersistenceState | null>(null);
  const [pending, setPending] = useState<{
    backup: WorkspaceBackup;
    conflicts: WorkspaceConflicts;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError(null);
    setPending(null);
    setLastBackupAt(readLastBackup());
    void requestPersistentStorage().then(setStorageState);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const restoreAndRefresh = async (backup: WorkspaceBackup, mode: WorkspaceRestoreMode) => {
    const plan = await restore(backup, mode);
    await Promise.all([
      useLibraryStore.getState().refresh(),
      useClassRosterStore.getState().refresh(),
    ]);
    const replaced = plan.counts.lessonsReplaced + plan.counts.classesReplaced;
    const skipped = plan.counts.lessonsSkipped + plan.counts.classesSkipped;
    const copied = plan.counts.lessonsCopied + plan.counts.classesCopied;
    let message = `Restored ${plural(plan.lessons.length, 'lesson', 'lessons')} and ${plural(
      plan.classes.length,
      'class',
      'classes',
    )}.`;
    if (replaced > 0) message += ` Replaced ${plural(replaced, 'existing item', 'existing items')}.`;
    if (skipped > 0) message += ` Kept ${plural(skipped, 'existing item', 'existing items')}.`;
    if (copied > 0) message += ` Added ${plural(copied, 'copy', 'copies')} alongside your existing items.`;
    notify(message, 'success');
    setPending(null);
    onClose();
  };

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      const backup = await createBackup();
      downloadText(
        `leviz-backup-${backup.exportedAt.slice(0, 10)}.leviz-backup.json`,
        serializeWorkspace(backup.lessons, backup.classes, backup.exportedAt),
      );
      const stamp = new Date().toISOString();
      writeLastBackup(stamp);
      setLastBackupAt(stamp);
      notify(
        `Downloaded backup with ${plural(backup.lessons.length, 'lesson', 'lessons')} and ${plural(
          backup.classes.length,
          'class',
          'classes',
        )}.`,
        'success',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the backup.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setPending(null);
    try {
      const backup = parseWorkspace(await readFileAsText(file));
      const conflicts = await inspect(backup);
      if (conflicts.lessons.length === 0 && conflicts.classes.length === 0) {
        await restoreAndRefresh(backup, 'keep');
      } else {
        setPending({ backup, conflicts });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not restore that backup.');
    } finally {
      setBusy(false);
    }
  };

  const applyMode = async (mode: WorkspaceRestoreMode) => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await restoreAndRefresh(pending.backup, mode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not restore that backup.');
    } finally {
      setBusy(false);
    }
  };

  const conflictCount = (pending?.conflicts.lessons.length ?? 0) + (pending?.conflicts.classes.length ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div
        className="absolute inset-0 bg-black/25"
        onClick={() => {
          if (!busy) onClose();
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-dialog-title"
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-default bg-elevated p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="workspace-dialog-title" className="text-lg font-semibold">
              Backup &amp; restore
            </h2>
            <p className="text-xs text-secondary">
              Back up every lesson and reusable class, or bring a backup into this browser.
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close backup and restore"
            disabled={busy}
          >
            <Icon name="x" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
          <section className="rounded-md border border-default bg-page p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Back up this browser</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-secondary">
                  Downloads one JSON file with all lessons, classes, notes, and rosters.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm shrink-0"
                onClick={() => void handleDownload()}
                disabled={busy}
              >
                <Icon name="download" size={13} />
                Download
              </button>
            </div>
            <div className="mt-3 space-y-1 border-t border-default pt-2 text-[11px] text-secondary">
              <p>{storageLabel(storageState)}</p>
              <p>
                Last backup:{' '}
                <span className="font-medium text-primary">
                  {lastBackupAt ? formatTimestamp(lastBackupAt) : 'none yet'}
                </span>
              </p>
            </div>
          </section>

          <section className="rounded-md border border-default bg-page p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Restore a backup</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-secondary">
                  Choose a LeViz workspace backup. Existing lessons and classes are never
                  removed; you decide how conflicts are handled.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm shrink-0"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
              >
                <Icon name="upload" size={13} />
                Choose file
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Restore a workspace backup"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void handleRestoreFile(file);
              }}
            />
          </section>

          {error ? (
            <p className="rounded-sm border border-danger/30 bg-danger/5 px-2.5 py-2 text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}

          {pending ? (
            <section className="rounded-md border border-strong bg-page p-3">
              <h3 className="text-sm font-semibold">Some items already exist</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-secondary">
                This backup has {plural(pending.backup.lessons.length, 'lesson', 'lessons')} and{' '}
                {plural(pending.backup.classes.length, 'class', 'classes')}. {conflictCount}{' '}
                {conflictCount === 1 ? 'item matches' : 'items match'} this browser.
              </p>
              <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto text-[11px] text-secondary">
                {pending.conflicts.lessons.slice(0, 4).map((item) => (
                  <li key={`lesson-${item.id}`}>Lesson · {item.title}</li>
                ))}
                {pending.conflicts.classes.slice(0, 4).map((item) => (
                  <li key={`class-${item.id}`}>Class · {item.name}</li>
                ))}
                {conflictCount > 8 ? <li>…and {conflictCount - 8} more</li> : null}
              </ul>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPending(null)}
                  disabled={busy}
                >
                  Cancel restore
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void applyMode('copy')}
                  disabled={busy}
                >
                  Import as copies
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void applyMode('keep')}
                  disabled={busy}
                >
                  Keep existing
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => void applyMode('replace')}
                  disabled={busy}
                >
                  Replace existing
                </button>
              </div>
            </section>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
