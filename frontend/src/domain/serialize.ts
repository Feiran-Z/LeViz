import { resolveClassSize } from './lesson';
import type { Lesson } from './types';

export const SCHEMA_VERSION = 1;

export interface LessonFile {
  schemaVersion: number;
  lesson: Lesson;
}

export function serializeLesson(lesson: Lesson): string {
  const file: LessonFile = { schemaVersion: SCHEMA_VERSION, lesson };
  return `${JSON.stringify(file, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid lesson file: ${message}`);
}

/**
 * Lossless parse. The lesson object is returned exactly as it appears in the
 * file, so `parse(serialize(lesson))` is deep-equal to `lesson`.
 */
export function parseLesson(json: string): Lesson {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid lesson file: not valid JSON.');
  }

  assert(isRecord(parsed), 'root must be an object.');
  assert(typeof parsed['schemaVersion'] === 'number', 'missing schemaVersion.');
  assert(
    Number(parsed['schemaVersion']) <= SCHEMA_VERSION,
    `schemaVersion ${String(parsed['schemaVersion'])} is newer than this app supports.`,
  );

  const lesson = parsed['lesson'];
  assert(isRecord(lesson), 'missing lesson.');
  assert(typeof lesson['id'] === 'string' && lesson['id'].length > 0, 'lesson.id is required.');
  assert(typeof lesson['title'] === 'string', 'lesson.title is required.');
  assert(Array.isArray(lesson['segments']), 'lesson.segments must be an array.');
  assert(Array.isArray(lesson['roster']), 'lesson.roster must be an array.');

  for (const segment of lesson['segments']) {
    assert(isRecord(segment), 'each segment must be an object.');
    assert(typeof segment['id'] === 'string', 'segment.id is required.');
    assert(segment['kind'] === 'text' || segment['kind'] === 'layout', 'segment.kind must be text or layout.');
    if (segment['kind'] === 'layout') {
      assert(isRecord(segment['canvas']), 'layout segment requires a canvas.');
      assert(Array.isArray(segment['canvas']['nodes']), 'canvas.nodes must be an array.');
    }
  }

  for (const student of lesson['roster']) {
    assert(isRecord(student), 'each student must be an object.');
    assert(typeof student['id'] === 'string', 'student.id is required.');
    assert(typeof student['name'] === 'string', 'student.name is required.');
  }

  const rawClassSize = lesson['classSize'];
  assert(
    rawClassSize === undefined || (typeof rawClassSize === 'number' && Number.isFinite(rawClassSize)),
    'lesson.classSize must be a number.',
  );
  // Older exports predate classSize; infer it from the roster or use the default.
  lesson['classSize'] = resolveClassSize(rawClassSize, lesson['roster'].length);

  return lesson as unknown as Lesson;
}
