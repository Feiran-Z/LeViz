import type { LayoutSegment } from '../../domain/types';
import { useLessonStore } from '../../stores/lessonStore';
import { useRosterStore } from '../../stores/rosterStore';
import { useUiStore } from '../../stores/uiStore';
import { GroupsPanel } from './GroupsPanel';
import { NodeInspector } from './NodeInspector';
import { RosterPanel } from './RosterPanel';

export function RightPanel() {
  const rightTab = useUiStore((state) => state.rightTab);
  const setRightTab = useUiStore((state) => state.setRightTab);
  const activeSegmentId = useUiStore((state) => state.activeSegmentId);
  const students = useRosterStore((state) => state.students);

  const activeSegment = useLessonStore((state) => {
    if (!activeSegmentId) return null;
    return state.lesson?.segments.find((candidate) => candidate.id === activeSegmentId) ?? null;
  });

  const layout: LayoutSegment | null = activeSegment && activeSegment.kind === 'layout' ? activeSegment : null;

  const tabs: { id: 'roster' | 'groups' | 'node'; label: string; hint: string }[] = [
    { id: 'roster', label: 'Roster', hint: `${students.length} students` },
    { id: 'groups', label: 'Groups', hint: layout ? `${layout.canvas.nodes.length} nodes` : 'layout required' },
    { id: 'node', label: 'Inspect', hint: 'selected node' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex shrink-0 items-center border-b border-default px-2" role="tablist" aria-label="Lesson panels">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={rightTab === tab.id}
            title={tab.hint}
            className={`tab ${rightTab === tab.id ? 'tab-active' : ''}`}
            onClick={() => setRightTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {rightTab === 'roster' ? <RosterPanel /> : null}
        {rightTab === 'groups' ? <GroupsPanel /> : null}
        {rightTab === 'node' ? <NodeInspector segment={layout} /> : null}
      </div>
    </div>
  );
}
