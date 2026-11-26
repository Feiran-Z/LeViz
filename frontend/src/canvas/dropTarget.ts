export interface CanvasDropResolution {
  segmentId: string;
  nodeId: string;
}

type Resolver = (clientX: number, clientY: number) => CanvasDropResolution | null;

let resolver: Resolver | null = null;

/** Registered by the mounted CanvasEditor so dnd-kit drops can hit-test Konva nodes. */
export function registerCanvasDropResolver(next: Resolver | null): void {
  resolver = next;
}

export function resolveCanvasDrop(clientX: number, clientY: number): CanvasDropResolution | null {
  return resolver ? resolver(clientX, clientY) : null;
}
