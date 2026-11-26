import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import { Layer, Line, Rect, Shape, Stage } from 'react-konva';
import type { ActivityType, CanvasNode, LayoutSegment } from '../domain/types';
import { hitTestNodes } from '../domain/geometry';
import { templateFor } from '../domain/templates';
import { DEFAULT_CLASS_SIZE } from '../domain/lesson';
import { useLessonStore } from '../stores/lessonStore';
import { useUiStore } from '../stores/uiStore';
import { CanvasNodeView } from './CanvasNodeView';
import { CanvasToolbar } from './CanvasToolbar';
import { registerCanvasDropResolver } from './dropTarget';
import { canvasTokens } from './tokens';

const EMPTY_NODES: CanvasNode[] = [];
const PADDING = 28;

export function CanvasEditor({ segment }: { segment: LayoutSegment }) {
  const nodes = useLessonStore((state) => {
    const lesson = state.lesson;
    if (!lesson) return EMPTY_NODES;
    const current = lesson.segments.find((candidate) => candidate.id === segment.id);
    return current && current.kind === 'layout' ? current.canvas.nodes : EMPTY_NODES;
  });
  const applyTemplateToSegment = useLessonStore((state) => state.applyTemplateToSegment);
  const classSize = useLessonStore((state) => state.lesson?.classSize ?? DEFAULT_CLASS_SIZE);

  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const selectNode = useUiStore((state) => state.selectNode);
  const openNoteEditor = useUiStore((state) => state.openNoteEditor);
  const zoom = useUiStore((state) => state.zoom);
  const zoomBy = useUiStore((state) => state.zoomBy);
  const panX = useUiStore((state) => state.panX);
  const panY = useUiStore((state) => state.panY);
  const setPan = useUiStore((state) => state.setPan);
  const snapGuides = useUiStore((state) => state.snapGuides);
  const resolvedTheme = useUiStore((state) => state.resolvedTheme);
  const notify = useUiStore((state) => state.notify);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const [size, setSize] = useState({ width: 900, height: 560 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: Math.max(200, rect.width), height: Math.max(200, rect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    registerCanvasDropResolver((clientX, clientY) => {
      const stage = stageRef.current;
      const container = containerRef.current;
      if (!stage || !container) return null;
      const rect = container.getBoundingClientRect();
      const scale = stage.scaleX();
      if (!scale) return null;
      const x = (clientX - rect.left - stage.x()) / scale;
      const y = (clientY - rect.top - stage.y()) / scale;
      const hit = hitTestNodes(nodesRef.current, { x, y });
      return hit ? { segmentId: segment.id, nodeId: hit.id } : null;
    });
    return () => registerCanvasDropResolver(null);
  }, [segment.id]);

  const tokens = canvasTokens(resolvedTheme);
  const canvasWidth = segment.canvas.width;
  const canvasHeight = segment.canvas.height;
  const fitScale = Math.min(
    (size.width - PADDING * 2) / canvasWidth,
    (size.height - PADDING * 2) / canvasHeight,
    1.5,
  );
  const scale = Math.max(0.15, fitScale) * zoom;
  const offsetX = (size.width - canvasWidth * scale) / 2;
  const offsetY = (size.height - canvasHeight * scale) / 2;

  const isEmpty = nodes.length === 0;
  const quickTemplates = ['harkness', 'debate', 'station-rotation', 'group-discussion'] as const;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CanvasToolbar segment={segment} />
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-canvas"
        data-canvas-surface="true"
      >
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={offsetX + panX}
          y={offsetY + panY}
          scaleX={scale}
          scaleY={scale}
          draggable
          onDragEnd={(event) => {
            // Drag events bubble from nodes; only the stage's own pan commits here.
            if (event.target !== stageRef.current) return;
            const stage = stageRef.current;
            setPan(stage.x() - offsetX, stage.y() - offsetY);
          }}
          onWheel={(event) => {
            event.evt.preventDefault();
            zoomBy(event.evt.deltaY > 0 ? 1 / 1.08 : 1.08);
          }}
          onClick={(event) => {
            if (event.target === event.target.getStage()) {
              selectNode(null);
              openNoteEditor(null);
            }
          }}
        >
          <Layer listening={false}>
            <Rect
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
              cornerRadius={4}
              fill={tokens.background}
              stroke={tokens.nodeStroke}
              strokeWidth={1}
            />
            <Shape
              sceneFunc={(context) => {
                context.fillStyle = tokens.grid;
                for (let x = 20; x < canvasWidth; x += 40) {
                  for (let y = 20; y < canvasHeight; y += 40) {
                    context.beginPath();
                    context.arc(x, y, 1, 0, Math.PI * 2);
                    context.fill();
                  }
                }
              }}
            />
          </Layer>

          <Layer>
            {nodes.map((node) => (
              <CanvasNodeView
                key={node.id}
                segmentId={segment.id}
                nodeId={node.id}
                selected={selectedNodeId === node.id}
                tokens={tokens}
              />
            ))}
          </Layer>

          <Layer listening={false}>
            {snapGuides.map((guide, index) => (
              <Line
                key={`${guide.orientation}-${guide.position}-${index}`}
                points={
                  guide.orientation === 'vertical'
                    ? [guide.position, 0, guide.position, canvasHeight]
                    : [0, guide.position, canvasWidth, guide.position]
                }
                stroke={tokens.accent}
                strokeWidth={1}
                dash={[4, 4]}
                opacity={0.65}
              />
            ))}
          </Layer>
        </Stage>

        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="pointer-events-auto max-w-sm rounded-lg border border-default bg-surface/95 p-5 text-center">
              <h3 className="text-lg font-semibold">Start the room</h3>
              <p className="mt-1 text-sm text-secondary">
                Apply a template built for {classSize} students, or add furniture one piece at a time.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {quickTemplates.map((activity) => {
                  const template = templateFor(activity as ActivityType);
                  if (!template) return null;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        applyTemplateToSegment(segment.id, template.id);
                        notify(`“${template.name}” layout added for ${classSize} students.`, 'success');
                      }}
                    >
                      {template.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-secondary">
          Drag to pan · Scroll to zoom · Double-click a seat to add a note
        </p>
      </div>
    </div>
  );
}
