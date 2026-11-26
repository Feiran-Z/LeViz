import { useState } from 'react';
import { createCanvasNode, DEFAULT_CLASS_SIZE } from '../domain/lesson';
import { LAYOUT_TEMPLATES, templateFor, type LayoutTemplate } from '../domain/templates';
import { NODE_TYPE_INFO, NODE_TYPES, type ActivityType, type LayoutSegment } from '../domain/types';
import { useLessonStore } from '../stores/lessonStore';
import { useUiStore } from '../stores/uiStore';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Icon } from '../components/ui/Icons';

export function CanvasToolbar({ segment }: { segment: LayoutSegment }) {
  const addNode = useLessonStore((state) => state.addNode);
  const removeNode = useLessonStore((state) => state.removeNode);
  const applyTemplateToSegment = useLessonStore((state) => state.applyTemplateToSegment);
  const selectedNodeId = useUiStore((state) => state.selectedNodeId);
  const selectNode = useUiStore((state) => state.selectNode);
  const zoom = useUiStore((state) => state.zoom);
  const classSize = useLessonStore((state) => state.lesson?.classSize ?? DEFAULT_CLASS_SIZE);
  const zoomBy = useUiStore((state) => state.zoomBy);
  const resetViewport = useUiStore((state) => state.resetViewport);
  const notify = useUiStore((state) => state.notify);

  const [pendingTemplate, setPendingTemplate] = useState<LayoutTemplate | null>(null);

  const selectedNode = segment.canvas.nodes.find((node) => node.id === selectedNodeId) ?? null;

  const handleAddNode = (type: (typeof NODE_TYPES)[number]) => {
    const info = NODE_TYPE_INFO[type];
    const cascade = (segment.canvas.nodes.length % 6) * 18 - 45;
    const x = Math.round(segment.canvas.width / 2 - info.width / 2 + cascade);
    const y = Math.round(segment.canvas.height / 2 - info.height / 2 + cascade);
    const node = createCanvasNode(type, x, y);
    addNode(segment.id, node);
    selectNode(node.id);
    notify(`${info.label} added.`, 'success');
  };

  const applyTemplate = (template: LayoutTemplate) => {
    applyTemplateToSegment(segment.id, template.id);
    notify(`“${template.name}” layout added for ${classSize} students.`, 'success');
    setPendingTemplate(null);
  };

  const handleTemplateChoice = (value: string) => {
    if (!value) return;
    const template = templateFor(value as ActivityType);
    if (!template) return;
    if (segment.canvas.nodes.length === 0) applyTemplate(template);
    else setPendingTemplate(template);
  };

  const handleDelete = () => {
    if (!selectedNode) return;
    removeNode(segment.id, selectedNode.id);
    selectNode(null);
    notify(`${selectedNode.label} removed.`, 'info');
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-default bg-surface px-3 py-2">
        <span className="section-label mr-1 hidden sm:inline">Add</span>
        {NODE_TYPES.map((type) => {
          const info = NODE_TYPE_INFO[type];
          const round = info.shape === 'ellipse';
          return (
            <button
              key={type}
              type="button"
              className="btn btn-secondary btn-sm gap-1.5 px-2"
              onClick={() => handleAddNode(type)}
              title={`Add ${info.label.toLowerCase()}`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-2.5 w-2.5 border ${
                  type === 'wall-anchor' ? 'border-dashed border-accent' : 'border-strong bg-page'
                } ${round ? 'rounded-full' : 'rounded-[2px]'}`}
              />
              <span className="hidden md:inline">
                {info.label === 'Round table' ? 'Table' : info.label === 'Wall anchor' ? 'Wall' : info.label}
              </span>
            </button>
          );
        })}

        <span className="mx-1 h-5 w-px bg-default" aria-hidden="true" />

        <select
          className="h-7 rounded-sm border border-default bg-page px-1.5 text-xs text-primary"
          value=""
          onChange={(event) => handleTemplateChoice(event.target.value)}
          aria-label="Apply a layout template"
        >
          <option value="">Apply template for {classSize} students…</option>
          {LAYOUT_TEMPLATES.filter((template) => template.id !== 'custom').map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="icon-btn"
            onClick={() => zoomBy(1 / 1.15)}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Icon name="zoom-out" size={15} />
          </button>
          <span className="w-11 text-center text-xs tabular text-secondary">{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-btn" onClick={() => zoomBy(1.15)} title="Zoom in" aria-label="Zoom in">
            <Icon name="zoom-in" size={15} />
          </button>
          <button type="button" className="icon-btn" onClick={resetViewport} title="Fit to view" aria-label="Fit to view">
            <Icon name="maximize" size={15} />
          </button>
          <span className="mx-1 h-5 w-px bg-default" aria-hidden="true" />
          <button
            type="button"
            className="btn btn-ghost btn-sm text-danger"
            onClick={handleDelete}
            disabled={!selectedNode}
            title="Delete selected node"
          >
            <Icon name="trash" size={14} />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingTemplate !== null}
        title={`Add the ${pendingTemplate?.name ?? 'template'} layout?`}
        message={`Built for ${classSize} students and added alongside the ${segment.canvas.nodes.length} existing nodes. Existing notes and student assignments are kept.`}
        confirmLabel="Add layout"
        onConfirm={() => pendingTemplate && applyTemplate(pendingTemplate)}
        onCancel={() => setPendingTemplate(null)}
      />
    </>
  );
}
