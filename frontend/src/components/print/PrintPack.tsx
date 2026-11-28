import type { PrintCard, PrintMaterials } from '../../domain/printMaterials';
import {
  ACTIVITY_LABELS,
  NODE_TYPE_INFO,
  type LayoutSegment,
  type Lesson,
} from '../../domain/types';
import { EngagementSummary } from '../engagement/EngagementSummary';
import { LayoutThumbnail } from '../overview/LayoutThumbnail';

function hasNoteContent(card: PrintCard): boolean {
  const note = card.node.note;
  return Boolean(note && (note.title.trim() || note.body.trim()));
}

function SeatingSheet({
  lesson,
  segment,
  materials,
}: {
  lesson: Lesson;
  segment: LayoutSegment;
  materials: PrintMaterials;
}) {
  return (
    <section className="print-page print-sheet">
      <header className="border-b-2 border-default pb-4">
        <p className="section-label">Seating sheet</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{lesson.title}</h1>
        <p className="mt-1 text-sm text-secondary">
          {ACTIVITY_LABELS[segment.activityType]} · {segment.title} · {segment.durationMin} min
        </p>
      </header>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="font-medium">Engagement</span>
        <EngagementSummary design={materials.activityEngagement} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div>
          {segment.canvas.nodes.length > 0 ? (
            <LayoutThumbnail canvas={segment.canvas} />
          ) : (
            <p className="text-sm text-secondary">No furniture placed.</p>
          )}
        </div>
        {segment.instructions.trim() ? (
          <div>
            <h2 className="text-[13px] font-semibold">Activity instructions</h2>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-secondary">
              {segment.instructions}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <h2 className="text-[13px] font-semibold">Seats and assignments</h2>
        {materials.seats.length > 0 ? (
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-strong text-left text-[11px] uppercase tracking-wider text-secondary">
                <th className="py-1.5 pr-3 font-medium">Seat / station</th>
                <th className="py-1.5 pr-3 font-medium">Students</th>
                <th className="py-1.5 text-right font-medium">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {materials.seats.map((row) => (
                <tr key={row.node.id} className="border-b border-default last:border-b-0">
                  <td className="py-1.5 pr-3 font-medium">{row.node.label}</td>
                  <td className="py-1.5 pr-3 text-secondary">
                    {row.groupNames.join(', ') || '—'}
                  </td>
                  <td className="py-1.5 text-right text-xs tabular text-secondary">
                    {row.node.assignedStudentIds.length}/{row.node.capacity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-1 text-sm text-secondary">No student seats in this layout.</p>
        )}
      </div>

      {materials.cards.length === 0 ? (
        <p className="mt-5 text-sm text-secondary">
          No station cards yet — add a station or a note in the editor.
        </p>
      ) : null}

      <footer className="mt-6 border-t border-default pt-3 text-[10px] text-secondary">
        {lesson.title} · {segment.title}
      </footer>
    </section>
  );
}

function StationCard({
  card,
  index,
  total,
  lesson,
  segment,
}: {
  card: PrintCard;
  index: number;
  total: number;
  lesson: Lesson;
  segment: LayoutSegment;
}) {
  const note = card.node.note;
  const typeLabel = NODE_TYPE_INFO[card.node.type].label;

  return (
    <article className="print-page print-card">
      <header className="flex items-start justify-between gap-3 border-b border-default pb-3">
        <div className="min-w-0">
          <p className="section-label">
            {typeLabel} card {index + 1} of {total}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em]">
            {card.node.label || 'Untitled station'}
          </h2>
        </div>
        <span className="tag shrink-0">{typeLabel}</span>
      </header>

      <div className="print-prompt mt-5 min-h-[3in] rounded-sm border border-dashed border-strong p-4">
        {hasNoteContent(card) ? (
          <>
            {note?.title.trim() ? (
              <p className="text-lg font-semibold">{note.title}</p>
            ) : null}
            {note?.body.trim() ? (
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7">{note.body}</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-secondary print:hidden">
            No prompt yet — add one in the editor, or write on the printed card.
          </p>
        )}
      </div>

      <div className="mt-5 space-y-1 text-sm">
        <p>
          <span className="font-medium">Group:</span>{' '}
          <span className="text-secondary">
            {card.groupNames.join(', ') || 'No group assigned'}
          </span>
        </p>
        {card.node.capacity > 0 ? (
          <p className="text-secondary">
            Seats: {card.node.assignedStudentIds.length}/{card.node.capacity}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="font-medium">Engagement</span>
        <EngagementSummary design={card.engagement} />
      </div>

      <footer className="mt-8 border-t border-default pt-3 text-[10px] text-secondary">
        {lesson.title} · {segment.title}
      </footer>
    </article>
  );
}

export function PrintPack({
  lesson,
  segment,
  materials,
}: {
  lesson: Lesson;
  segment: LayoutSegment;
  materials: PrintMaterials;
}) {
  return (
    <>
      <SeatingSheet lesson={lesson} segment={segment} materials={materials} />
      {materials.cards.map((card, index) => (
        <StationCard
          key={card.node.id}
          card={card}
          index={index}
          total={materials.cards.length}
          lesson={lesson}
          segment={segment}
        />
      ))}
    </>
  );
}
