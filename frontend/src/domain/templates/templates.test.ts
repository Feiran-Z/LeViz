import { describe, expect, it } from 'vitest';
import { createCanvasNode } from '../lesson';
import { ACTIVITY_TYPES, type ActivityType } from '../types';
import { applyTemplate, instantiateTemplate, templateFor } from './index';

function get(id: ActivityType) {
  const template = templateFor(id);
  if (!template) throw new Error(`Missing template: ${id}`);
  return template;
}

function seatCapacity(nodes: { capacity: number }[]): number {
  return nodes.reduce((sum, node) => sum + node.capacity, 0);
}

describe('class-size-aware templates', () => {
  it('builds one Harkness chair per student', () => {
    const nodes = instantiateTemplate(get('harkness'), 20);
    expect(nodes.filter((node) => node.type === 'chair')).toHaveLength(20);
    expect(nodes.filter((node) => node.type === 'teacher')).toHaveLength(1);
    expect(seatCapacity(nodes)).toBe(20);
  });

  it('splits debate teams across the class', () => {
    const nodes = instantiateTemplate(get('debate'), 21);
    const stations = nodes.filter((node) => node.type === 'station');
    expect(stations.map((node) => node.capacity)).toEqual([11, 10]);
    expect(seatCapacity(stations)).toBe(21);
    // The speaking position is not a seat and must not absorb a group.
    expect(nodes.find((node) => node.type === 'podium')?.capacity).toBe(0);
  });

  it('sizes station rotation to cover the class', () => {
    const nodes = instantiateTemplate(get('station-rotation'), 26);
    expect(nodes.filter((node) => node.type === 'station')).toHaveLength(4);
    expect(seatCapacity(nodes)).toBe(28);
    expect(seatCapacity(nodes)).toBeGreaterThanOrEqual(26);
  });

  it('no longer offers a free-for-all template — the blank canvas covers it', () => {
    expect(templateFor('free-for-all')).toBeUndefined();
  });

  it('has a template for every activity the picker offers', () => {
    for (const activity of ACTIVITY_TYPES) {
      expect(templateFor(activity), activity).toBeDefined();
    }
  });

  it('clamps absurd class sizes instead of drawing off-canvas', () => {
    expect(instantiateTemplate(get('harkness'), 5000).filter((node) => node.type === 'chair')).toHaveLength(32);
    expect(instantiateTemplate(get('harkness'), 0).filter((node) => node.type === 'chair')).toHaveLength(6);
  });

  it('merges without touching existing nodes and their notes', () => {
    const existing = createCanvasNode('desk', 10, 10, {
      note: { title: 'Keep me', body: 'And me' },
      assignedStudentIds: ['student-1'],
    });
    const merged = applyTemplate(
      { width: 1000, height: 700, nodes: [existing] },
      get('harkness'),
      12,
    );
    expect(merged.nodes[0]).toBe(existing);
    expect(merged.nodes[0]?.note?.title).toBe('Keep me');
    expect(merged.nodes).toHaveLength(1 + 12 + 1);
  });
});
