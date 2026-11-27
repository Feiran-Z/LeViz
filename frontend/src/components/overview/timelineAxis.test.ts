import { describe, expect, it } from 'vitest';
import { axisTicks } from './timelineAxis';

describe('axisTicks', () => {
  it('drops a regular tick that would collide with the final label', () => {
    expect(axisTicks(31)).toEqual([0, 10, 20, 31]);
    expect(axisTicks(61)).toEqual([0, 15, 30, 45, 61]);
    expect(axisTicks(121)).toEqual([0, 30, 60, 90, 121]);
    expect(axisTicks(181)).toEqual([0, 45, 90, 135, 181]);
  });

  it('keeps a regular tick that has room before the final label', () => {
    expect(axisTicks(35)).toEqual([0, 10, 20, 30, 35]);
    expect(axisTicks(30)).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });

  it('handles short lessons', () => {
    expect(axisTicks(5)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
