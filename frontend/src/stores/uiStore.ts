import { create } from 'zustand';
import type { SnapGuide } from '../domain/geometry';
import type { GroupingMode, GroupingResult } from '../domain/grouping';

export type RightTab = 'roster' | 'groups' | 'node';
export type ViewMode = 'edit' | 'overview';
export type ThemePreference = 'light' | 'dark' | 'system';
export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface GroupPreview {
  segmentId: string;
  result: GroupingResult;
  mode: GroupingMode;
  groupCount: number;
}

interface UiState {
  activeSegmentId: string | null;
  selectedNodeId: string | null;
  viewMode: ViewMode;
  rightTab: RightTab;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  zoom: number;
  panX: number;
  panY: number;
  snapGuides: SnapGuide[];
  noteNodeId: string | null;
  themePreference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  toasts: Toast[];
  groupCountOverride: number | null;
  groupPreview: GroupPreview | null;

  setActiveSegment: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  selectNode: (id: string | null) => void;
  setRightTab: (tab: RightTab) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setZoom: (zoom: number) => void;
  zoomBy: (factor: number) => void;
  setPan: (x: number, y: number) => void;
  resetViewport: () => void;
  setSnapGuides: (guides: SnapGuide[]) => void;
  openNoteEditor: (nodeId: string | null) => void;
  setThemePreference: (preference: ThemePreference) => void;
  setResolvedTheme: (theme: 'light' | 'dark') => void;
  setGroupCountOverride: (count: number | null) => void;
  setGroupPreview: (preview: GroupPreview | null) => void;
  notify: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: string) => void;
  resetForLesson: () => void;
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
let toastCounter = 0;

function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem('leviz-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Private mode or blocked storage: fall through to the default.
  }
  return 'system';
}

function initialResolvedTheme(): 'light' | 'dark' {
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // Ignore.
  }
  return 'light';
}

export const useUiStore = create<UiState>()((set, get) => ({
  activeSegmentId: null,
  selectedNodeId: null,
  viewMode: 'edit',
  rightTab: 'roster',
  leftCollapsed: false,
  rightCollapsed: false,
  zoom: 1,
  panX: 0,
  panY: 0,
  snapGuides: [],
  noteNodeId: null,
  themePreference: readThemePreference(),
  resolvedTheme: initialResolvedTheme(),
  toasts: [],
  groupCountOverride: null,
  groupPreview: null,

  setActiveSegment: (id) =>
    set({ activeSegmentId: id, selectedNodeId: null, noteNodeId: null, snapGuides: [] }),
  setViewMode: (viewMode) => set({ viewMode }),
  selectNode: (id) =>
    set((state) => ({
      selectedNodeId: id,
      // Selecting furniture must not yank the teacher out of a Groups preview.
      rightTab: id && state.rightTab !== 'groups' ? 'node' : state.rightTab,
    })),
  setRightTab: (rightTab) => set({ rightTab }),
  toggleLeftPanel: () => set((state) => ({ leftCollapsed: !state.leftCollapsed })),
  toggleRightPanel: () => set((state) => ({ rightCollapsed: !state.rightCollapsed })),
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomBy: (factor) => set((state) => ({ zoom: clampZoom(state.zoom * factor) })),
  setPan: (x, y) => set({ panX: x, panY: y }),
  resetViewport: () => set({ zoom: 1, panX: 0, panY: 0 }),
  setSnapGuides: (snapGuides) => set({ snapGuides }),
  openNoteEditor: (noteNodeId) => set({ noteNodeId }),
  setThemePreference: (themePreference) => {
    try {
      localStorage.setItem('leviz-theme', themePreference);
    } catch {
      // Ignore storage failures; the preference still applies this session.
    }
    set({ themePreference });
  },
  setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
  setGroupCountOverride: (groupCountOverride) => set({ groupCountOverride }),
  setGroupPreview: (groupPreview) => set({ groupPreview }),

  notify: (message, tone = 'info') => {
    toastCounter += 1;
    const id = `toast-${toastCounter}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    window.setTimeout(() => {
      if (get().toasts.some((toast) => toast.id === id)) {
        set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
      }
    }, 4200);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  resetForLesson: () =>
    set((state) => ({
      activeSegmentId: null,
      selectedNodeId: null,
      viewMode: 'edit',
      noteNodeId: null,
      snapGuides: [],
      zoom: 1,
      panX: 0,
      panY: 0,
      groupCountOverride: null,
      groupPreview: null,
      // Keep panel layout and theme: they are workspace preferences.
      leftCollapsed: state.leftCollapsed,
      rightCollapsed: state.rightCollapsed,
      rightTab: state.rightTab,
    })),
}));
