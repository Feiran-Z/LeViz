import { describe, expect, it } from 'vitest';
import { createEngagement } from './engagement';
import { createCanvasNode, createLayoutSegment } from './lesson';
import { buildPrintMaterials } from './printMaterials';
import type { ActivityType, CanvasNode, LayoutSegment, Student } from './types';

function students(...names: string[]): Student[] {
  return names.map((name, index) => ({
    id: `s${index + 1}`,
    name,
    tags: [],
    notWith: [],
    togetherWith: [],
  }));
}

function layout(nodes: CanvasNode[], activityType: ActivityType = 'station-rotation'): LayoutSegment {
  const segment = createLayoutSegment(activityType);
  return {
    ...segment,
    title: 'Station rotation',
    engagement: createEngagement({ cognitive: 'high', behavioral: 'medium', affective: 'low' }),
    canvas: { ...segment.canvas, nodes },
  };
}

describe('buildPrintMaterials', () => {
  it('builds cards in reading order and seats with named groups', () => {
    const roster = students('Ada', 'Grace', 'Alan', 'Katherine', 'Dorothy');
    const nodes = [
      createCanvasNode('station', 0, 0, {
        label: 'Station A',
        assignedStudentIds: ['s1', 's2'],
        note: { title: 'Prompt', body: 'Discuss.' },
      }),
      createCanvasNode('station', 0, 200, { label: 'Station B', assignedStudentIds: ['s3'] }),
      createCanvasNode('round-table', 300, 0, { label: 'Table 1' }),
      createCanvasNode('teacher', 500, 0, {
        label: 'Teacher',
        note: { title: 'Teacher', body: 'Not a card' },
      }),
      createCanvasNode('chair', 600, 0, {
        label: 'Witness',
        assignedStudentIds: ['s4'],
        note: { title: 'Witness', body: 'Answer' },
      }),
      createCanvasNode('chair', 700, 0, { label: 'Seat 1', assignedStudentIds: ['s5'] }),
    ];
    const materials = buildPrintMaterials(layout(nodes), roster);

    expect(materials.cards.map((card) => card.node.label)).toEqual([
      'Station A',
      'Table 1',
      'Witness',
      'Station B',
    ]);
    expect(materials.cards[0]?.groupNames).toEqual(['Ada', 'Grace']);
    expect(materials.cards[2]?.groupNames).toEqual(['Katherine']);
    expect(materials.seats.map((row) => row.node.label)).toEqual([
      'Station A',
      'Table 1',
      'Witness',
      'Seat 1',
      'Station B',
    ]);
    expect(materials.activityEngagement).toEqual({
      cognitive: 'high',
      behavioral: 'medium',
      affective: 'low',
    });
  });

  it('lets a station override engagement and inherits otherwise', () => {
    const nodes = [
      createCanvasNode('station', 0, 0, {
        label: 'Station A',
        engagement: { cognitive: 'low', behavioral: 'high', affective: 'low' },
      }),
      createCanvasNode('station', 0, 200, { label: 'Station B' }),
    ];
    const materials = buildPrintMaterials(layout(nodes), []);

    expect(materials.cards[0]?.engagement).toEqual({
      cognitive: 'low',
      behavioral: 'high',
      affective: 'low',
    });
    expect(materials.cards[1]?.engagement).toEqual({
      cognitive: 'high',
      behavioral: 'medium',
      affective: 'low',
    });
  });

  it('does not turn every assigned chair into a card', () => {
    const roster = students(...Array.from({ length: 12 }, (_, index) => `Student ${index + 1}`));
    const nodes = roster.map((student, index) =>
      createCanvasNode('chair', index * 50, 0, {
        label: `Seat ${index + 1}`,
        assignedStudentIds: [student.id],
        ...(index === 0 ? { note: { title: 'Hot seat', body: 'Lead the opening.' } } : {}),
      }),
    );
    const materials = buildPrintMaterials(layout(nodes, 'harkness'), roster);

    expect(materials.cards.map((card) => card.node.label)).toEqual(['Seat 1']);
    expect(materials.seats).toHaveLength(12);
  });

  it('prints annotated wall stops and podiums but not bare ones', () => {
    const nodes = [
      createCanvasNode('wall-anchor', 0, 0, {
        label: 'Annotated stop',
        note: { title: 'Stop', body: 'Look closely.' },
      }),
      createCanvasNode('wall-anchor', 200, 0, { label: 'Bare stop' }),
      createCanvasNode('podium', 400, 0, {
        label: 'Judge',
        note: { title: 'Role', body: 'Rule on objections.' },
      }),
      createCanvasNode('podium', 500, 0, { label: 'Bare podium' }),
    ];
    const materials = buildPrintMaterials(layout(nodes, 'gallery-walk'), []);

    expect(materials.cards.map((card) => card.node.label)).toEqual(['Annotated stop', 'Judge']);
    // A podium holds one student, so both podiums appear on the seating sheet
    // even though the bare one has no card.
    expect(materials.seats).toHaveLength(2);
  });

  it('handles an empty layout', () => {
    const materials = buildPrintMaterials(layout([]), []);

    expect(materials.cards).toEqual([]);
    expect(materials.seats).toEqual([]);
    expect(materials.activityEngagement).toEqual({
      cognitive: 'high',
      behavioral: 'medium',
      affective: 'low',
    });
  });

  it('names a missing student as Unknown', () => {
    const node = createCanvasNode('station', 0, 0, {
      label: 'Station A',
      assignedStudentIds: ['missing'],
    });
    const materials = buildPrintMaterials(layout([node]), []);

    expect(materials.cards[0]?.groupNames).toEqual(['Unknown']);
  });
});
