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

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
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

/**
 * Pure snap calculator. Given a dragged rect and every other rect, returns the
 * adjusted position and the guide lines that should be drawn. No Konva import.
 */
export function calculateSnap(moving: Rect, others: Rect[], threshold = 8): SnapResult {
  let bestDx = Number.POSITIVE_INFINITY;
  let bestDy = Number.POSITIVE_INFINITY;
  const movingV = verticalLines(moving);
  const movingH = horizontalLines(moving);

  for (const other of others) {
    for (const movingLine of movingV) {
      for (const otherLine of verticalLines(other)) {
        const delta = otherLine - movingLine;
        if (Math.abs(delta) <= threshold && Math.abs(delta) < Math.abs(bestDx)) bestDx = delta;
      }
    }
    for (const movingLine of movingH) {
      for (const otherLine of horizontalLines(other)) {
        const delta = otherLine - movingLine;
        if (Math.abs(delta) <= threshold && Math.abs(delta) < Math.abs(bestDy)) bestDy = delta;
      }
    }
  }

  const snapped: Rect = {
    x: Number.isFinite(bestDx) ? moving.x + bestDx : moving.x,
    y: Number.isFinite(bestDy) ? moving.y + bestDy : moving.y,
    width: moving.width,
    height: moving.height,
  };

  const guides: SnapGuide[] = [];
  const seen = new Set<string>();
  for (const other of others) {
    for (const movingLine of verticalLines(snapped)) {
      for (const otherLine of verticalLines(other)) {
        if (Math.abs(movingLine - otherLine) < 0.5) {
          const key = `v:${otherLine}`;
          if (!seen.has(key)) {
            seen.add(key);
            guides.push({ orientation: 'vertical', position: otherLine });
          }
        }
      }
    }
    for (const movingLine of horizontalLines(snapped)) {
      for (const otherLine of horizontalLines(other)) {
        if (Math.abs(movingLine - otherLine) < 0.5) {
          const key = `h:${otherLine}`;
          if (!seen.has(key)) {
            seen.add(key);
            guides.push({ orientation: 'horizontal', position: otherLine });
          }
        }
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
