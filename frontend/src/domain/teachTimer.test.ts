import { describe, expect, it } from 'vitest';
import { createLayoutSegment, createTextSegment } from './lesson';
import { applyTemplate, templateFor } from './templates';
import { buildTeachRun, rotationConfig } from './teach';
import {
  createTeachTimerState,
  liveDurationMs,
  plannedEndAt,
  reduceTeachTimer,
  rotationRemainingMs,
  segmentElapsedMs,
} from './teachTimer';

function textRun(durations: number[]) {
  return buildTeachRun(durations.map((duration, index) => createTextSegment(`Segment ${index + 1}`, null, duration)));
}

function stationRun() {
  const segment = createLayoutSegment('station-rotation');
  segment.durationMin = 10;
  const template = templateFor('station-rotation');
  if (template) segment.canvas = applyTemplate(segment.canvas, template, 20);
  const run = buildTeachRun([segment]);
  return { segment, run };
}

describe('teach timer', () => {
  it('starts paused at the first segment and computes the planned end', () => {
    const run = textRun([1, 2]);
    const state = createTeachTimerState(run);

    expect(state).toMatchObject({
      segmentIndex: 0,
      remainingMs: 60_000,
      running: false,
      completed: false,
      addedMs: 0,
      rotationEnabled: false,
    });
    expect(segmentElapsedMs(state, run)).toBe(0);
    expect(plannedEndAt(0, state, run)).toBe(180_000);
  });

  it('derives ticks from timestamps and completes at zero', () => {
    const run = textRun([1, 2]);
    let state = createTeachTimerState(run);

    state = reduceTeachTimer(state, { type: 'start', now: 1_000 }, run);
    expect(state.running).toBe(true);
    expect(state.endsAt).toBe(61_000);

    state = reduceTeachTimer(state, { type: 'tick', now: 31_000 }, run);
    expect(state.remainingMs).toBe(30_000);
    expect(segmentElapsedMs(state, run)).toBe(30_000);

    state = reduceTeachTimer(state, { type: 'tick', now: 61_000 }, run);
    expect(state.remainingMs).toBe(0);
    expect(state.running).toBe(false);
    expect(state.completed).toBe(true);
    expect(state.endsAt).toBeNull();
  });

  it('pauses with the computed remaining time', () => {
    const run = textRun([1]);
    let state = createTeachTimerState(run);
    state = reduceTeachTimer(state, { type: 'start', now: 1_000 }, run);
    state = reduceTeachTimer(state, { type: 'pause', now: 31_000 }, run);

    expect(state.running).toBe(false);
    expect(state.remainingMs).toBe(30_000);
    expect(state.endsAt).toBeNull();
    expect(reduceTeachTimer(state, { type: 'tick', now: 99_000 }, run)).toEqual(state);
  });

  it('adds time paused, running, and at time-up', () => {
    const run = textRun([1]);
    let state = createTeachTimerState(run);
    state = reduceTeachTimer(state, { type: 'add', ms: 60_000 }, run);
    expect(state.remainingMs).toBe(120_000);
    expect(state.addedMs).toBe(60_000);

    state = reduceTeachTimer(state, { type: 'start', now: 1_000 }, run);
    expect(state.endsAt).toBe(121_000);
    state = reduceTeachTimer(state, { type: 'add', ms: 60_000 }, run);
    expect(state.remainingMs).toBe(180_000);
    expect(state.addedMs).toBe(120_000);
    expect(state.endsAt).toBe(181_000);

    let done = reduceTeachTimer(createTeachTimerState(run), { type: 'tick', now: 0 }, run);
    done = { ...done, remainingMs: 0, completed: true, running: false, endsAt: null };
    done = reduceTeachTimer(done, { type: 'add', ms: 60_000 }, run);
    expect(done.completed).toBe(false);
    expect(done.remainingMs).toBe(60_000);
  });

  it('resets additions and navigation pauses at the target', () => {
    const run = textRun([1, 2]);
    let state = createTeachTimerState(run);
    state = reduceTeachTimer(state, { type: 'add', ms: 30_000 }, run);
    state = reduceTeachTimer(state, { type: 'start', now: 0 }, run);
    state = reduceTeachTimer(state, { type: 'reset' }, run);
    expect(state.remainingMs).toBe(60_000);
    expect(state.addedMs).toBe(0);
    expect(state.running).toBe(false);

    state = reduceTeachTimer(state, { type: 'next' }, run);
    expect(state).toMatchObject({ segmentIndex: 1, remainingMs: 120_000, running: false });
    state = reduceTeachTimer(state, { type: 'next' }, run);
    expect(state.segmentIndex).toBe(1);
    state = reduceTeachTimer(state, { type: 'previous' }, run);
    expect(state.segmentIndex).toBe(0);
    expect(reduceTeachTimer(state, { type: 'previous' }, run).segmentIndex).toBe(0);
  });

  it('enables default rotation when moving into a rotation layout', () => {
    const text = createTextSegment('Opening', null, 1);
    const layout = createLayoutSegment('station-rotation');
    layout.durationMin = 10;
    const template = templateFor('station-rotation');
    if (template) layout.canvas = applyTemplate(layout.canvas, template, 20);
    const run = buildTeachRun([text, layout]);

    const next = reduceTeachTimer(createTeachTimerState(run), { type: 'next' }, run);
    expect(next.rotationEnabled).toBe(true);
  });

  it('drives station stops from the segment elapsed time', () => {
    const { segment, run } = stationRun();
    const config = rotationConfig(segment, true);
    let state = createTeachTimerState(run);

    expect(state.rotationEnabled).toBe(true);
    expect(rotationRemainingMs(state, run, config)).toBe(150_000);

    state = reduceTeachTimer(state, { type: 'start', now: 0 }, run);
    state = reduceTeachTimer(state, { type: 'tick', now: 40_000 }, run);
    state = reduceTeachTimer(state, { type: 'nextStop', now: 40_000 }, run);
    expect(state.stopIndex).toBe(1);
    expect(state.stopStartElapsedMs).toBe(40_000);
    expect(rotationRemainingMs(state, run, config)).toBe(150_000);

    const last = { ...state, stopIndex: 3, stopStartElapsedMs: 450_000, remainingMs: 100_000 };
    expect(reduceTeachTimer(last, { type: 'nextStop', now: 500_000 }, run)).toEqual(last);
  });

  it('enables rotation at the current round and recomputes rounds after adding time', () => {
    const { segment, run } = stationRun();
    let state = createTeachTimerState(run);
    state = reduceTeachTimer(state, { type: 'start', now: 0 }, run);
    state = reduceTeachTimer(state, { type: 'tick', now: 200_000 }, run);

    state = reduceTeachTimer({ ...state, rotationEnabled: false, stopIndex: 0, stopStartElapsedMs: 0 }, { type: 'setRotation', enabled: false }, run);
    expect(state.rotationEnabled).toBe(false);
    expect(rotationRemainingMs(state, run, rotationConfig(segment, false))).toBe(0);

    state = reduceTeachTimer(state, { type: 'setRotation', enabled: true }, run);
    expect(state.rotationEnabled).toBe(true);
    expect(state.stopIndex).toBe(1);
    expect(state.stopStartElapsedMs).toBe(150_000);

    state = reduceTeachTimer(state, { type: 'add', ms: 60_000 }, run);
    expect(liveDurationMs(state, run)).toBe(660_000);
    expect(rotationRemainingMs(state, run, rotationConfig(segment, true))).toBe(115_000);
    expect(liveDurationMs(state, run)).toBe(660_000);
  });

  it('reports sound preference', () => {
    expect(createTeachTimerState(textRun([1]), { soundOn: true }).soundOn).toBe(true);
    expect(reduceTeachTimer(createTeachTimerState(textRun([1])), { type: 'setSound', enabled: true }, textRun([1])).soundOn).toBe(true);
  });
});
