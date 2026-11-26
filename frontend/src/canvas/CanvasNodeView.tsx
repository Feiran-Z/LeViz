import { memo, useEffect, useRef } from 'react';
import type Konva from 'konva';
import { Circle, Ellipse, Group, Rect, Text, Transformer } from 'react-konva';
import { calculateSnap, rectForNode } from '../domain/geometry';
import { NODE_TYPE_INFO, type CanvasNode } from '../domain/types';
import { initials } from '../lib/format';
import { useLessonStore } from '../stores/lessonStore';
import { useRosterStore } from '../stores/rosterStore';
import { useUiStore } from '../stores/uiStore';
import type { CanvasTokens } from './tokens';

function nodesOfSegment(segmentId: string): CanvasNode[] {
  const lesson = useLessonStore.getState().lesson;
  if (!lesson) return [];
  const segment = lesson.segments.find((candidate) => candidate.id === segmentId);
  return segment && segment.kind === 'layout' ? segment.canvas.nodes : [];
}

interface CanvasNodeViewProps {
  segmentId: string;
  nodeId: string;
  selected: boolean;
  tokens: CanvasTokens;
  canvasWidth: number;
  canvasHeight: number;
}

export const CanvasNodeView = memo(function CanvasNodeView({
  segmentId,
  nodeId,
  selected,
  tokens,
  canvasWidth,
  canvasHeight,
}: CanvasNodeViewProps) {
  const node = useLessonStore((state) => {
    const lesson = state.lesson;
    if (!lesson) return null;
    const segment = lesson.segments.find((candidate) => candidate.id === segmentId);
    if (!segment || segment.kind !== 'layout') return null;
    return segment.canvas.nodes.find((candidate) => candidate.id === nodeId) ?? null;
  });
  const students = useRosterStore((state) => state.students);
  const selectNode = useUiStore((state) => state.selectNode);
  const openNoteEditor = useUiStore((state) => state.openNoteEditor);
  const setSnapGuides = useUiStore((state) => state.setSnapGuides);
  const setNodeHover = useUiStore((state) => state.setNodeHover);
  const updateNode = useLessonStore((state) => state.updateNode);

  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const hoverPoint = useRef<{ x: number; y: number } | null>(null);
  const hoverVisible = useRef(false);

  useEffect(
    () => () => {
      if (hoverTimer.current !== undefined) window.clearTimeout(hoverTimer.current);
      if (useUiStore.getState().nodeHover?.nodeId === nodeId) {
        useUiStore.getState().setNodeHover(null);
      }
    },
    [nodeId],
  );

  useEffect(() => {
    const transformer = transformerRef.current;
    const group = groupRef.current;
    if (selected && transformer && group) {
      transformer.nodes([group]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selected, node]);

  if (!node) return null;

  const info = NODE_TYPE_INFO[node.type];
  const assigned = node.assignedStudentIds
    .map((id) => students.find((student) => student.id === id))
    .filter((student): student is NonNullable<typeof student> => Boolean(student));
  const compact = node.width < 80 || node.height < 72;
  const hasNote = Boolean(node.note && (node.note.title.trim() || node.note.body.trim()));
  const singleAssignee = compact && assigned.length === 1 ? assigned[0] : null;
  const displayLabel = singleAssignee
    ? (singleAssignee.name.trim().split(/\s+/)[0] ?? singleAssignee.name)
    : node.label;

  const hideHover = () => {
    if (hoverTimer.current !== undefined) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = undefined;
    }
    hoverPoint.current = null;
    if (hoverVisible.current) {
      hoverVisible.current = false;
      if (useUiStore.getState().nodeHover?.nodeId === node.id) setNodeHover(null);
    }
  };

  const scheduleHover = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (!hasNote) {
      hideHover();
      return;
    }
    hoverPoint.current = { x: event.evt.clientX, y: event.evt.clientY };
    if (hoverVisible.current) {
      setNodeHover({ nodeId: node.id, clientX: event.evt.clientX, clientY: event.evt.clientY });
      return;
    }
    if (hoverTimer.current !== undefined) return;
    hoverTimer.current = window.setTimeout(() => {
      hoverTimer.current = undefined;
      const point = hoverPoint.current;
      if (!point) return;
      hoverVisible.current = true;
      setNodeHover({ nodeId: node.id, clientX: point.x, clientY: point.y });
    }, 260);
  };

  const handleClick = (event: Konva.KonvaEventObject<Event>) => {
    event.cancelBubble = true;
    hideHover();
    selectNode(node.id);
  };

  const handleDragMove = (event: Konva.KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    const group = event.target as Konva.Node;
    const others = nodesOfSegment(segmentId)
      .filter((candidate) => candidate.id !== node.id)
      .map(rectForNode);
    const snapped = calculateSnap(
      { x: group.x(), y: group.y(), width: node.width, height: node.height },
      others,
      { bounds: { width: canvasWidth, height: canvasHeight } },
    );
    group.position({ x: snapped.x, y: snapped.y });
    setSnapGuides(snapped.guides);
  };

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    event.cancelBubble = true;
    const group = event.target as Konva.Node;
    setSnapGuides([]);
    updateNode(segmentId, node.id, { x: Math.round(group.x()), y: Math.round(group.y()) });
  };

  const handleTransformEnd = () => {
    const group = groupRef.current;
    if (!group) return;
    const scaleX = group.scaleX();
    const scaleY = group.scaleY();
    const width = Math.max(40, Math.round(node.width * scaleX));
    const height = Math.max(32, Math.round(node.height * scaleY));
    group.scaleX(1);
    group.scaleY(1);
    updateNode(segmentId, node.id, {
      x: Math.round(group.x()),
      y: Math.round(group.y()),
      width,
      height,
      rotation: Math.round(group.rotation() * 10) / 10,
    });
  };

  const fill = node.type === 'station' ? tokens.stationFill : tokens.nodeFill;
  const stroke = selected ? tokens.accent : tokens.nodeStroke;
  const strokeWidth = selected ? 2 : 1;

  const shown = compact ? [] : assigned.slice(0, 4);
  const extra = compact ? 0 : assigned.length - shown.length;
  const chipWidth = 28;
  const chipRowWidth = (shown.length + (extra > 0 ? 1 : 0)) * chipWidth;
  const chipStartX = node.width / 2 - chipRowWidth / 2;

  return (
    <>
      <Group
        ref={groupRef}
        x={node.x}
        y={node.y}
        rotation={node.rotation}
        draggable
        onClick={handleClick}
        onTap={handleClick}
        onDragStart={(event) => {
          hideHover();
          handleClick(event);
        }}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onDblClick={(event) => {
          event.cancelBubble = true;
          hideHover();
          selectNode(node.id);
          openNoteEditor(node.id);
        }}
        onDblTap={(event) => {
          event.cancelBubble = true;
          hideHover();
          selectNode(node.id);
          openNoteEditor(node.id);
        }}
        onMouseEnter={(event) => {
          const container = event.target.getStage()?.container();
          if (container) container.style.cursor = 'grab';
          scheduleHover(event);
        }}
        onMouseMove={scheduleHover}
        onMouseLeave={(event) => {
          const container = event.target.getStage()?.container();
          if (container) container.style.cursor = '';
          hideHover();
        }}
      >
        {info.shape === 'ellipse' ? (
          <Ellipse
            x={node.width / 2}
            y={node.height / 2}
            radiusX={node.width / 2}
            radiusY={node.height / 2}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        ) : (
          <Rect
            width={node.width}
            height={node.height}
            cornerRadius={node.type === 'wall-anchor' ? 2 : 6}
            fill={node.type === 'wall-anchor' ? 'transparent' : fill}
            stroke={node.type === 'wall-anchor' ? tokens.accent : stroke}
            strokeWidth={strokeWidth}
            dash={node.type === 'wall-anchor' ? [7, 5] : undefined}
          />
        )}

        <Text
            text={displayLabel}
            width={node.width - 10}
            x={5}
            y={compact ? node.height / 2 - 6 : node.height / 2 - 16}
            align="center"
            fontFamily="Inter, sans-serif"
            fontSize={compact ? 10 : 12}
            fontStyle="normal"
            fill={tokens.nodeLabel}
            ellipsis
            wrap="none"
          />

        {hasNote && (
          <Circle
            x={node.width - 9}
            y={9}
            radius={3}
            fill={tokens.accent}
            opacity={0.75}
            listening={false}
          />
        )}

        {compact && assigned.length > 1 && (
          <Group x={node.width - 18} y={node.height - 18} listening={false}>
            <Circle x={9} y={9} radius={9} fill={tokens.accent} />
            <Text
              text={String(assigned.length)}
              x={0}
              y={5}
              width={18}
              align="center"
              fontFamily="Inter, sans-serif"
              fontSize={9}
              fontStyle="bold"
              fill={tokens.background}
            />
          </Group>
        )}

        {shown.length > 0 && (
          <Group y={node.height - 24} listening={false}>
            {shown.map((student, index) => (
              <Group key={student.id} x={chipStartX + index * chipWidth}>
                <Rect width={24} height={17} cornerRadius={9} fill={tokens.chipFill} />
                <Text
                  text={initials(student.name)}
                  width={24}
                  y={3}
                  align="center"
                  fontFamily="Inter, sans-serif"
                  fontSize={9}
                  fontStyle="bold"
                  fill={tokens.chipText}
                />
              </Group>
            ))}
            {extra > 0 && (
              <Text
                text={`+${extra}`}
                x={chipStartX + shown.length * chipWidth}
                y={3}
                width={24}
                align="center"
                fontFamily="Inter, sans-serif"
                fontSize={9}
                fontStyle="normal"
                fill={tokens.chipText}
              />
            )}
          </Group>
        )}
      </Group>

      {selected && (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          rotateAnchorOffset={22}
          borderStroke={tokens.accent}
          borderStrokeWidth={1.5}
          anchorStroke={tokens.accent}
          anchorFill={tokens.background}
          anchorSize={7}
          padding={3}
          ignoreStroke
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 40 || newBox.height < 32 ? oldBox : newBox
          }
        />
      )}
    </>
  );
});
