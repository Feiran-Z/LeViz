import { useEffect, useState, type ReactNode } from 'react';
import { countRemovedAssignments } from '../../domain/classRoster';
import type { ClassRoster } from '../../domain/types';
import {
  applyClassToLesson,
  refreshLessonFromClass,
  saveChangesToClass,
  saveRosterAsClass,
  unlinkLessonClass,
} from '../../stores/classSession';
import { useClassRosterStore } from '../../stores/classRosterStore';
import { useLessonStore } from '../../stores/lessonStore';
import { useRosterStore } from '../../stores/rosterStore';
import { useUiStore } from '../../stores/uiStore';
import { ClassesDialog } from '../classes/ClassesDialog';
import { Icon } from '../ui/Icons';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PromptDialog } from '../ui/PromptDialog';

type ConfirmAction =
  | { kind: 'apply'; classRoster: ClassRoster; loss: number }
  | { kind: 'refresh'; classRoster: ClassRoster; loss: number }
  | { kind: 'save'; classRoster: ClassRoster };

function lossSentence(loss: number): string {
  if (loss === 0) return '';
  return ` ${loss} seat assignment${loss === 1 ? '' : 's'} will be removed.`;
}

export function RosterClassSection() {
  const lesson = useLessonStore((state) => state.lesson);
  const students = useRosterStore((state) => state.students);
  const classes = useClassRosterStore((state) => state.classes);
  const status = useClassRosterStore((state) => state.status);
  const refreshClasses = useClassRosterStore((state) => state.refresh);
  const getClass = useClassRosterStore((state) => state.get);
  const notify = useUiStore((state) => state.notify);

  const [selectedId, setSelectedId] = useState('');
  const [promptOpen, setPromptOpen] = useState(false);
  const [classesOpen, setClassesOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    void refreshClasses();
  }, [refreshClasses]);

  if (!lesson) return null;

  const classRoster = lesson.classId ? getClass(lesson.classId) : undefined;
  const selectedClass = selectedId ? getClass(selectedId) : undefined;

  const lossFor = (roster: ClassRoster) =>
    countRemovedAssignments(
      lesson.segments,
      new Set(roster.students.map((student) => student.id)),
    );

  const runApply = (roster: ClassRoster) => {
    applyClassToLesson(roster);
    setSelectedId('');
    notify(`Using ${roster.name}.`, 'success');
  };

  const requestApply = () => {
    if (!selectedClass) return;
    const loss = lossFor(selectedClass);
    if (students.length > 0 || loss > 0) setConfirm({ kind: 'apply', classRoster: selectedClass, loss });
    else runApply(selectedClass);
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const action = confirm;
    setConfirm(null);
    try {
      if (action.kind === 'apply') {
        runApply(action.classRoster);
      } else if (action.kind === 'refresh') {
        refreshLessonFromClass(action.classRoster);
        notify(`Refreshed from ${action.classRoster.name}.`, 'success');
      } else {
        await saveChangesToClass();
        notify(`Saved changes to ${action.classRoster.name}.`, 'success');
      }
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Could not update the class.', 'error');
    }
  };

  const shell = (children: ReactNode) => (
    <div className="px-4 pb-2">
      <div className="rounded-md border border-default bg-page px-2.5 py-2">
        {children}
        <div className="mt-1">
          <button
            type="button"
            className="text-[10px] text-secondary underline-offset-2 hover:text-primary hover:underline"
            onClick={() => setClassesOpen(true)}
          >
            Manage classes
          </button>
        </div>
      </div>
      <ClassesDialog open={classesOpen} onClose={() => setClassesOpen(false)} />
    </div>
  );

  const promptDialog = (
    <PromptDialog
      open={promptOpen}
      title="Save roster as class"
      label="Class name"
      confirmLabel="Save class"
      onCancel={() => setPromptOpen(false)}
      onConfirm={async (name) => {
        try {
          const roster = await saveRosterAsClass(name);
          notify(`Saved ${roster.name} as a class.`, 'success');
          return null;
        } catch (cause) {
          return cause instanceof Error ? cause.message : 'Could not save the class.';
        }
      }}
    />
  );

  const confirmDialog = (
    <ConfirmDialog
      open={confirm !== null}
      title={
        confirm
          ? confirm.kind === 'apply'
            ? `Use ${confirm.classRoster.name}?`
            : confirm.kind === 'refresh'
              ? `Refresh from ${confirm.classRoster.name}?`
              : `Save this roster to ${confirm.classRoster.name}?`
          : ''
      }
      message={
        confirm
          ? confirm.kind === 'save'
            ? 'Other lessons using this class keep their snapshots until refreshed.'
            : `This replaces the lesson roster with ${confirm.classRoster.students.length} students.${lossSentence(confirm.loss)}`
          : ''
      }
      confirmLabel={
        confirm?.kind === 'apply'
          ? 'Use class'
          : confirm?.kind === 'refresh'
            ? 'Refresh class'
            : 'Save to class'
      }
      onConfirm={() => void runConfirm()}
      onCancel={() => setConfirm(null)}
    />
  );

  if (lesson.classId && !classRoster) {
    if (status !== 'ready' && status !== 'error') {
      return shell(<p className="text-[11px] text-secondary">Loading class…</p>);
    }
    return shell(
      <>
        <div className="flex items-center gap-1.5 text-[11px] text-warning">
          <Icon name="warning" size={11} className="shrink-0" />
          Class unavailable — roster snapshot kept.
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setPromptOpen(true)}
            disabled={students.length === 0}
          >
            Save as class…
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              unlinkLessonClass();
              notify('Class link removed.', 'info');
            }}
          >
            Unlink
          </button>
        </div>
        {promptDialog}
        {confirmDialog}
      </>
    );
  }

  if (classRoster) {
    return shell(
      <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="section-label">Class</span>
          <span className="tag">{classRoster.name}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() =>
              setConfirm({ kind: 'refresh', classRoster, loss: lossFor(classRoster) })
            }
          >
            Refresh from class
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setConfirm({ kind: 'save', classRoster })}
            disabled={students.length === 0}
          >
            Save changes to class
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              unlinkLessonClass();
              notify('Class link removed.', 'info');
            }}
          >
            Unlink
          </button>
        </div>
        {confirmDialog}
      </>
    );
  }

  return shell(
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="section-label">Class</span>
        {status === 'error' ? (
          <span className="text-[10px] text-danger">Could not load classes</span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <select
          className="h-7 min-w-0 flex-1 rounded-sm border border-default bg-surface px-1.5 text-[11px] text-primary"
          value={selectedId}
          aria-label="Choose a class"
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={!classes || classes.length === 0}
        >
          <option value="">
            {!classes || classes.length === 0 ? 'No classes yet' : 'Choose a class…'}
          </option>
          {classes?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.students.length})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-secondary btn-sm shrink-0"
          onClick={requestApply}
          disabled={!selectedClass}
        >
          Use class
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setPromptOpen(true)}
          disabled={students.length === 0}
        >
          Save as class…
        </button>
        {students.length === 0 ? (
          <span className="text-[10px] text-secondary">Add students to save a class</span>
        ) : null}
      </div>

      {promptDialog}
      {confirmDialog}
    </>
  );
}
