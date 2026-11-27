import type { Segment } from '../../domain/types';
import { RichTextView } from '../overview/RichTextView';
import { LayoutThumbnail } from '../overview/LayoutThumbnail';

/** Read-only content for the current teach segment. */
export function TeachContent({ segment }: { segment: Segment }) {
  if (segment.kind === 'text') {
    return (
      <section className="card bg-surface p-6">
        <RichTextView doc={segment.content} />
      </section>
    );
  }

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
    </section>
  );
}
