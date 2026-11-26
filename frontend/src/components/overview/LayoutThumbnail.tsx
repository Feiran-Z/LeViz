import { useId } from 'react';
import { NODE_TYPE_INFO, type CanvasNode, type CanvasState } from '../../domain/types';

function shortLabel(node: CanvasNode): string {
  const seat = /^Seat (\d+)$/.exec(node.label);
  if (seat) return seat[1] ?? node.label;
  return node.label;
}

function ThumbnailNode({ node }: { node: CanvasNode }) {
  const info = NODE_TYPE_INFO[node.type];
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const transform = node.rotation
    ? `rotate(${node.rotation} ${centerX} ${centerY})`
    : undefined;
  const fill = node.type === 'station' ? 'var(--station-fill)' : 'var(--node-fill)';
  const stroke = node.type === 'wall-anchor' ? 'var(--accent-primary)' : 'var(--node-stroke)';
  const assigned = node.assignedStudentIds.length;
  const hasNote = Boolean(node.note && (node.note.title.trim() || node.note.body.trim()));
  const compact = node.width < 80 || node.height < 72;
  const label = shortLabel(node);

  return (
    <g transform={transform}>
      {info.shape === 'ellipse' ? (
        <ellipse
          cx={centerX}
          cy={centerY}
          rx={node.width / 2}
          ry={node.height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
        />
      ) : (
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={node.type === 'wall-anchor' ? 2 : 6}
          fill={node.type === 'wall-anchor' ? 'transparent' : fill}
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray={node.type === 'wall-anchor' ? '7 5' : undefined}
        />
      )}

      <text
        x={centerX}
        y={centerY + (compact ? 4 : 5)}
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize={compact ? 14 : 16}
        fill="var(--node-label)"
      >
        {label}
      </text>

      {hasNote ? <circle cx={node.x + node.width - 10} cy={node.y + 10} r={4} fill="var(--accent-primary)" /> : null}

      {assigned > 0 ? (
        <g>
          <circle cx={node.x + node.width - 10} cy={node.y + node.height - 10} r={11} fill="var(--accent-primary)" />
          <text
            x={node.x + node.width - 10}
            y={node.y + node.height - 6}
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
            fontSize={11}
            fontWeight={600}
            fill="var(--text-inverse)"
          >
            {assigned}
          </text>
        </g>
      ) : null}
    </g>
  );
}

/** Read-only schematic of a layout segment, sized to its logical canvas. */
export function LayoutThumbnail({ canvas }: { canvas: CanvasState }) {
  const patternId = `grid-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <svg
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      className="h-auto w-full rounded-sm border border-default"
      role="img"
      aria-label={`Room layout with ${canvas.nodes.length} nodes`}
    >
      <defs>
        <pattern id={patternId} width={40} height={40} patternUnits="userSpaceOnUse">
          <circle cx={20} cy={20} r={1.4} fill="var(--border-strong)" />
        </pattern>
      </defs>
      <rect width={canvas.width} height={canvas.height} fill="var(--bg-canvas)" />
      <rect width={canvas.width} height={canvas.height} fill={`url(#${patternId})`} />
      {canvas.nodes.map((node) => (
        <ThumbnailNode key={node.id} node={node} />
      ))}
    </svg>
  );
}
