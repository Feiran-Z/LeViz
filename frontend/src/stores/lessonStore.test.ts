import { beforeEach, describe, expect, it } from 'vitest';
import { createCanvasNode, createLesson } from '../domain/lesson';
import { generateGroups } from '../domain/grouping';
import { setLessonRepository } from '../repositories';
import type { LessonRepository } from '../repositories/types';
import { useLessonStore } from './lessonStore';
import { useRosterStore } from './rosterStore';

let releaseSave: (() => void) | null = null;
let savedLessonTitle: string | null = null;

function classOf(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `s${index + 1}`,
    name: `Student ${index + 1}`,
    tags: [] as string[],
    notWith: [] as string[],
    togetherWith: [] as string[],
  }));
}

function assignedIds(segmentId: string): string[] {
  const segment = useLessonStore.getState().lesson?.segments.find((candidate) => candidate.id === segmentId);
  if (!segment || segment.kind !== 'layout') return [];
  return segment.canvas.nodes.flatMap((node) => node.assignedStudentIds);
}

const repository: LessonRepository = {
  listLessons: async () => [],
  getLesson: async () => null,
  saveLesson: (lesson) =>
    new Promise((resolve) => {
      savedLessonTitle = lesson.title;
      releaseSave = () => resolve(lesson);
    }),
  deleteLesson: async () => {},
};

beforeEach(() => {
  releaseSave = null;
  savedLessonTitle = null;
  setLessonRepository(repository);
  useLessonStore.getState().hydrate(createLesson('Initial'), 'ready');
});

describe('lessonStore.save', () => {
  it('does not overwrite edits that land while the write is in flight', async () => {
    useLessonStore.getState().setTitle('First');
    const saving = useLessonStore.getState().save();

    // A second edit arrives while IndexedDB is still writing.
    useLessonStore.getState().setTitle('Second');
    releaseSave?.();
    await saving;

    expect(savedLessonTitle).toBe('First');
    expect(useLessonStore.getState().lesson?.title).toBe('Second');
  });

  it('places a full mock-trial class even when group sizes do not match node capacities', () => {
    useLessonStore.getState().setClassSize(24);
    const students = classOf(24);
    useRosterStore.getState().load(students);
    const segmentId = useLessonStore.getState().addLayoutSegment('mock-trial');
    if (!segmentId) throw new Error('layout segment not created');

    // Groups of 1–2 (the old default over-split the class) against 1- and 5-seat nodes.
    const groups = generateGroups(students, { groupCount: 16, mode: 'random', seed: 3 });
    const outcome = useLessonStore.getState().applyGroups(segmentId, groups.groups);

    expect(outcome.assignedCount).toBe(24);
    expect(outcome.unplacedCount).toBe(0);
    const assigned = assignedIds(segmentId);
    expect(assigned).toHaveLength(24);
    expect(new Set(assigned).size).toBe(24);

    const segment = useLessonStore.getState().lesson?.segments.find((candidate) => candidate.id === segmentId);
    if (segment?.kind === 'layout') {
      for (const node of segment.canvas.nodes) {
        expect(node.assignedStudentIds.length, node.label).toBeLessThanOrEqual(node.capacity);
      }
    }
  });

  it('uses every discussion table when there are five groups and five tables', () => {
    useLessonStore.getState().setClassSize(20);
    const students = classOf(12);
    useRosterStore.getState().load(students);
    const segmentId = useLessonStore.getState().addLayoutSegment('group-discussion');
    if (!segmentId) throw new Error('layout segment not created');

    const groups = generateGroups(students, { groupCount: 5, mode: 'random', seed: 7 });
    const outcome = useLessonStore.getState().applyGroups(segmentId, groups.groups);

    const segment = useLessonStore.getState().lesson?.segments.find((candidate) => candidate.id === segmentId);
    if (!segment || segment.kind !== 'layout') throw new Error('layout missing');
    const tables = segment.canvas.nodes.filter((node) => node.type === 'round-table');

    expect(tables).toHaveLength(5);
    expect(outcome.assignedCount).toBe(12);
    expect(outcome.nodesUsed).toBe(5);
    expect(tables.every((table) => table.assignedStudentIds.length > 0)).toBe(true);
  });

  it('spreads Harkness groups across all chairs instead of one chair per group', () => {
    useLessonStore.getState().setClassSize(24);
    const students = classOf(24);
    useRosterStore.getState().load(students);
    const segmentId = useLessonStore.getState().addLayoutSegment('harkness');
    if (!segmentId) throw new Error('layout segment not created');

    const groups = generateGroups(students, { groupCount: 6, mode: 'constraints', seed: 5 });
    const outcome = useLessonStore.getState().applyGroups(segmentId, groups.groups);

    expect(outcome.assignedCount).toBe(24);
    expect(outcome.unplacedCount).toBe(0);
    expect(new Set(assignedIds(segmentId)).size).toBe(24);
  });

  it('reports students who do not fit when the canvas runs out of seats', () => {
    const students = classOf(4);
    useRosterStore.getState().load(students);
    const segmentId = useLessonStore.getState().addLayoutSegment('custom');
    if (!segmentId) throw new Error('layout segment not created');
    useLessonStore.getState().addNode(segmentId, createCanvasNode('chair', 40, 40));
    useLessonStore.getState().addNode(segmentId, createCanvasNode('chair', 140, 40));

    const groups = generateGroups(students, { groupCount: 2, mode: 'random', seed: 1 });
    const outcome = useLessonStore.getState().applyGroups(segmentId, groups.groups);

    expect(outcome.assignedCount).toBe(2);
    expect(outcome.unplacedCount).toBe(2);
    expect(assignedIds(segmentId)).toHaveLength(2);
  });

  it('prefills activity instructions for template layouts', () => {
    const mockTrialId = useLessonStore.getState().addLayoutSegment('mock-trial');
    const mockTrial = useLessonStore.getState().lesson?.segments.find((s) => s.id === mockTrialId);
    expect(mockTrial?.kind).toBe('layout');
    if (mockTrial?.kind === 'layout') {
      expect(mockTrial.instructions).toContain('Jury');
      expect(mockTrial.instructions).toContain('Judge');
    }

    const blankId = useLessonStore.getState().addLayoutSegment('custom');
    const blank = useLessonStore.getState().lesson?.segments.find((s) => s.id === blankId);
    if (blank?.kind === 'layout') expect(blank.instructions).toBe('');
  });

  it('fills blank instructions when applying a template but keeps teacher edits', () => {
    const segmentId = useLessonStore.getState().addLayoutSegment('custom');
    if (!segmentId) throw new Error('layout segment not created');

    useLessonStore.getState().applyTemplateToSegment(segmentId, 'harkness');
    const harkness = useLessonStore.getState().lesson?.segments.find((s) => s.id === segmentId);
    if (harkness?.kind === 'layout') expect(harkness.instructions).toContain('PREPARATION');

    useLessonStore.getState().updateSegment(segmentId, { instructions: 'My own instructions' });
    useLessonStore.getState().applyTemplateToSegment(segmentId, 'debate');
    const debate = useLessonStore.getState().lesson?.segments.find((s) => s.id === segmentId);
    expect(debate?.kind).toBe('layout');
    if (debate?.kind === 'layout') {
      expect(debate.activityType).toBe('debate');
      expect(debate.instructions).toBe('My own instructions');
    }
  });

  it('creates a text segment from a template', () => {
    const id = useLessonStore.getState().addTextSegment('exit-ticket');
    const segment = useLessonStore.getState().lesson?.segments.find((candidate) => candidate.id === id);
    expect(segment?.kind).toBe('text');
    if (segment?.kind === 'text') {
      expect(segment.title).toBe('Exit ticket');
      expect(segment.durationMin).toBe(5);
      expect(JSON.stringify(segment.content)).toContain('confidence');
    }
  });

  it('keeps numbered titles for blank text segments', () => {
    useLessonStore.getState().addTextSegment();
    const segment = useLessonStore.getState().lesson?.segments[0];
    expect(segment?.kind).toBe('text');
    if (segment?.kind === 'text') expect(segment.title).toBe('Text segment 1');
  });

  it('clamps class size to the supported range', () => {
    useLessonStore.getState().setClassSize(0);
    expect(useLessonStore.getState().lesson?.classSize).toBe(1);
    useLessonStore.getState().setClassSize(500);
    expect(useLessonStore.getState().lesson?.classSize).toBe(200);
    useLessonStore.getState().setClassSize(31);
    expect(useLessonStore.getState().lesson?.classSize).toBe(31);
  });

  it('does not resurrect a lesson closed while the write is in flight', async () => {
    const saving = useLessonStore.getState().save();
    useLessonStore.getState().hydrate(null, 'idle');
    releaseSave?.();
    await saving;

    expect(useLessonStore.getState().lesson).toBeNull();
    expect(useLessonStore.getState().status).toBe('idle');
  });
});
