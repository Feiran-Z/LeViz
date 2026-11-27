import { describe, expect, it } from 'vitest';
import { createCanvasNode, createLayoutSegment, createLesson, createTextSegment } from './lesson';
import { buildEngagementTimeline } from './engagementTimeline';

describe('buildEngagementTimeline', () => {
  it('lays segments end to end from minute zero', () => {
    const warmup = createTextSegment('Do Now', null, 5);
    const activity = createLayoutSegment('harkness');
    activity.durationMin = 20;
    const exit = createTextSegment('Exit ticket', null, 10);

    const timeline = buildEngagementTimeline([warmup, activity, exit]);

    expect(timeline.totalMin).toBe(35);
    expect(timeline.spans.map((span) => [span.segmentIndex, span.startMin, span.endMin])).toEqual([
      [1, 0, 5],
      [2, 5, 25],
      [3, 25, 35],
    ]);
  });

  it('carries each segment design and title onto its span', () => {
    const activity = createLayoutSegment('station-rotation');
    activity.durationMin = 15;
    activity.engagement = { cognitive: 'high', behavioral: 'low', affective: 'medium' };

    const [span] = buildEngagementTimeline([activity]).spans;

    expect(span?.title).toBe('Layout segment');
    expect(span?.kind).toBe('layout');
    expect(span?.engagement).toEqual({ cognitive: 'high', behavioral: 'low', affective: 'medium' });
  });

  it('uses the segment design, not station overrides (activity line only)', () => {
    const activity = createLayoutSegment('station-rotation');
    activity.durationMin = 15;
    activity.engagement = { cognitive: 'medium', behavioral: 'medium', affective: 'medium' };
    activity.canvas.nodes = [
      createCanvasNode('station', 0, 0, {
        engagement: { cognitive: 'high', behavioral: 'high', affective: 'high' },
      }),
    ];

    const [span] = buildEngagementTimeline([activity]).spans;

    expect(span?.engagement).toEqual({ cognitive: 'medium', behavioral: 'medium', affective: 'medium' });
  });

  it('fills defaults for segments written before designed engagement existed', () => {
    const segment = createTextSegment('Do Now');
    delete (segment as { engagement?: unknown }).engagement;

    const [span] = buildEngagementTimeline([segment]).spans;

    expect(span?.engagement).toEqual({ cognitive: 'medium', behavioral: 'medium', affective: 'medium' });
  });

  it('skips zero-minute segments but keeps their position in the lesson', () => {
    const first = createTextSegment('First', null, 0);
    const second = createTextSegment('Second', null, 10);
    const third = createTextSegment('Third', null, 0);

    const timeline = buildEngagementTimeline([first, second, third]);

    expect(timeline.totalMin).toBe(10);
    expect(timeline.spans).toHaveLength(1);
    expect(timeline.spans[0]?.segmentIndex).toBe(2);
    expect(timeline.spans[0]?.startMin).toBe(0);
    expect(timeline.spans[0]?.endMin).toBe(10);
  });

  it('returns an empty timeline for a lesson with no segments', () => {
    expect(buildEngagementTimeline([])).toEqual({ spans: [], totalMin: 0 });
  });

  it('treats invalid durations as zero', () => {
    const lesson = createLesson('Bad durations');
    const segment = createTextSegment('Broken', null, 10);
    segment.durationMin = Number.NaN;
    lesson.segments = [segment];

    expect(buildEngagementTimeline(lesson.segments)).toEqual({ spans: [], totalMin: 0 });
  });
});
