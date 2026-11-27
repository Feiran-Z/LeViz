import { describe, expect, it } from 'vitest';
import { createCanvasNode, createLayoutSegment, createTextSegment } from './lesson';
import { applyTemplate, templateFor } from './templates';
import {
  buildTeachRun,
  defaultRotationEnabled,
  formatCountdown,
  rotationConfig,
  rotationEligibleStops,
  roundLengthMs,
} from './teach';
import type { ActivityType, LayoutSegment } from './types';

function layout(activity: ActivityType): LayoutSegment {
  const segment = createLayoutSegment(activity);
  const template = templateFor(activity);
  if (template) segment.canvas = applyTemplate(segment.canvas, template, 20);
  return segment;
}

describe('buildTeachRun', () => {
  it('lays timed text and layout segments end to end and skips zero', () => {
    const opening = createTextSegment('Opening', null, 5);
    const activity = createLayoutSegment('harkness');
    activity.durationMin = 15;
    const zero = createTextSegment('Note', null, 0);
    const closing = createTextSegment('Closing', null, 10);

    const run = buildTeachRun([opening, activity, zero, closing]);

    expect(run.totalMin).toBe(30);
    expect(
      run.segments.map((span) => [span.segment.id, span.index, span.startMin, span.endMin, span.durationMin]),
    ).toEqual([
      [opening.id, 1, 0, 5, 5],
      [activity.id, 2, 5, 20, 15],
      [closing.id, 3, 20, 30, 10],
    ]);
    expect(run.segments.map((span) => span.segment.kind)).toEqual(['text', 'layout', 'text']);
  });

  it('skips negative and invalid durations', () => {
    const negative = createTextSegment('Negative', null, -5);
    const invalid = createTextSegment('Invalid', null, 10);
    invalid.durationMin = Number.NaN;
    const valid = createTextSegment('Valid', null, 3);

    expect(buildTeachRun([negative, invalid, valid])).toMatchObject({ totalMin: 3 });
    expect(buildTeachRun([negative, invalid, valid]).segments).toHaveLength(1);
  });
});

describe('formatCountdown', () => {
  it('formats seconds, minutes, and hours', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(65_000)).toBe('01:05');
    expect(formatCountdown(599_000)).toBe('09:59');
    expect(formatCountdown(3_600_000)).toBe('1:00:00');
    expect(formatCountdown(-5_000)).toBe('00:00');
    expect(formatCountdown(Number.NaN)).toBe('00:00');
  });
});

describe('rotation stop sets', () => {
  it('uses station pods for station rotation', () => {
    const segment = layout('station-rotation');
    expect(defaultRotationEnabled(segment)).toBe(true);
    expect(rotationConfig(segment, false)).toBeNull();
    const config = rotationConfig(segment, true);
    expect(config?.kind).toBe('station');
    expect(config?.stops).toHaveLength(4);
    expect(rotationEligibleStops(segment)).toHaveLength(4);
  });

  it('uses wall-anchor stops for a gallery walk', () => {
    const segment = layout('gallery-walk');
    expect(defaultRotationEnabled(segment)).toBe(true);
    const config = rotationConfig(segment, true);
    expect(config?.kind).toBe('stop');
    expect(config?.stops).toHaveLength(6);
    expect(config?.stops.every((stop) => stop.type === 'wall-anchor')).toBe(true);
  });

  it('does not auto-rotate group discussion but offers a manual guide', () => {
    const segment = layout('group-discussion');
    expect(defaultRotationEnabled(segment)).toBe(false);
    expect(rotationConfig(segment, false)).toBeNull();
    const config = rotationConfig(segment, true);
    expect(config?.kind).toBe('stop');
    expect(config?.stops).toHaveLength(5);
    expect(config?.stops.every((stop) => stop.type === 'round-table')).toBe(true);
  });

  it('does not rotate Harkness chairs', () => {
    const segment = layout('harkness');
    expect(defaultRotationEnabled(segment)).toBe(false);
    expect(rotationEligibleStops(segment)).toHaveLength(0);
    expect(rotationConfig(segment, true)).toBeNull();
  });

  it('offers two debate teams as a manual guide only', () => {
    const segment = layout('debate');
    expect(defaultRotationEnabled(segment)).toBe(false);
    const config = rotationConfig(segment, true);
    expect(config?.kind).toBe('stop');
    expect(config?.stops).toHaveLength(2);
  });

  it('uses station/table/wall candidates for a custom manual guide, in reading order', () => {
    const segment = createLayoutSegment('custom');
    segment.canvas.nodes = [
      createCanvasNode('station', 300, 100, { label: 'Later', capacity: 3 }),
      createCanvasNode('round-table', 20, 10, { label: 'First', capacity: 3 }),
      createCanvasNode('chair', 40, 40, { label: 'Seat', capacity: 1 }),
    ];

    const config = rotationConfig(segment, true);

    expect(config?.stops.map((stop) => stop.label)).toEqual(['First', 'Later']);
    expect(rotationConfig(segment, false)).toBeNull();
  });

  it('requires at least two stops', () => {
    const segment = createLayoutSegment('custom');
    segment.canvas.nodes = [createCanvasNode('station', 10, 10, { capacity: 3 })];
    expect(rotationConfig(segment, true)).toBeNull();
  });
});

describe('roundLengthMs', () => {
  it('divides the live segment across stops', () => {
    expect(roundLengthMs(15 * 60_000, 4)).toBe(225_000);
    expect(roundLengthMs(0, 4)).toBe(0);
    expect(roundLengthMs(1_000, 1)).toBe(0);
  });
});
