/**
 * Konva cannot read CSS variables through its scene graph, so the canvas
 * palette is mirrored here from design.md §2.5. Keep both in sync.
 */
export interface CanvasTokens {
  background: string;
  paperBorder: string;
  shadow: string;
  grid: string;
  nodeFill: string;
  nodeStroke: string;
  nodeLabel: string;
  stationFill: string;
  chipFill: string;
  chipText: string;
  accent: string;
  warning: string;
  guide: string;
  windowTint: string;
}

const LIGHT: CanvasTokens = {
  background: '#e8e2d5',
  paperBorder: '#cfc7b8',
  shadow: 'rgba(63, 58, 52, 0.22)',
  grid: '#d8d1c3',
  nodeFill: '#f4f2ed',
  nodeStroke: '#d6d1c7',
  nodeLabel: '#3f3a34',
  stationFill: '#edebe4',
  chipFill: '#e8e5de',
  chipText: '#3f3a34',
  accent: '#5b6e5a',
  warning: '#9c7a4a',
  guide: 'rgba(176, 169, 157, 0.6)',
  windowTint: 'rgba(91, 110, 90, 0.12)',
};

const DARK: CanvasTokens = {
  background: '#241f18',
  paperBorder: '#3b342b',
  shadow: 'rgba(0, 0, 0, 0.55)',
  grid: '#2f2a22',
  nodeFill: '#2c2824',
  nodeStroke: '#4a443d',
  nodeLabel: '#e8e2d9',
  stationFill: '#302c27',
  chipFill: '#35302b',
  chipText: '#e8e2d9',
  accent: '#8fa68d',
  warning: '#c4a06a',
  guide: 'rgba(107, 100, 91, 0.6)',
  windowTint: 'rgba(143, 166, 141, 0.16)',
};

export function canvasTokens(theme: 'light' | 'dark'): CanvasTokens {
  return theme === 'dark' ? DARK : LIGHT;
}
