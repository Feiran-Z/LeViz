import { NODE_TYPE_INFO, type CanvasNode } from './types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface SnapGuide {
  orientation: 'vertical' | 'horizontal';
  position: number;
}

export interface SnapBounds {
  width: number;
  height: number;
}

export interface SnapOptions {
  /** Maximum movement in world units that a snap may apply. */
  threshold?: number;
  /** Room dimensions. When supplied, the room edges also act as snap lines. */
  bounds?: SnapBounds;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

interface SpacingSnap {
  delta: number;
  /** Equal gap after the snap. */
  gap: number;
  near: number;
  far: number;
}

export function rectForNode(node: CanvasNode): Rect {
  return { x: node.x, y: node.y, width: node.width, height: node.height };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function verticalLines(rect: Rect): number[] {
  return [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
}

function horizontalLines(rect: Rect): number[] {
  return [rect.y, rect.y + rect.height / 2, rect.y + rect.height];
}

function overlapsVertically(a: Rect, b: Rect): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

function overlapsHorizontally(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width;
}

function bestAlignmentDelta(
  movingLines: number[],
  targetLines: number[],
  threshold: number,
): number | null {
  let best: number | null = null;
  for (const movingLine of movingLines) {
    for (const targetLine of targetLines) {
      const delta = targetLine - movingLine;
      if (Math.abs(delta) <= threshold && (best === null || Math.abs(delta) < Math.abs(best))) {
        best = delta;
      }
    }
  }
  return best;
}

/**
 * Equalise the gap to the nearest furniture (or room wall) on each side.
 * Requires at least one piece of furniture in the same row so a lone node is
 * not pulled to the middle of the room.
 */
function horizontalSpacingSnap(
  moving: Rect,
  others: Rect[],
  bounds: SnapBounds,
  threshold: number,
): SpacingSnap | null {
  let near = 0;
  let far = bounds.width;
  let hasFurniture = false;

  for (const other of others) {
    if (!overlapsVertically(moving, other)) continue;
    const otherRight = other.x + other.width;
    if (otherRight <= moving.x && otherRight >= near) {
      near = otherRight;
      hasFurniture = true;
    }
    const otherLeft = other.x;
    if (otherLeft >= moving.x + moving.width && otherLeft <= far) {
      far = otherLeft;
      hasFurniture = true;
    }
  }

  if (!hasFurniture) return null;
  const gapNear = moving.x - near;
  const gapFar = far - (moving.x + moving.width);
  if (gapNear < 0 || gapFar < 0) return null;

  const delta = (gapFar - gapNear) / 2;
  if (Math.abs(delta) > threshold) return null;
  return { delta, gap: (gapNear + gapFar) / 2, near, far };
}

function verticalSpacingSnap(
  moving: Rect,
  others: Rect[],
  bounds: SnapBounds,
  threshold: number,
): SpacingSnap | null {
  let near = 0;
  let far = bounds.height;
  let hasFurniture = false;

  for (const other of others) {
    if (!overlapsHorizontally(moving, other)) continue;
    const otherBottom = other.y + other.height;
    if (otherBottom <= moving.y && otherBottom >= near) {
      near = otherBottom;
      hasFurniture = true;
    }
    const otherTop = other.y;
    if (otherTop >= moving.y + moving.height && otherTop <= far) {
      far = otherTop;
      hasFurniture = true;
    }
  }

  if (!hasFurniture) return null;
  const gapNear = moving.y - near;
  const gapFar = far - (moving.y + moving.height);
  if (gapNear < 0 || gapFar < 0) return null;

  const delta = (gapFar - gapNear) / 2;
  if (Math.abs(delta) > threshold) return null;
  return { delta, gap: (gapNear + gapFar) / 2, near, far };
}

/**
 * Pure snap calculator. Given a dragged rect, every other rect, and the room
 * bounds, returns the adjusted position and the guide lines to draw.
 *
 * Snaps to: other furniture (edges and centers), the room's edges, and
 * positions that make the gap to the nearest furniture on each side equal.
 * No Konva import.
 */
export function calculateSnap(
  moving: Rect,
  others: Rect[],
  options: SnapOptions = {},
): SnapResult {
  const threshold = options.threshold ?? 8;
  const bounds = options.bounds;

  const targetV: number[] = others.flatMap(verticalLines);
  const targetH: number[] = others.flatMap(horizontalLines);
  if (bounds) {
    targetV.push(0, bounds.width);
    targetH.push(0, bounds.height);
  }

  const alignX = bestAlignmentDelta(verticalLines(moving), targetV, threshold);
  const alignY = bestAlignmentDelta(horizontalLines(moving), targetH, threshold);
  const spacingX = bounds ? horizontalSpacingSnap(moving, others, bounds, threshold) : null;
  const spacingY = bounds ? verticalSpacingSnap(moving, others, bounds, threshold) : null;

  let dx = 0;
  let dy = 0;
  let useSpacingX = false;
  let useSpacingY = false;

  if (alignX !== null && (spacingX === null || Math.abs(alignX) <= Math.abs(spacingX.delta))) {
    dx = alignX;
  } else if (spacingX) {
    dx = spacingX.delta;
    useSpacingX = true;
  }

  if (alignY !== null && (spacingY === null || Math.abs(alignY) <= Math.abs(spacingY.delta))) {
    dy = alignY;
  } else if (spacingY) {
    dy = spacingY.delta;
    useSpacingY = true;
  }

  const snapped: Rect = {
    x: moving.x + dx,
    y: moving.y + dy,
    width: moving.width,
    height: moving.height,
  };

  const guides: SnapGuide[] = [];
  const seen = new Set<string>();
  const addGuide = (orientation: 'vertical' | 'horizontal', position: number) => {
    const key = `${orientation}:${position}`;
    if (seen.has(key)) return;
    seen.add(key);
    guides.push({ orientation, position });
  };

  if (useSpacingX && spacingX) {
    addGuide('vertical', spacingX.near + spacingX.gap / 2);
    addGuide('vertical', spacingX.far - spacingX.gap / 2);
  } else {
    for (const movingLine of verticalLines(snapped)) {
      for (const targetLine of targetV) {
        if (Math.abs(movingLine - targetLine) < 0.5) addGuide('vertical', targetLine);
      }
    }
  }

  if (useSpacingY && spacingY) {
    addGuide('horizontal', spacingY.near + spacingY.gap / 2);
    addGuide('horizontal', spacingY.far - spacingY.gap / 2);
  } else {
    for (const movingLine of horizontalLines(snapped)) {
      for (const targetLine of targetH) {
        if (Math.abs(movingLine - targetLine) < 0.5) addGuide('horizontal', targetLine);
      }
    }
  }

  return { x: round(snapped.x), y: round(snapped.y), guides };
}

function pointInNode(point: Point, node: CanvasNode): boolean {
  const info = NODE_TYPE_INFO[node.type];
  if (info.shape === 'ellipse') {
    const rx = node.width / 2;
    const ry = node.height / 2;
    if (rx <= 0 || ry <= 0) return false;
    const dx = (point.x - (node.x + rx)) / rx;
    const dy = (point.y - (node.y + ry)) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return (
    point.x >= node.x &&
    point.x <= node.x + node.width &&
    point.y >= node.y &&
    point.y <= node.y + node.height
  );
}

/** Topmost node containing the point (later nodes paint on top). */
export function hitTestNodes(nodes: CanvasNode[], point: Point): CanvasNode | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (node && pointInNode(point, node)) return node;
  }
  return null;
}
