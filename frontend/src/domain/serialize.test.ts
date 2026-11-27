import { describe, expect, it } from 'vitest';
import { DEFAULT_CLASS_SIZE, createCanvasNode, createLayoutSegment, createLesson, createStudent, createTextSegment } from './lesson';
import { parseLesson, SCHEMA_VERSION, serializeLesson } from './serialize';
import type { Lesson } from './types';

function richLesson(): Lesson {
  const lesson = createLesson('Round-trip lesson');
  lesson.roster = [
    createStudent('Ada', { tags: ['strong reader'], notWith: [], togetherWith: [] }),
    createStudent('Grace', { tags: [], notWith: [], togetherWith: [] }),
  ];
  lesson.roster[0]!.notWith = [lesson.roster[1]!.id];
  lesson.segments = [createTextSegment('Do Now'), createLayoutSegment('harkness')];
  const layout = lesson.segments[1];
  if (layout && layout.kind === 'layout') {
    const node = createCanvasNode('station', 120, 80, {
      label: 'Station A',
      capacity: 3,
      note: { title: 'Prompt', body: 'Discuss the opening question.' },
      rotation: 15,
    });
    node.assignedStudentIds = [lesson.roster[0]!.id];
    layout.canvas.nodes = [node];
    layout.instructions = 'Move clockwise every eight minutes.';
  }
  return lesson;
}

describe('serialize', () => {
  it('round-trips a full lesson identically', () => {
    const lesson = richLesson();
    const restored = parseLesson(serializeLesson(lesson));
    expect(JSON.stringify(restored)).toBe(JSON.stringify(lesson));
  });

  it('fills engagement defaults in documents written before the field existed', () => {
    const lesson = createLesson('Old engagement');
    const text = createTextSegment('Do Now');
    const layout = createLayoutSegment('station-rotation');
    layout.canvas.nodes = [createCanvasNode('station', 0, 0)];
    delete (text as { engagement?: unknown }).engagement;
    delete (layout as { engagement?: unknown }).engagement;
    delete (layout.canvas.nodes[0] as { engagement?: unknown }).engagement;
    lesson.segments = [text, layout];

    const restored = parseLesson(serializeLesson(lesson));

    expect(restored.segments[0]?.engagement).toEqual({
      cognitive: 'medium',
      behavioral: 'medium',
      affective: 'medium',
    });
    const restoredLayout = restored.segments[1];
    if (!restoredLayout || restoredLayout.kind !== 'layout') throw new Error('layout missing');
    expect(restoredLayout.engagement).toEqual({
      cognitive: 'medium',
      behavioral: 'medium',
      affective: 'medium',
    });
    expect(restoredLayout.canvas.nodes[0]?.engagement).toBeNull();
  });

  it('writes the schema version', () => {
    const parsed = JSON.parse(serializeLesson(createLesson())) as { schemaVersion: number };
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('infers classSize for documents written before the field existed', () => {
    const lesson = createLesson('Old');
    const raw = JSON.parse(
      JSON.stringify({
        schemaVersion: 1,
        lesson: { ...lesson, roster: [createStudent('A'), createStudent('B')] },
      }),
    ) as { lesson: Record<string, unknown> };
    delete raw.lesson['classSize'];
    expect(parseLesson(JSON.stringify(raw)).classSize).toBe(2);

    const empty = JSON.parse(JSON.stringify({ schemaVersion: 1, lesson: { ...lesson, roster: [] } })) as {
      lesson: Record<string, unknown>;
    };
    delete empty.lesson['classSize'];
    expect(parseLesson(JSON.stringify(empty)).classSize).toBe(DEFAULT_CLASS_SIZE);
  });

  it('rejects a non-numeric classSize', () => {
    const lesson = createLesson();
    const raw = { schemaVersion: 1, lesson: { ...lesson, classSize: 'lots' } };
    expect(() => parseLesson(JSON.stringify(raw))).toThrow(/classSize/);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseLesson('{nope')).toThrow(/not valid JSON/);
  });

  it('rejects a missing lesson', () => {
    expect(() => parseLesson(JSON.stringify({ schemaVersion: 1 }))).toThrow(/missing lesson/);
  });

  it('rejects a future schema version', () => {
    expect(() => parseLesson(JSON.stringify({ schemaVersion: 99, lesson: {} }))).toThrow(/newer/);
  });

  it('rejects a malformed segment', () => {
    const broken = { schemaVersion: 1, lesson: { id: 'x', title: 'x', roster: [], segments: [{}] } };
    expect(() => parseLesson(JSON.stringify(broken))).toThrow(/segment/);
  });
});
