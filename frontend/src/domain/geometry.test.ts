import { describe, expect, it } from 'vitest';
import { createCanvasNode } from './lesson';
import { calculateSnap, hitTestNodes, rectForNode } from './geometry';

describe('calculateSnap', () => {
  it('aligns the left edge to a nearby node edge', () => {
    const result = calculateSnap({ x: 103, y: 200, width: 100, height: 50 }, [
      { x: 100, y: 400, width: 100, height: 50 },
    ]);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
    expect(result.guides).toContainEqual({ orientation: 'vertical', position: 100 });
  });

  it('aligns centers', () => {
    const result = calculateSnap({ x: 180, y: 20, width: 100, height: 50 }, [
      { x: 100, y: 300, width: 260, height: 50 },
    ]);
    // centers: moving 230, other 230
    expect(result.x).toBe(180);
    expect(result.y).toBe(20);
    expect(result.guides).toContainEqual({ orientation: 'vertical', position: 230 });
  });

  it('does not move when nothing is within the threshold', () => {
    const result = calculateSnap({ x: 10, y: 10, width: 50, height: 50 }, [
      { x: 500, y: 500, width: 50, height: 50 },
    ]);
    expect(result).toEqual({ x: 10, y: 10, guides: [] });
  });
});

describe('hitTestNodes', () => {
  it('returns the topmost node under a point', () => {
    const bottom = createCanvasNode('desk', 0, 0, { label: 'bottom' });
    const top = createCanvasNode('desk', 0, 0, { label: 'top' });
    expect(hitTestNodes([bottom, top], { x: 10, y: 10 })?.label).toBe('top');
  });

  it('respects ellipse bounds', () => {
    const circle = createCanvasNode('chair', 100, 100);
    const rect = rectForNode(circle);
    expect(hitTestNodes([circle], { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })).not.toBeNull();
    // Inside the bounding box corner but outside the ellipse.
    expect(hitTestNodes([circle], { x: rect.x + 1, y: rect.y + 1 })).toBeNull();
  });

  it('returns null on empty space', () => {
    expect(hitTestNodes([createCanvasNode('desk', 0, 0)], { x: 900, y: 900 })).toBeNull();
  });
});
