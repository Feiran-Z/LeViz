import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ENGAGEMENT_DIMENSION_LABELS,
  ENGAGEMENT_DIMENSIONS,
  ENGAGEMENT_LEVEL_LABELS,
} from '../../domain/engagement';
import { buildEngagementTimeline } from '../../domain/engagementTimeline';
import type { EngagementDimension, EngagementLevel, Segment } from '../../domain/types';

/**
 * Designed-engagement timeline for the read-only overview. Three stepped lines
 * share a Low/Medium/High axis. Lines are dodged a few pixels inside a level so
 * three series sitting at the same level stay visible instead of overdrawing.
 *
 * Activity line only: a layout segment's station overrides are listed in the
 * segment's "Station engagement" block below, not folded into this chart.
 */

const WIDTH = 720;
const HEIGHT = 220;
const PLOT_LEFT = 56;
const PLOT_RIGHT = 702;
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 164;
const RIBBON_Y = 188;
const RIBBON_HEIGHT = 12;

const LEVEL_Y: Record<EngagementLevel, number> = { high: 30, medium: 88, low: 146 };

const SERIES_COLOR: Record<EngagementDimension, string> = {
  cognitive: 'var(--series-cognitive)',
  behavioral: 'var(--series-behavioral)',
  affective: 'var(--series-affective)',
};

/** Secondary encoding: identity survives even when color is unavailable. */
const SERIES_DASH: Record<EngagementDimension, string | undefined> = {
  cognitive: undefined,
  behavioral: '7 4',
  affective: '1.5 3.5',
};

const SERIES_DODGE: Record<EngagementDimension, number> = {
  cognitive: -5,
  behavioral: 0,
  affective: 5,
};

function axisTicks(totalMin: number): number[] {
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
  ticks.push(totalMin);
  return ticks;
}

function formatTick(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function shortTitle(title: string, max = 26): string {
  const clean = title.trim() || 'Untitled segment';
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function EngagementTimelineChart({ segments }: { segments: Segment[] }) {
  const { spans, totalMin } = buildEngagementTimeline(segments);
  const [hover, setHover] = useState<{ spanIndex: number; x: number } | null>(null);

  const xAt = (minute: number) =>
    PLOT_LEFT + (totalMin > 0 ? (Math.min(minute, totalMin) / totalMin) * PLOT_WIDTH : 0);

  const yAt = (span: (typeof spans)[number], dimension: EngagementDimension) =>
    LEVEL_Y[span.engagement[dimension]] + SERIES_DODGE[dimension];

  const stepPath = (dimension: EngagementDimension): string => {
    const first = spans[0];
    if (!first) return '';
    let path = `M ${xAt(first.startMin)} ${yAt(first, dimension)}`;
    for (let index = 1; index < spans.length; index += 1) {
      const span = spans[index];
      const previous = spans[index - 1];
      if (!span || !previous) continue;
      path += ` L ${xAt(span.startMin)} ${yAt(previous, dimension)} L ${xAt(span.startMin)} ${yAt(span, dimension)}`;
    }
    const last = spans[spans.length - 1];
    if (last) path += ` L ${xAt(last.endMin)} ${yAt(last, dimension)}`;
    return path;
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const x = Math.min(PLOT_RIGHT, Math.max(PLOT_LEFT, svgX));
    const time = totalMin > 0 ? ((x - PLOT_LEFT) / PLOT_WIDTH) * totalMin : 0;
    let spanIndex = spans.findIndex((span) => time >= span.startMin && time < span.endMin);
    if (spanIndex < 0) spanIndex = spans.length - 1;
    if (spanIndex >= 0) setHover({ spanIndex, x });
  };

  const hoveredSpan = hover ? spans[hover.spanIndex] : undefined;
  const tooltipWidth = 178;
  const tooltipHeight = 82;

  const ariaLabel =
    totalMin > 0
      ? `Designed engagement timeline from 0 to ${formatTick(totalMin)} planned minutes. ${ENGAGEMENT_DIMENSIONS.map(
          (dimension) =>
            `${ENGAGEMENT_DIMENSION_LABELS[dimension]}: ${spans
              .map(
                (span) =>
                  `${formatTick(span.startMin)} to ${formatTick(span.endMin)} minutes ${ENGAGEMENT_LEVEL_LABELS[
                    span.engagement[dimension]
                  ].toLowerCase()}`,
              )
              .join(', ')}`,
        ).join('. ')}`
      : 'Designed engagement timeline. Add time to a segment to plot it.';

  return (
    <section className="card mt-6 p-4" aria-labelledby="engagement-timeline-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="engagement-timeline-heading" className="section-label">
          Designed engagement over time
        </h2>
        <p className="text-[11px] text-secondary">
          {totalMin > 0
            ? `0–${formatTick(totalMin)} planned min · activity level`
            : 'No planned time yet'}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-secondary">
        {ENGAGEMENT_DIMENSIONS.map((dimension) => (
          <span key={dimension} className="inline-flex items-center gap-1.5">
            <svg width={18} height={8} aria-hidden="true" className="shrink-0">
              <line
                x1={0}
                y1={4}
                x2={18}
                y2={4}
                style={{
                  stroke: SERIES_COLOR[dimension],
                  strokeDasharray: SERIES_DASH[dimension],
                  strokeLinecap: 'round',
                }}
                strokeWidth={2}
              />
            </svg>
            {ENGAGEMENT_DIMENSION_LABELS[dimension]}
          </span>
        ))}
        <span className="text-[10px] text-placeholder">
          Steps change at segment boundaries · stations listed below
        </span>
      </div>

      {spans.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-strong px-4 py-6 text-center text-xs text-secondary">
          Add time to a segment to see how the lesson&rsquo;s designed engagement changes.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={ariaLabel}
          className="mt-2 h-auto w-full select-none"
        >
          {/* Level gridlines and labels */}
          {(Object.keys(LEVEL_Y) as EngagementLevel[]).map((level) => (
            <g key={level}>
              <line
                x1={PLOT_LEFT}
                y1={LEVEL_Y[level]}
                x2={PLOT_RIGHT}
                y2={LEVEL_Y[level]}
                style={{ stroke: 'var(--border-default)' }}
                strokeWidth={1}
              />
              <text
                x={PLOT_LEFT - 8}
                y={LEVEL_Y[level] + 3.5}
                textAnchor="end"
                fontSize={10}
                fontFamily="Inter, sans-serif"
                style={{ fill: 'var(--text-secondary)' }}
              >
                {ENGAGEMENT_LEVEL_LABELS[level]}
              </text>
            </g>
          ))}

          {/* Segment boundaries */}
          {spans.slice(1).map((span) => (
            <line
              key={`boundary-${span.segmentId}`}
              x1={xAt(span.startMin)}
              y1={PLOT_TOP}
              x2={xAt(span.startMin)}
              y2={PLOT_BOTTOM}
              style={{ stroke: 'var(--border-default)' }}
              strokeWidth={1}
              opacity={0.55}
            />
          ))}

          {/* Series */}
          {ENGAGEMENT_DIMENSIONS.map((dimension) => (
            <g key={dimension}>
              <path
                d={stepPath(dimension)}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{
                  stroke: SERIES_COLOR[dimension],
                  strokeDasharray: SERIES_DASH[dimension],
                }}
              />
              {spans.map((span, index) => {
                const previous = spans[index - 1];
                if (previous && previous.engagement[dimension] === span.engagement[dimension]) return null;
                return (
                  <circle
                    key={`dot-${span.segmentId}`}
                    cx={xAt(span.startMin)}
                    cy={yAt(span, dimension)}
                    r={2.6}
                    style={{
                      fill: SERIES_COLOR[dimension],
                      stroke: 'var(--bg-surface)',
                    }}
                    strokeWidth={1.6}
                  />
                );
              })}
            </g>
          ))}

          {/* X-axis ticks */}
          {axisTicks(totalMin).map((tick) => {
            const isLast = tick === totalMin;
            return (
              <text
                key={`tick-${tick}`}
                x={isLast ? PLOT_RIGHT : xAt(tick)}
                y={PLOT_BOTTOM + 16}
                textAnchor={isLast ? 'end' : 'middle'}
                fontSize={10}
                fontFamily="Inter, sans-serif"
                style={{ fill: 'var(--text-secondary)' }}
              >
                {isLast ? `${formatTick(tick)} min` : formatTick(tick)}
              </text>
            );
          })}

          {/* Segment ribbon: ties each span to the numbered list below */}
          {spans.map((span) => {
            const start = xAt(span.startMin);
            const end = xAt(span.endMin);
            const blockWidth = Math.max(0, end - start - 2);
            const hovered = hover?.spanIndex === spans.indexOf(span);
            return (
              <g key={`ribbon-${span.segmentId}`}>
                <rect
                  x={start + 1}
                  y={RIBBON_Y}
                  width={blockWidth}
                  height={RIBBON_HEIGHT}
                  rx={2}
                  style={{
                    fill: hovered ? 'var(--accent-primary)' : 'var(--bg-page)',
                    opacity: hovered ? 0.22 : 1,
                  }}
                >
                  <title>
                    {`${span.segmentIndex}. ${span.title} · ${formatTick(span.startMin)}–${formatTick(span.endMin)} min`}
                  </title>
                </rect>
                {blockWidth >= 12 ? (
                  <text
                    x={(start + end) / 2}
                    y={RIBBON_Y + 8.8}
                    textAnchor="middle"
                    fontSize={8.5}
                    fontFamily="Inter, sans-serif"
                    style={{ fill: 'var(--text-secondary)' }}
                  >
                    {span.segmentIndex}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* Hover crosshair + readout */}
          {hover && hoveredSpan ? (
            <g pointerEvents="none">
              <line
                x1={hover.x}
                y1={PLOT_TOP}
                x2={hover.x}
                y2={PLOT_BOTTOM}
                style={{ stroke: 'var(--text-placeholder)' }}
                strokeWidth={1}
                opacity={0.6}
              />
              {(() => {
                let tx = hover.x + 10;
                if (tx + tooltipWidth > PLOT_RIGHT) tx = hover.x - tooltipWidth - 10;
                tx = Math.max(PLOT_LEFT, Math.min(tx, PLOT_RIGHT - tooltipWidth));
                const ty = PLOT_TOP + 4;
                return (
                  <g>
                    <rect
                      x={tx}
                      y={ty}
                      width={tooltipWidth}
                      height={tooltipHeight}
                      rx={4}
                      style={{ fill: 'var(--bg-elevated)', stroke: 'var(--border-default)' }}
                      strokeWidth={1}
                    />
                    <text
                      x={tx + 9}
                      y={ty + 15}
                      fontSize={10}
                      fontFamily="Inter, sans-serif"
                      fontWeight={600}
                      style={{ fill: 'var(--text-primary)' }}
                    >
                      {shortTitle(hoveredSpan.title)}
                    </text>
                    <text
                      x={tx + 9}
                      y={ty + 28}
                      fontSize={9}
                      fontFamily="Inter, sans-serif"
                      style={{ fill: 'var(--text-secondary)' }}
                    >
                      {formatTick(hoveredSpan.startMin)}–{formatTick(hoveredSpan.endMin)} min
                    </text>
                    {ENGAGEMENT_DIMENSIONS.map((dimension, row) => {
                      const rowY = ty + 45 + row * 12;
                      return (
                        <g key={dimension}>
                          <line
                            x1={tx + 9}
                            y1={rowY - 3}
                            x2={tx + 21}
                            y2={rowY - 3}
                            style={{
                              stroke: SERIES_COLOR[dimension],
                              strokeDasharray: SERIES_DASH[dimension],
                              strokeLinecap: 'round',
                            }}
                            strokeWidth={2}
                          />
                          <text
                            x={tx + 26}
                            y={rowY}
                            fontSize={9}
                            fontFamily="Inter, sans-serif"
                            style={{ fill: 'var(--text-secondary)' }}
                          >
                            {ENGAGEMENT_DIMENSION_LABELS[dimension]}
                          </text>
                          <text
                            x={tx + tooltipWidth - 9}
                            y={rowY}
                            fontSize={9}
                            fontFamily="Inter, sans-serif"
                            textAnchor="end"
                            style={{ fill: 'var(--text-primary)' }}
                          >
                            {ENGAGEMENT_LEVEL_LABELS[hoveredSpan.engagement[dimension]]}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })()}
            </g>
          ) : null}

          {/* Pointer target for the crosshair */}
          <rect
            x={PLOT_LEFT}
            y={PLOT_TOP}
            width={PLOT_WIDTH}
            height={PLOT_BOTTOM - PLOT_TOP}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}

      {spans.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-secondary">Data table</summary>
          <table className="mt-2 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-default text-left text-secondary">
                <th className="py-1 pr-2 font-medium">Segment</th>
                <th className="py-1 pr-2 font-medium">Minutes</th>
                {ENGAGEMENT_DIMENSIONS.map((dimension) => (
                  <th key={dimension} className="py-1 pr-2 font-medium">
                    {ENGAGEMENT_DIMENSION_LABELS[dimension]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spans.map((span) => (
                <tr key={span.segmentId} className="border-b border-default last:border-b-0">
                  <td className="py-1 pr-2 text-primary">
                    {span.segmentIndex}. {span.title || 'Untitled segment'}
                  </td>
                  <td className="py-1 pr-2 tabular text-secondary">
                    {formatTick(span.startMin)}–{formatTick(span.endMin)}
                  </td>
                  {ENGAGEMENT_DIMENSIONS.map((dimension) => (
                    <td key={dimension} className="py-1 pr-2 text-primary">
                      {ENGAGEMENT_LEVEL_LABELS[span.engagement[dimension]]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </section>
  );
}
