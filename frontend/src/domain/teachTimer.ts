import {
  defaultRotationEnabled,
  rotationConfig,
  roundLengthMs,
  type RotationConfig,
  type TeachRun,
  type TeachSegment,
} from './teach';
import type { Segment } from './types';

/**
 * L1 — the teach clock. Remaining time is always derived from `endsAt`; the
 * state never decrements a counter on a timer tick.
 */

export interface TeachTimerState {
  segmentIndex: number;
  remainingMs: number;
  running: boolean;
  endsAt: number | null;
  completed: boolean;
  addedMs: number;
  stopIndex: number;
  stopStartElapsedMs: number;
  rotationEnabled: boolean;
  soundOn: boolean;
}

export type TeachTimerAction =
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'reset' }
  | { type: 'add'; ms: number }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'nextStop'; now: number }
  | { type: 'setRotation'; enabled: boolean }
  | { type: 'setSound'; enabled: boolean }
  | { type: 'restart' };

function plannedMs(segment: TeachSegment): number {
  return segment.durationMin * 60_000;
}

function defaultRotationFor(segment: Segment | undefined): boolean {
  return segment?.kind === 'layout' ? defaultRotationEnabled(segment) : false;
}

export function currentTeachSegment(state: TeachTimerState, run: TeachRun): TeachSegment | undefined {
  return run.segments[state.segmentIndex];
}

export function createTeachTimerState(
  run: TeachRun,
  options: { soundOn?: boolean } = {},
): TeachTimerState {
  const first = run.segments[0];
  return {
    segmentIndex: 0,
    remainingMs: first ? plannedMs(first) : 0,
    running: false,
    endsAt: null,
    completed: false,
    addedMs: 0,
    stopIndex: 0,
    stopStartElapsedMs: 0,
    rotationEnabled: defaultRotationFor(first?.segment),
    soundOn: options.soundOn ?? false,
  };
}

export function liveDurationMs(state: TeachTimerState, run: TeachRun): number {
  const segment = currentTeachSegment(state, run);
  return segment ? plannedMs(segment) + state.addedMs : 0;
}

export function segmentElapsedMs(state: TeachTimerState, run: TeachRun): number {
  const live = liveDurationMs(state, run);
  return Math.min(live, Math.max(0, live - state.remainingMs));
}

export function rotationRemainingMs(
  state: TeachTimerState,
  run: TeachRun,
  config: RotationConfig | null,
): number {
  if (!config) return 0;
  const live = liveDurationMs(state, run);
  const round = roundLengthMs(live, config.stops.length);
  if (round <= 0) return 0;
  return Math.max(0, round - (segmentElapsedMs(state, run) - state.stopStartElapsedMs));
}

export function plannedEndAt(now: number, state: TeachTimerState, run: TeachRun): number {
  const later = run.segments
    .slice(state.segmentIndex + 1)
    .reduce((sum, segment) => sum + plannedMs(segment), 0);
  return now + state.remainingMs + later;
}

function remainingAt(state: TeachTimerState, now: number): number {
  if (!state.running || state.endsAt === null) return state.remainingMs;
  return Math.max(0, state.endsAt - now);
}

export function reduceTeachTimer(
  state: TeachTimerState,
  action: TeachTimerAction,
  run: TeachRun,
): TeachTimerState {
  const segment = currentTeachSegment(state, run);

  switch (action.type) {
    case 'start': {
      if (!segment || state.running || state.completed || state.remainingMs <= 0) return state;
      return { ...state, running: true, endsAt: action.now + state.remainingMs };
    }

    case 'pause': {
      if (!state.running) return state;
      const remaining = remainingAt(state, action.now);
      return { ...state, remainingMs: remaining, running: false, endsAt: null, completed: remaining === 0 };
    }

    case 'tick': {
      if (!state.running || state.endsAt === null) return state;
      const remaining = Math.max(0, state.endsAt - action.now);
      if (remaining === 0) {
        return { ...state, remainingMs: 0, running: false, endsAt: null, completed: true };
      }
      return { ...state, remainingMs: remaining };
    }

    case 'reset': {
      if (!segment) return state;
      return {
        ...state,
        remainingMs: plannedMs(segment),
        addedMs: 0,
        running: false,
        endsAt: null,
        completed: false,
        stopIndex: 0,
        stopStartElapsedMs: 0,
      };
    }

    case 'add': {
      if (!Number.isFinite(action.ms) || action.ms <= 0) return state;
      return {
        ...state,
        remainingMs: state.remainingMs + action.ms,
        addedMs: state.addedMs + action.ms,
        endsAt: state.endsAt === null ? null : state.endsAt + action.ms,
        completed: false,
      };
    }

    case 'next':
    case 'previous': {
      const targetIndex = action.type === 'next' ? state.segmentIndex + 1 : state.segmentIndex - 1;
      const target = run.segments[targetIndex];
      if (!target) return state;
      return {
        ...state,
        segmentIndex: targetIndex,
        remainingMs: plannedMs(target),
        running: false,
        endsAt: null,
        completed: false,
        addedMs: 0,
        stopIndex: 0,
        stopStartElapsedMs: 0,
        rotationEnabled: defaultRotationFor(target.segment),
      };
    }

    case 'nextStop': {
      if (!segment || segment.segment.kind !== 'layout' || !state.rotationEnabled) return state;
      const config = rotationConfig(segment.segment, true);
      if (!config || state.stopIndex >= config.stops.length - 1) return state;
      const remaining = remainingAt(state, action.now);
      const elapsed = Math.max(0, liveDurationMs(state, run) - remaining);
      const running = remaining > 0 && state.running;
      return {
        ...state,
        remainingMs: remaining,
        running,
        endsAt: running ? state.endsAt : null,
        completed: remaining === 0 ? true : state.completed,
        stopIndex: state.stopIndex + 1,
        stopStartElapsedMs: elapsed,
      };
    }

    case 'setRotation': {
      if (!action.enabled) {
        return { ...state, rotationEnabled: false, stopIndex: 0, stopStartElapsedMs: 0 };
      }
      if (!segment || segment.segment.kind !== 'layout') {
        return { ...state, rotationEnabled: false };
      }
      const config = rotationConfig(segment.segment, true);
      if (!config) return { ...state, rotationEnabled: false };
      const live = liveDurationMs(state, run);
      const round = roundLengthMs(live, config.stops.length);
      const elapsed = segmentElapsedMs(state, run);
      const stopIndex = round > 0 ? Math.min(Math.floor(elapsed / round), config.stops.length - 1) : 0;
      return { ...state, rotationEnabled: true, stopIndex, stopStartElapsedMs: stopIndex * round };
    }

    case 'setSound':
      return { ...state, soundOn: action.enabled };

    case 'restart':
      return createTeachTimerState(run, { soundOn: state.soundOn });

    default:
      return state;
  }
}
