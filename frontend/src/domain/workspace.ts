import { newId } from './lesson';
import { normalizeLessonDocument } from './serialize';
import type { ClassRoster, Lesson } from './types';

/**
 * L1 — whole-workspace backup and restore. A workspace file carries every
 * lesson and reusable class, so a teacher can move browsers without losing the
 * class library that lesson exports intentionally omit.
 */

export const WORKSPACE_KIND = 'leviz-workspace';
export const WORKSPACE_SCHEMA_VERSION = 1;

export interface WorkspaceBackup {
  kind: typeof WORKSPACE_KIND;
  schemaVersion: number;
  exportedAt: string;
  lessons: Lesson[];
  classes: ClassRoster[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid workspace backup: ${message}`);
}

function normalizeClassRoster(value: unknown, index: number): ClassRoster {
  const label = `class ${index + 1}`;
  assert(isRecord(value), `${label} must be an object.`);
  assert(
    typeof value['id'] === 'string' && value['id'].length > 0,
    `${label}.id is required.`,
  );
  assert(typeof value['name'] === 'string', `${label}.name is required.`);
  assert(Array.isArray(value['students']), `${label}.students must be an array.`);
  for (const student of value['students']) {
    assert(isRecord(student), `${label} has a malformed student.`);
    assert(typeof student['id'] === 'string', `${label} has a student without an id.`);
    assert(typeof student['name'] === 'string', `${label} has a student without a name.`);
  }
  assert(typeof value['createdAt'] === 'string', `${label}.createdAt is required.`);
  assert(typeof value['updatedAt'] === 'string', `${label}.updatedAt is required.`);
  return structuredClone(value) as unknown as ClassRoster;
}

export function serializeWorkspace(
  lessons: Lesson[],
  classes: ClassRoster[],
  exportedAt = new Date().toISOString(),
): string {
  const file: WorkspaceBackup = {
    kind: WORKSPACE_KIND,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    exportedAt,
    lessons,
    classes,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseWorkspace(json: string): WorkspaceBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid workspace backup: not valid JSON.');
  }

  assert(isRecord(parsed), 'root must be an object.');
  assert(parsed['kind'] === WORKSPACE_KIND, 'not a LeViz workspace backup.');
  assert(typeof parsed['schemaVersion'] === 'number', 'missing schemaVersion.');
  assert(
    Number(parsed['schemaVersion']) <= WORKSPACE_SCHEMA_VERSION,
    `schemaVersion ${String(parsed['schemaVersion'])} is newer than this app supports.`,
  );
  assert(typeof parsed['exportedAt'] === 'string', 'missing exportedAt.');
  assert(Array.isArray(parsed['lessons']), 'lessons must be an array.');
  assert(Array.isArray(parsed['classes']), 'classes must be an array.');

  const lessons = parsed['lessons'].map((value, index) => {
    try {
      return normalizeLessonDocument(value);
    } catch (cause) {
      throw new Error(
        `Invalid workspace backup: lesson ${index + 1}: ${
          cause instanceof Error ? cause.message : 'unknown error.'
        }`,
      );
    }
  });
  const classes = parsed['classes'].map((value, index) => normalizeClassRoster(value, index));

  return {
    kind: WORKSPACE_KIND,
    schemaVersion: Number(parsed['schemaVersion']),
    exportedAt: parsed['exportedAt'],
    lessons,
    classes,
  };
}

export type WorkspaceRestoreMode = 'replace' | 'keep' | 'copy';

export interface WorkspaceRestoreCounts {
  lessonsAdded: number;
  lessonsReplaced: number;
  lessonsSkipped: number;
  lessonsCopied: number;
  classesAdded: number;
  classesReplaced: number;
  classesSkipped: number;
  classesCopied: number;
}

export interface WorkspaceRestorePlan {
  lessons: Lesson[];
  classes: ClassRoster[];
  counts: WorkspaceRestoreCounts;
}

function restoredClassName(name: string, used: Set<string>): string {
  const base = `${name.trim() || 'Restored class'} (restored)`;
  let candidate = base;
  let index = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} ${index}`;
    index += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Decide what a restore will write without touching storage.
 *
 * - `replace`: overwrite items whose id already exists.
 * - `keep`: leave existing items untouched and only add missing ones.
 * - `copy`: preserve existing items and add every backup item; conflicting
 *   ids get new ids, and lesson.classId links are remapped to copied classes.
 */
export function planWorkspaceRestore(
  backup: WorkspaceBackup,
  existingLessonIds: ReadonlySet<string>,
  existingClasses: ClassRoster[],
  mode: WorkspaceRestoreMode,
): WorkspaceRestorePlan {
  const counts: WorkspaceRestoreCounts = {
    lessonsAdded: 0,
    lessonsReplaced: 0,
    lessonsSkipped: 0,
    lessonsCopied: 0,
    classesAdded: 0,
    classesReplaced: 0,
    classesSkipped: 0,
    classesCopied: 0,
  };
  const existingClassIds = new Set(existingClasses.map((roster) => roster.id));

  if (mode === 'replace') {
    for (const lesson of backup.lessons) {
      if (existingLessonIds.has(lesson.id)) counts.lessonsReplaced += 1;
      else counts.lessonsAdded += 1;
    }
    for (const roster of backup.classes) {
      if (existingClassIds.has(roster.id)) counts.classesReplaced += 1;
      else counts.classesAdded += 1;
    }
    return {
      lessons: backup.lessons.map((lesson) => structuredClone(lesson)),
      classes: backup.classes.map((roster) => structuredClone(roster)),
      counts,
    };
  }

  if (mode === 'keep') {
    const lessons = backup.lessons.filter((lesson) => {
      const conflict = existingLessonIds.has(lesson.id);
      if (conflict) counts.lessonsSkipped += 1;
      else counts.lessonsAdded += 1;
      return !conflict;
    });
    const classes = backup.classes.filter((roster) => {
      const conflict = existingClassIds.has(roster.id);
      if (conflict) counts.classesSkipped += 1;
      else counts.classesAdded += 1;
      return !conflict;
    });
    return {
      lessons: lessons.map((lesson) => structuredClone(lesson)),
      classes: classes.map((roster) => structuredClone(roster)),
      counts,
    };
  }

  const usedNames = new Set(existingClasses.map((roster) => roster.name.trim().toLowerCase()));
  const classIdMap = new Map<string, string>();
  const classes = backup.classes.map((roster) => {
    const copied = existingClassIds.has(roster.id);
    const id = copied ? newId('class') : roster.id;
    if (copied) classIdMap.set(roster.id, id);

    const nameKey = roster.name.trim().toLowerCase();
    const name = copied || usedNames.has(nameKey) ? restoredClassName(roster.name, usedNames) : roster.name;
    if (!copied && !usedNames.has(nameKey)) usedNames.add(nameKey);

    if (copied) counts.classesCopied += 1;
    else counts.classesAdded += 1;
    return { ...structuredClone(roster), id, name };
  });

  const lessons = backup.lessons.map((lesson) => {
    const copied = existingLessonIds.has(lesson.id);
    const id = copied ? newId('lesson') : lesson.id;
    const classId =
      lesson.classId && classIdMap.has(lesson.classId)
        ? classIdMap.get(lesson.classId)!
        : lesson.classId;
    if (copied) counts.lessonsCopied += 1;
    else counts.lessonsAdded += 1;
    return {
      ...structuredClone(lesson),
      id,
      classId,
      title: copied ? `${lesson.title} (restored copy)` : lesson.title,
    };
  });

  return { lessons, classes, counts };
}
