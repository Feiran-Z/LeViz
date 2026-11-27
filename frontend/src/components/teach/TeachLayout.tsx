import type { CanvasNode, LayoutSegment, Student } from '../../domain/types';
import { LayoutThumbnail } from '../overview/LayoutThumbnail';

function cardNodes(segment: LayoutSegment): CanvasNode[] {
  return [...segment.canvas.nodes]
    .filter((node) => node.type !== 'teacher')
    .filter((node) => {
      const hasNote = Boolean(node.note && (node.note.title.trim() || node.note.body.trim()));
      const hasGroup = node.assignedStudentIds.length > 0;
      const stationLike =
        node.type === 'station' ||
        node.type === 'round-table' ||
        ((node.type === 'wall-anchor' || node.type === 'podium') && (hasNote || hasGroup));
      return hasNote || hasGroup || stationLike;
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function groupNames(node: CanvasNode, students: Student[]): string[] {
  return node.assignedStudentIds.map(
    (id) => students.find((student) => student.id === id)?.name ?? 'Unknown',
  );
}

export function TeachLayout({
  segment,
  students,
  activeStopNodeId,
}: {
  segment: LayoutSegment;
  students: Student[];
  activeStopNodeId: string | null;
}) {
  const nodes = cardNodes(segment);

  return (
    <section className="card bg-surface p-5">
      {segment.instructions.trim() ? (
        <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-secondary">
          {segment.instructions}
        </p>
      ) : null}

      {segment.canvas.nodes.length > 0 ? (
        <LayoutThumbnail canvas={segment.canvas} />
      ) : (
        <p className="text-sm text-secondary">No furniture placed yet.</p>
      )}

      {nodes.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {nodes.map((node) => {
            const names = groupNames(node, students);
            const active = node.id === activeStopNodeId;
            const note = node.note;
            return (
              <li
                key={node.id}
                className={`rounded-md border bg-page p-3 ${
                  active ? 'border-accent ring-1 ring-accent' : 'border-default'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold">{node.label || 'Untitled'}</p>
                  {active ? <span className="tag shrink-0 text-accent">Now</span> : null}
                </div>
                {note && (note.title.trim() || note.body.trim()) ? (
                  <div className="mt-1">
                    {note.title.trim() ? (
                      <p className="text-xs font-medium">{note.title}</p>
                    ) : null}
                    {note.body.trim() ? (
                      <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-secondary">
                        {note.body}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {names.length > 0 ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-secondary">
                    Group: {names.join(', ')}
                  </p>
                ) : null}
                {node.capacity > 0 ? (
                  <p className="mt-1 text-[10px] tabular text-secondary">
                    {names.length}/{node.capacity} seats
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-secondary">No stations or notes yet.</p>
      )}
    </section>
  );
}
