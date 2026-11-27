import type { Segment, Student } from '../../domain/types';
import { RichTextView } from '../overview/RichTextView';
import { TeachLayout } from './TeachLayout';

/** Read-only content for the current teach segment. */
export function TeachContent({
  segment,
  students,
  activeStopNodeId,
}: {
  segment: Segment;
  students: Student[];
  activeStopNodeId: string | null;
}) {
  if (segment.kind === 'text') {
    return (
      <section className="card bg-surface p-6">
        <RichTextView doc={segment.content} />
      </section>
    );
  }

  return (
    <TeachLayout
      segment={segment}
      students={students}
      activeStopNodeId={activeStopNodeId}
    />
  );
}
