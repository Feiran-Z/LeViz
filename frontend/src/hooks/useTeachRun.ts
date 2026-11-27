import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  defaultRotationEnabled,
  rotationConfig,
  type RotationConfig,
  type TeachRun,
  type TeachSegment,
} from '../domain/teach';
import {
  createTeachTimerState,
  currentTeachSegment,
  liveDurationMs,
  plannedEndAt,
  reduceTeachTimer,
  rotationRemainingMs,
  segmentElapsedMs,
  type TeachTimerState,
} from '../domain/teachTimer';
import { playChime, primeChime } from '../lib/chime';

const SESSION_PREFIX = 'leviz-teach:';
const SOUND_KEY = 'leviz-teach-sound';

export interface TeachRunActions {
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  addMinute: () => void;
  next: () => void;
  previous: () => void;
  nextStop: () => void;
  restart: () => void;
  setRotation: (enabled: boolean) => void;
  setSound: (enabled: boolean) => void;
  clearSession: () => void;
}

export interface UseTeachRunResult {
  state: TeachTimerState;
  segment: TeachSegment | null;
  rotation: RotationConfig | null;
  rotationRemainingMs: number;
  elapsedMs: number;
  liveDurationMs: number;
  plannedEndAt: number;
  actions: TeachRunActions;
}

function sessionKey(lessonId: string): string {
  return `${SESSION_PREFIX}${lessonId}`;
}

export function clearTeachSession(lessonId: string): void {
  try {
    sessionStorage.removeItem(sessionKey(lessonId));
  } catch {
    // Storage may be blocked; the run still works in memory.
  }
}

function readSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSoundOn(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore blocked storage.
  }
}

function readInitial(run: TeachRun, lessonId: string): TeachTimerState {
  const base = createTeachTimerState(run, { soundOn: readSoundOn() });
  try {
    const raw = sessionStorage.getItem(sessionKey(lessonId));
    if (!raw) return base;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    const segmentIndex = run.segments.findIndex((span) => span.segment.id === saved['segmentId']);
    if (segmentIndex < 0) return base;

    const target = run.segments[segmentIndex]!;
    const rawAdded = saved['addedMs'];
    const addedMs =
      typeof rawAdded === 'number' && Number.isFinite(rawAdded) ? Math.max(0, rawAdded) : 0;
    const live = target.durationMin * 60_000 + addedMs;
    const rawRemaining = saved['remainingMs'];
    const remainingMs =
      typeof rawRemaining === 'number' && Number.isFinite(rawRemaining)
        ? Math.min(live, Math.max(0, rawRemaining))
        : live;

    const layout = target.segment.kind === 'layout' ? target.segment : null;
    const rotationEnabled = layout
      ? typeof saved['rotationEnabled'] === 'boolean'
        ? saved['rotationEnabled']
        : defaultRotationEnabled(layout)
      : false;
    const config = layout ? rotationConfig(layout, rotationEnabled) : null;
    const stopCount = config?.stops.length ?? 0;
    const rawStopIndex = saved['stopIndex'];
    const stopIndex =
      stopCount > 0 && typeof rawStopIndex === 'number' && Number.isFinite(rawStopIndex)
        ? Math.min(stopCount - 1, Math.max(0, Math.floor(rawStopIndex)))
        : 0;
    const rawStopStart = saved['stopStartElapsedMs'];
    const stopStartElapsedMs =
      stopCount > 0 && typeof rawStopStart === 'number' && Number.isFinite(rawStopStart)
        ? Math.min(live, Math.max(0, rawStopStart))
        : 0;

    return {
      ...base,
      segmentIndex,
      remainingMs,
      addedMs,
      rotationEnabled,
      stopIndex,
      stopStartElapsedMs,
      completed: remainingMs === 0,
      running: false,
      endsAt: null,
    };
  } catch {
    return base;
  }
}

/**
 * The teach clock and its session persistence. The hook owns the interval and
 * the save/restore behavior; the page owns layout and navigation.
 */
export function useTeachRun({
  lessonId,
  run,
}: {
  lessonId: string;
  run: TeachRun;
}): UseTeachRunResult {
  const [state, dispatch] = useReducer(
    (current: TeachTimerState, action: Parameters<typeof reduceTeachTimer>[1]) =>
      reduceTeachTimer(current, action, run),
    undefined,
    () => readInitial(run, lessonId),
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!state.running) return undefined;
    const id = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 250);
    return () => window.clearInterval(id);
  }, [state.running]);

  const persist = useCallback(
    (value: TeachTimerState) => {
      const segment = currentTeachSegment(value, run);
      if (!segment) return;
      const remaining =
        value.running && value.endsAt !== null
          ? Math.max(0, value.endsAt - Date.now())
          : value.remainingMs;
      try {
        sessionStorage.setItem(
          sessionKey(lessonId),
          JSON.stringify({
            segmentId: segment.segment.id,
            remainingMs: remaining,
            addedMs: value.addedMs,
            stopIndex: value.stopIndex,
            stopStartElapsedMs: value.stopStartElapsedMs,
            rotationEnabled: value.rotationEnabled,
          }),
        );
      } catch {
        // Storage may be blocked; the run still works in memory.
      }
    },
    [lessonId, run],
  );

  useEffect(() => {
    persist(state);
  }, [
    persist,
    state.segmentIndex,
    state.running,
    state.completed,
    state.stopIndex,
    state.stopStartElapsedMs,
    state.rotationEnabled,
    state.addedMs,
    state.soundOn,
  ]);

  useEffect(() => {
    const onHide = () => persist(stateRef.current);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persist(stateRef.current);
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [persist]);

  const wasCompleted = useRef(state.completed);
  useEffect(() => {
    if (state.completed && !wasCompleted.current && state.soundOn) playChime();
    wasCompleted.current = state.completed;
  }, [state.completed, state.soundOn]);

  const actions = useMemo<TeachRunActions>(
    () => ({
      start: () => {
        primeChime();
        dispatch({ type: 'start', now: Date.now() });
      },
      pause: () => dispatch({ type: 'pause', now: Date.now() }),
      toggle: () => {
        if (!stateRef.current.running) primeChime();
        dispatch({
          type: stateRef.current.running ? 'pause' : 'start',
          now: Date.now(),
        });
      },
      reset: () => dispatch({ type: 'reset' }),
      addMinute: () => dispatch({ type: 'add', ms: 60_000 }),
      next: () => dispatch({ type: 'next' }),
      previous: () => dispatch({ type: 'previous' }),
      nextStop: () => dispatch({ type: 'nextStop', now: Date.now() }),
      restart: () => dispatch({ type: 'restart' }),
      setRotation: (enabled) => dispatch({ type: 'setRotation', enabled }),
      setSound: (enabled) => {
        if (enabled) primeChime();
        writeSoundOn(enabled);
        dispatch({ type: 'setSound', enabled });
      },
      clearSession: () => clearTeachSession(lessonId),
    }),
    [dispatch, lessonId],
  );

  const segment = currentTeachSegment(state, run) ?? null;
  const layout = segment?.segment.kind === 'layout' ? segment.segment : null;
  const rotation = layout ? rotationConfig(layout, state.rotationEnabled) : null;

  return {
    state,
    segment,
    rotation,
    rotationRemainingMs: rotationRemainingMs(state, run, rotation),
    elapsedMs: segmentElapsedMs(state, run),
    liveDurationMs: liveDurationMs(state, run),
    plannedEndAt: plannedEndAt(Date.now(), state, run),
    actions,
  };
}
