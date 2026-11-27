import { describe, expect, it } from 'vitest';
import { createCanvasNode, createLayoutSegment, createLesson, createTextSegment } from './lesson';
import {
  DEFAULT_ENGAGEMENT,
  changeEngagementLevel,
  createEngagement,
  engagementsEqual,
  normalizeEngagement,
  normalizeLessonEngagement,
  normalizeNodeEngagement,
  resolveNodeEngagement,
  resolveSegmentEngagement,
} from './engagement';

describe('createEngagement', () => {
  it('defaults every dimension to medium', () => {
    expect(createEngagement()).toEqual({ cognitive: 'medium', behavioral: 'medium', affective: 'medium' });
  });

  it('keeps valid overrides', () => {
    expect(createEngagement({ affective: 'high' })).toEqual({
      cognitive: 'medium',
      behavioral: 'medium',
      affective: 'high',
    });
  });
});

describe('changeEngagementLevel', () => {
  it('returns null when the requested level is already set', () => {
    expect(changeEngagementLevel(DEFAULT_ENGAGEMENT, 'cognitive', 'medium')).toBeNull();
  });

  it('returns a new design with only that dimension changed', () => {
    expect(changeEngagementLevel(DEFAULT_ENGAGEMENT, 'affective', 'high')).toEqual({
      cognitive: 'medium',
      behavioral: 'medium',
      affective: 'high',
    });
  });
});

describe('engagementsEqual', () => {
  it('compares every dimension', () => {
    expect(engagementsEqual(DEFAULT_ENGAGEMENT, createEngagement())).toBe(true);
    expect(engagementsEqual(DEFAULT_ENGAGEMENT, createEngagement({ affective: 'high' }))).toBe(false);
  });
});

describe('normalizeNodeEngagement', () => {
  it('treats a malformed override as inherit', () => {
    expect(normalizeNodeEngagement({})).toBeNull();
    expect(normalizeNodeEngagement({ cognitive: 'high' })).toBeNull();
    expect(normalizeNodeEngagement('high')).toBeNull();
  });

  it('keeps a complete override', () => {
    expect(
      normalizeNodeEngagement({ cognitive: 'high', behavioral: 'low', affective: 'medium' }),
    ).toEqual({ cognitive: 'high', behavioral: 'low', affective: 'medium' });
  });
});

describe('normalizeEngagement', () => {
  it('falls back to the default when nothing is stored', () => {
    expect(normalizeEngagement(undefined)).toEqual(DEFAULT_ENGAGEMENT);
    expect(normalizeEngagement(null)).toEqual(DEFAULT_ENGAGEMENT);
  });

  it('keeps valid dimensions and defaults invalid ones', () => {
    expect(normalizeEngagement({ cognitive: 'high', behavioral: 'sometimes', affective: 'low' })).toEqual({
      cognitive: 'high',
      behavioral: 'medium',
      affective: 'low',
    });
  });
});

describe('resolveSegmentEngagement', () => {
  it('reads the design stored on a text segment', () => {
    const segment = createTextSegment('Do Now');
    segment.engagement = { cognitive: 'low', behavioral: 'high', affective: 'medium' };
    expect(resolveSegmentEngagement(segment)).toEqual(segment.engagement);
  });

  it('defaults a segment written before engagement existed', () => {
    const segment = createLayoutSegment('harkness');
    delete (segment as { engagement?: unknown }).engagement;
    expect(resolveSegmentEngagement(segment)).toEqual(DEFAULT_ENGAGEMENT);
  });
});

describe('resolveNodeEngagement', () => {
  it('inherits the activity design when a node has no override', () => {
    const segment = createLayoutSegment('station-rotation');
    segment.engagement = { cognitive: 'low', behavioral: 'high', affective: 'medium' };
    const node = createCanvasNode('station', 0, 0);

    expect(node.engagement).toBeNull();
    expect(resolveNodeEngagement(segment, node)).toEqual(segment.engagement);
  });

  it('uses the node override when the planner sets one', () => {
    const segment = createLayoutSegment('station-rotation');
    const node = createCanvasNode('station', 0, 0, {
      engagement: { cognitive: 'high', behavioral: 'low', affective: 'low' },
    });

    expect(resolveNodeEngagement(segment, node)).toEqual({
      cognitive: 'high',
      behavioral: 'low',
      affective: 'low',
    });
  });

  it('treats an unset override on an older node as inheriting', () => {
    const segment = createLayoutSegment('station-rotation');
    const node = createCanvasNode('station', 0, 0);
    delete (node as { engagement?: unknown }).engagement;

    expect(resolveNodeEngagement(segment, node)).toEqual(segment.engagement);
  });
});

describe('normalizeLessonEngagement', () => {
  it('fills defaults in documents written before engagement existed', () => {
    const lesson = createLesson('Old');
    const text = createTextSegment('Do Now');
    const layout = createLayoutSegment('station-rotation');
    layout.canvas.nodes = [createCanvasNode('station', 0, 0)];
    delete (text as { engagement?: unknown }).engagement;
    delete (layout as { engagement?: unknown }).engagement;
    delete (layout.canvas.nodes[0] as { engagement?: unknown }).engagement;
    lesson.segments = [text, layout];

    const normalized = normalizeLessonEngagement(lesson);
    const normalizedText = normalized.segments[0];
    const normalizedLayout = normalized.segments[1];

    expect(normalizedText?.engagement).toEqual(DEFAULT_ENGAGEMENT);
    if (!normalizedLayout || normalizedLayout.kind !== 'layout') throw new Error('layout missing');
    expect(normalizedLayout.engagement).toEqual(DEFAULT_ENGAGEMENT);
    expect(normalizedLayout.canvas.nodes[0]?.engagement).toBeNull();
  });

  it('keeps current designs and overrides untouched', () => {
    const lesson = createLesson('Current');
    const layout = createLayoutSegment('station-rotation');
    layout.engagement = { cognitive: 'high', behavioral: 'low', affective: 'medium' };
    layout.canvas.nodes = [
      createCanvasNode('station', 0, 0, {
        engagement: { cognitive: 'low', behavioral: 'high', affective: 'high' },
      }),
    ];
    lesson.segments = [createTextSegment('Do Now'), layout];

    expect(normalizeLessonEngagement(lesson)).toEqual(lesson);
  });
});
