import { create } from 'zustand';
import { temporal } from 'zundo';
import { clampClassSize, createLayoutSegment, createTextSegment, totalMinutes } from '../domain/lesson';
import { applyTemplate, templateFor } from '../domain/templates';
import type {
  ActivityType,
  CanvasNode,
  CanvasState,
  LayoutSegment,
  Lesson,
  NodeNote,
  Segment,
  TextSegment,
} from '../domain/types';
import { activityGuidelines } from '../domain/activityGuidelines';
import { getLessonRepository } from '../repositories';
import { textTemplateFor, type TextTemplateId } from '../domain/textTemplates';
import { useRosterStore } from './rosterStore';

export type LessonStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface AssignmentOutcome {
  ok: boolean;
  warning?: boolean;
  message: string;
}

export interface ApplyGroupsOutcome {
  assignedCount: number;
  unplacedCount: number;
  nodesUsed: number;
}

type SegmentPatch = Partial<Pick<TextSegment, 'title' | 'durationMin' | 'content' | 'engagement'>> &
  Partial<Pick<LayoutSegment, 'title' | 'durationMin' | 'activityType' | 'instructions' | 'engagement'>>;

interface LessonState {
  lesson: Lesson | null;
  status: LessonStatus;
  saveState: SaveState;
  saveError: string | null;
  lastSavedAt: string | null;
  /** Incremented by every document mutation; autosave keys off it. */
  docRevision: number;

  beginLoad: () => void;
  hydrate: (lesson: Lesson | null, status: LessonStatus, error?: string | null) => void;
  save: () => Promise<void>;
  markDirty: () => void;

  setTitle: (title: string) => void;
  setLessonDate: (date: string | null) => void;
  setPeriodMinutes: (minutes: number) => void;
  setClassSize: (size: number) => void;

  addTextSegment: (templateId?: TextTemplateId) => string | null;
  addLayoutSegment: (activityType: ActivityType) => string | null;
  updateSegment: (segmentId: string, patch: SegmentPatch) => void;
  removeSegment: (segmentId: string) => void;
  moveSegment: (activeId: string, overId: string) => void;

  applyTemplateToSegment: (segmentId: string, activityType: ActivityType) => void;
  addNode: (segmentId: string, node: CanvasNode) => void;
  updateNode: (segmentId: string, nodeId: string, patch: Partial<CanvasNode>) => void;
  removeNode: (segmentId: string, nodeId: string) => void;
  setNodeNote: (segmentId: string, nodeId: string, note: NodeNote | null) => void;
  assignStudent: (segmentId: string, nodeId: string, studentId: string) => AssignmentOutcome;
  unassignStudent: (segmentId: string, nodeId: string, studentId: string) => void;
  removeStudentEverywhere: (studentId: string) => void;
  clearSegmentAssignments: (segmentId: string) => void;
  applyGroups: (segmentId: string, groups: { studentIds: string[] }[]) => ApplyGroupsOutcome;
}

function mapSegments(lesson: Lesson, segmentId: string, update: (segment: Segment) => Segment): Lesson {
  return {
    ...lesson,
    segments: lesson.segments.map((segment) => (segment.id === segmentId ? update(segment) : segment)),
  };
}

function layoutOf(lesson: Lesson, segmentId: string): LayoutSegment | null {
  const segment = lesson.segments.find((candidate) => candidate.id === segmentId);
  return segment && segment.kind === 'layout' ? segment : null;
}

function withCanvas(lesson: Lesson, segmentId: string, update: (canvas: CanvasState) => CanvasState): Lesson {
  return mapSegments(lesson, segmentId, (segment) =>
    segment.kind === 'layout' ? { ...segment, canvas: update(segment.canvas) } : segment,
  );
}

function withNodes(lesson: Lesson, segmentId: string, update: (nodes: CanvasNode[]) => CanvasNode[]): Lesson {
  return withCanvas(lesson, segmentId, (canvas) => ({ ...canvas, nodes: update(canvas.nodes) }));
}

function findNode(lesson: Lesson, segmentId: string, nodeId: string): CanvasNode | null {
  return layoutOf(lesson, segmentId)?.canvas.nodes.find((node) => node.id === nodeId) ?? null;
}

function clampMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export const useLessonStore = create<LessonState>()(
  temporal(
    (set, get) => {
      const mutate = (update: (lesson: Lesson) => Lesson) => {
        const lesson = get().lesson;
        if (!lesson) return;
        set((state) => ({ lesson: update(lesson), docRevision: state.docRevision + 1 }));
      };

      return {
        lesson: null,
        status: 'idle',
        saveState: 'idle',
        saveError: null,
        lastSavedAt: null,
        docRevision: 0,

        beginLoad: () => set({ status: 'loading', saveState: 'idle', saveError: null }),

        hydrate: (lesson, status, error = null) => {
          set({
            lesson,
            status,
            saveState: lesson ? 'saved' : 'idle',
            lastSavedAt: lesson?.updatedAt ?? null,
            saveError: error,
            docRevision: 0,
          });
          useLessonStore.temporal.getState().clear();
        },

        save: async () => {
          const { lesson, status } = get();
          if (!lesson || status !== 'ready') return;
          const updated: Lesson = {
            ...lesson,
            roster: structuredClone(useRosterStore.getState().students),
            updatedAt: new Date().toISOString(),
          };
          set({ saveState: 'saving' });
          try {
            await getLessonRepository().saveLesson(updated);
            // The editor may have closed while the write was in flight. The
            // write already landed; do not resurrect the cleared document.
            if (get().lesson?.id !== updated.id || get().status !== 'ready') return;
            // Never write the pre-await snapshot back over edits that landed
            // while the write was in flight — only adopt the new timestamp.
            // Updating updatedAt must not create an undo entry or re-trigger autosave.
            const temporalStore = useLessonStore.temporal.getState();
            temporalStore.pause();
            set((state) => ({
              lesson: state.lesson ? { ...state.lesson, updatedAt: updated.updatedAt } : state.lesson,
              saveState: 'saved',
              lastSavedAt: updated.updatedAt,
              saveError: null,
            }));
            temporalStore.resume();
          } catch (error) {
            if (get().lesson?.id !== updated.id) return;
            set({
              saveState: 'error',
              saveError: error instanceof Error ? error.message : 'Save failed.',
            });
          }
        },

        markDirty: () =>
          set((state) => ({
            docRevision: state.docRevision + 1,
          })),

        setTitle: (title) => mutate((lesson) => ({ ...lesson, title })),
        setLessonDate: (date) => mutate((lesson) => ({ ...lesson, lessonDate: date })),
        setPeriodMinutes: (minutes) =>
          mutate((lesson) => ({ ...lesson, durationMin: clampMinutes(minutes) })),
        setClassSize: (size) =>
          mutate((lesson) => ({ ...lesson, classSize: clampClassSize(size) })),

        addTextSegment: (templateId = 'blank') => {
          const lesson = get().lesson;
          if (!lesson) return null;
          const template = textTemplateFor(templateId);
          const segment =
            !template || template.id === 'blank'
              ? createTextSegment(`Text segment ${lesson.segments.length + 1}`)
              : createTextSegment(template.title, template.content, template.durationMin);
          mutate((current) => ({ ...current, segments: [...current.segments, segment] }));
          return segment.id;
        },

        addLayoutSegment: (activityType) => {
          const lesson = get().lesson;
          if (!lesson) return null;
          const base = createLayoutSegment(activityType);
          const template = templateFor(activityType);
          const segment: LayoutSegment = {
            ...base,
            instructions: activityGuidelines(activityType),
            ...(template && activityType !== 'custom'
              ? {
                  title: template.name,
                  canvas: applyTemplate(base.canvas, template, lesson.classSize),
                }
              : {}),
          };
          mutate((current) => ({ ...current, segments: [...current.segments, segment] }));
          return segment.id;
        },

        updateSegment: (segmentId, patch) => {
          mutate((lesson) =>
            mapSegments(lesson, segmentId, (segment) => ({ ...segment, ...patch }) as Segment),
          );
        },

        removeSegment: (segmentId) => {
          mutate((lesson) => ({
            ...lesson,
            segments: lesson.segments.filter((segment) => segment.id !== segmentId),
          }));
        },

        moveSegment: (activeId, overId) => {
          if (activeId === overId) return;
          mutate((lesson) => {
            const fromIndex = lesson.segments.findIndex((segment) => segment.id === activeId);
            const toIndex = lesson.segments.findIndex((segment) => segment.id === overId);
            if (fromIndex < 0 || toIndex < 0) return lesson;
            const segments = [...lesson.segments];
            const [moved] = segments.splice(fromIndex, 1);
            if (!moved) return lesson;
            segments.splice(toIndex, 0, moved);
            return { ...lesson, segments };
          });
        },

        applyTemplateToSegment: (segmentId, activityType) => {
          const template = templateFor(activityType);
          if (!template) return;
          mutate((lesson) =>
            mapSegments(lesson, segmentId, (segment) =>
              segment.kind === 'layout'
                ? {
                    ...segment,
                    activityType,
                    // Fill blank instructions with the activity's sample guidance;
                    // never overwrite a teacher's own text.
                    instructions: segment.instructions.trim()
                      ? segment.instructions
                      : activityGuidelines(activityType),
                    canvas: applyTemplate(segment.canvas, template, lesson.classSize),
                  }
                : segment,
            ),
          );
        },

        addNode: (segmentId, node) => {
          mutate((lesson) => withNodes(lesson, segmentId, (nodes) => [...nodes, node]));
        },

        updateNode: (segmentId, nodeId, patch) => {
          mutate((lesson) =>
            withNodes(lesson, segmentId, (nodes) =>
              nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
            ),
          );
        },

        removeNode: (segmentId, nodeId) => {
          mutate((lesson) => withNodes(lesson, segmentId, (nodes) => nodes.filter((node) => node.id !== nodeId)));
        },

        setNodeNote: (segmentId, nodeId, note) => {
          mutate((lesson) =>
            withNodes(lesson, segmentId, (nodes) =>
              nodes.map((node) => (node.id === nodeId ? { ...node, note } : node)),
            ),
          );
        },

        assignStudent: (segmentId, nodeId, studentId) => {
          const lesson = get().lesson;
          if (!lesson) return { ok: false, message: 'No lesson is open.' };
          const node = findNode(lesson, segmentId, nodeId);
          if (!node) return { ok: false, message: 'That node no longer exists.' };
          const students = useRosterStore.getState().students;
          const student = students.find((candidate) => candidate.id === studentId);
          if (!student) return { ok: false, message: 'That student is not on the roster.' };
          if (node.assignedStudentIds.includes(studentId)) {
            return { ok: false, message: `${student.name} is already at ${node.label}.` };
          }
          if (node.capacity === 0) {
            return { ok: false, message: `${node.label} does not hold students.` };
          }
          if (node.assignedStudentIds.length >= node.capacity) {
            return { ok: false, message: `${node.label} is full (${node.capacity}).` };
          }

          const blocked = new Set(student.notWith);
          for (const other of students) {
            if (other.notWith.includes(studentId)) blocked.add(other.id);
          }
          const conflicts = node.assignedStudentIds
            .filter((id) => blocked.has(id))
            .map((id) => students.find((candidate) => candidate.id === id)?.name ?? id);

          mutate((current) =>
            withNodes(current, segmentId, (nodes) =>
              nodes.map((candidate) => {
                const withoutStudent = candidate.assignedStudentIds.filter((id) => id !== studentId);
                return candidate.id === nodeId
                  ? { ...candidate, assignedStudentIds: [...withoutStudent, studentId] }
                  : { ...candidate, assignedStudentIds: withoutStudent };
              }),
            ),
          );

          if (conflicts.length > 0) {
            return {
              ok: true,
              warning: true,
              message: `${student.name} assigned to ${node.label}. Constraint warning: keep apart from ${conflicts.join(', ')}.`,
            };
          }
          return { ok: true, message: `${student.name} → ${node.label}` };
        },

        unassignStudent: (segmentId, nodeId, studentId) => {
          mutate((lesson) =>
            withNodes(lesson, segmentId, (nodes) =>
              nodes.map((node) =>
                node.id === nodeId
                  ? {
                      ...node,
                      assignedStudentIds: node.assignedStudentIds.filter((id) => id !== studentId),
                    }
                  : node,
              ),
            ),
          );
        },

        removeStudentEverywhere: (studentId) => {
          mutate((lesson) => ({
            ...lesson,
            segments: lesson.segments.map((segment) =>
              segment.kind === 'layout'
                ? {
                    ...segment,
                    canvas: {
                      ...segment.canvas,
                      nodes: segment.canvas.nodes.map((node) => ({
                        ...node,
                        assignedStudentIds: node.assignedStudentIds.filter((id) => id !== studentId),
                      })),
                    },
                  }
                : segment,
            ),
          }));
        },

        clearSegmentAssignments: (segmentId) => {
          mutate((lesson) =>
            withNodes(lesson, segmentId, (nodes) =>
              nodes.map((node) => ({ ...node, assignedStudentIds: [] })),
            ),
          );
        },

        applyGroups: (segmentId, groups) => {
          const lesson = get().lesson;
          if (!lesson) return { assignedCount: 0, unplacedCount: 0, nodesUsed: 0 };
          const layout = layoutOf(lesson, segmentId);
          if (!layout) return { assignedCount: 0, unplacedCount: 0, nodesUsed: 0 };

          const rosterIds = new Set(useRosterStore.getState().students.map((student) => student.id));
          // Strict, transitive reading order: top-to-bottom, then left-to-right.
          const targets = [...layout.canvas.nodes]
            .filter((node) => node.capacity > 0)
            .sort((a, b) => a.y - b.y || a.x - b.x);

          const remaining = new Map(targets.map((node) => [node.id, node.capacity]));
          const assignments = new Map(targets.map((node) => [node.id, [] as string[]]));
          const placed = new Set<string>();
          let assignedCount = 0;
          let unplacedCount = 0;

          for (const group of groups) {
            const studentIds = group.studentIds.filter(
              (id) => rosterIds.has(id) && !placed.has(id),
            );
            if (studentIds.length === 0) continue;

            // Prefer one seat area that can hold the whole group; choose the
            // tightest fit so a 2-person group does not waste a 5-seat table.
            let bestFit: (typeof targets)[number] | undefined;
            for (const node of targets) {
              const room = remaining.get(node.id) ?? 0;
              if (room < studentIds.length) continue;
              if (!bestFit || room < (remaining.get(bestFit.id) ?? 0)) bestFit = node;
            }

            if (bestFit) {
              const slots = assignments.get(bestFit.id);
              const room = remaining.get(bestFit.id) ?? 0;
              if (slots) {
                slots.push(...studentIds);
                remaining.set(bestFit.id, room - studentIds.length);
                for (const id of studentIds) placed.add(id);
                assignedCount += studentIds.length;
              }
              continue;
            }

            // Otherwise spread the group across the next free seats in reading
            // order — chairs and mixed-capacity layouts need this.
            let cursor = 0;
            for (const node of targets) {
              if (cursor >= studentIds.length) break;
              const room = remaining.get(node.id) ?? 0;
              if (room <= 0) continue;
              const chunk = studentIds.slice(cursor, cursor + room);
              const slots = assignments.get(node.id);
              if (!slots) continue;
              slots.push(...chunk);
              remaining.set(node.id, room - chunk.length);
              for (const id of chunk) placed.add(id);
              assignedCount += chunk.length;
              cursor += chunk.length;
            }
            unplacedCount += studentIds.length - cursor;
          }

          let nodesUsed = 0;
          for (const slots of assignments.values()) {
            if (slots.length > 0) nodesUsed += 1;
          }

          // Applying a grouping is a full arrangement of the canvas: seats that
          // did not receive a group are cleared so no student is placed twice.
          mutate((current) =>
            withNodes(current, segmentId, (nodes) =>
              nodes.map((node) => {
                if (node.capacity === 0) return node;
                return { ...node, assignedStudentIds: assignments.get(node.id) ?? [] };
              }),
            ),
          );

          return { assignedCount, unplacedCount, nodesUsed };
        },

      };
    },
    {
      limit: 50,
      partialize: (state) => ({ lesson: state.lesson }),
      equality: (past, current) => past.lesson === current.lesson,
    },
  ),
);

/** Compose the full document (lesson metadata/segments + roster store). */
export function currentLessonDocument(): Lesson | null {
  const lesson = useLessonStore.getState().lesson;
  if (!lesson) return null;
  return { ...lesson, roster: structuredClone(useRosterStore.getState().students) };
}

export function lessonTotalMinutes(lesson: Lesson | null): number {
  return lesson ? totalMinutes(lesson.segments) : 0;
}
