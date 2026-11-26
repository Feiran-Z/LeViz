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

describe('room bounds', () => {
  const bounds = { width: 1000, height: 700 };

  it('snaps to the left and right walls', () => {
    const left = calculateSnap({ x: 4, y: 100, width: 100, height: 50 }, [], { bounds });
    expect(left.x).toBe(0);
    expect(left.guides).toContainEqual({ orientation: 'vertical', position: 0 });

    const right = calculateSnap({ x: 897, y: 100, width: 100, height: 50 }, [], { bounds });
    expect(right.x).toBe(900);
    expect(right.guides).toContainEqual({ orientation: 'vertical', position: 1000 });
  });

  it('snaps to the top and bottom walls', () => {
    const top = calculateSnap({ x: 100, y: 3, width: 100, height: 50 }, [], { bounds });
    expect(top.y).toBe(0);

    const bottom = calculateSnap({ x: 100, y: 652, width: 100, height: 50 }, [], { bounds });
    expect(bottom.y).toBe(650);
  });
});

describe('equidistance', () => {
  const bounds = { width: 1000, height: 700 };

  it('centers between two side-by-side nodes', () => {
    const leftNode = { x: 0, y: 100, width: 100, height: 50 };
    const rightNode = { x: 300, y: 100, width: 100, height: 50 };
    const result = calculateSnap({ x: 153, y: 100, width: 100, height: 50 }, [leftNode, rightNode], {
      bounds,
    });
    expect(result.x).toBe(150);
    expect(result.guides).toEqual(
      expect.arrayContaining([
        { orientation: 'vertical', position: 125 },
        { orientation: 'vertical', position: 275 },
      ]),
    );
  });

  it('balances a furniture edge against the room wall', () => {
    const rightNode = { x: 300, y: 100, width: 100, height: 50 };
    const result = calculateSnap({ x: 97, y: 100, width: 100, height: 50 }, [rightNode], { bounds });
    expect(result.x).toBe(100);
    expect(result.guides).toEqual(
      expect.arrayContaining([
        { orientation: 'vertical', position: 50 },
        { orientation: 'vertical', position: 250 },
      ]),
    );
  });

  it('centers vertically between stacked nodes', () => {
    const topNode = { x: 100, y: 0, width: 120, height: 100 };
    const bottomNode = { x: 100, y: 300, width: 120, height: 100 };
    const result = calculateSnap({ x: 100, y: 153, width: 120, height: 100 }, [topNode, bottomNode], {
      bounds,
    });
    expect(result.y).toBe(150);
  });

  it('does not equalise across different rows', () => {
    const leftNode = { x: 0, y: 0, width: 100, height: 50 };
    const rightNode = { x: 300, y: 300, width: 100, height: 50 };
    const result = calculateSnap({ x: 153, y: 120, width: 100, height: 50 }, [leftNode, rightNode], {
      bounds,
    });
    expect(result.x).toBe(153);
  });

  it('does not pull a lone node to the middle of the room', () => {
    const result = calculateSnap({ x: 447, y: 100, width: 100, height: 50 }, [], { bounds });
    expect(result.x).toBe(447);
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
