/**
 * Minute ticks for the engagement timeline. Labels are few and round, and the
 * last regular tick is dropped when it would collide with the final "N min"
 * label — otherwise a 31-minute lesson prints "30" under "31 min".
 */
export function axisTicks(totalMin: number): number[] {
  const step =
    totalMin <= 8
      ? 1
      : totalMin <= 16
        ? 2
        : totalMin <= 30
          ? 5
          : totalMin <= 60
            ? 10
            : totalMin <= 120
              ? 15
              : totalMin <= 180
                ? 30
                : totalMin <= 300
                  ? 45
                  : 60;

  const ticks: number[] = [];
  for (let tick = 0; tick < totalMin; tick += step) ticks.push(tick);

  const last = ticks[ticks.length - 1];
  if (last !== undefined && totalMin - last < step / 2) ticks.pop();
  ticks.push(totalMin);
  return ticks;
}

export function formatTick(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
