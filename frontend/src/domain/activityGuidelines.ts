import type { ActivityType } from './types';

/**
 * Plain-text starting instructions for each activity. These prefill the
 * layout segment's "Activity instructions" box; teachers can edit or clear
 * them. Plain text only (no rich formatting).
 */

const lines = (parts: string[]): string => parts.join('\n');

export const ACTIVITY_GUIDELINES: Record<ActivityType, string> = {
  harkness: lines([
    'PREPARATION',
    '- Read and annotate the text before the discussion.',
    '- Bring at least two questions and one passage you want the group to discuss.',
    '- Mark one place where your thinking changed.',
    '',
    'DISCUSSION NORMS',
    '- Build on what others say and use their names.',
    '- Ask a clarifying question before disagreeing.',
    '- Support your ideas with evidence from the text.',
    '- Share the air: no one dominates and no one disappears.',
    '',
    'TEACHER ROLE',
    '- Sit outside the circle and take notes rather than leading.',
    '- Track who speaks and note one strength and one next step for the group.',
  ]),

  debate: lines([
    'FORMAT',
    '- Affirmative argues for the motion; Negative argues against it.',
    '- Each team prepares an opening statement, two main arguments, and a rebuttal.',
    '',
    'ROLES',
    '- First speaker: define the motion and present the opening statement.',
    '- Second speaker: develop the main arguments with evidence.',
    '- Third speaker: rebut the other team and deliver the closing summary.',
    '- Timekeeper: keep each speaker within the time limit.',
    "- Note-taker: capture the other team's strongest point for rebuttal.",
    '',
    'PROCEDURE',
    '1. Opening statements: Affirmative, then Negative.',
    '2. Main arguments and cross-examination.',
    '3. Rebuttals.',
    '4. Closing summaries, then class vote or feedback.',
  ]),

  'mock-trial': lines([
    'ROLES AND RESPONSIBILITIES',
    '- Judge: keeps order, rules on objections, and explains the verdict process.',
    '- Jury: listens closely, takes notes, and deliberates to a verdict.',
    "- Prosecution counsel: presents the prosecution's case and examines witnesses.",
    "- Defense counsel: presents the defense's case and cross-examines witnesses.",
    '- Witnesses: stay in role and answer only the questions asked.',
    '- Timekeeper/bailiff: keeps the trial on schedule and announces each phase.',
    '',
    'PROCEDURE',
    '1. Opening statements: prosecution, then defense.',
    '2. Witness examination and cross-examination.',
    '3. Closing arguments.',
    '4. Jury deliberation and verdict.',
    '5. Debrief: what made the arguments convincing?',
  ]),

  'group-discussion': lines([
    'GROUP ROLES',
    '- Facilitator: keeps the group on the question and invites quieter voices.',
    '- Recorder: captures key ideas and the evidence behind them.',
    '- Timekeeper: watches the clock and signals transitions.',
    "- Reporter: shares the group's best thinking with the class.",
    '',
    'DISCUSSION NORMS',
    '- Everyone speaks at least once.',
    '- Ask one clarifying question before disagreeing.',
    '- Point to evidence from the text or task.',
    '- Build on the previous speaker\'s idea before adding your own.',
  ]),

  'gallery-walk': lines([
    'SETUP',
    '- Place each piece of work at a numbered stop with a prompt or question.',
    '- Give every student a recording sheet.',
    '',
    'DURING THE WALK',
    '- Move clockwise every ____ minutes.',
    '- At each stop: read, notice, and leave one comment or question.',
    '- Use the prompt at the stop to focus your response.',
    '',
    'DEBRIEF',
    '- Return to your starting stop and read the comments left there.',
    '- Share one pattern the class noticed.',
  ]),

  'station-rotation': lines([
    'ROTATION PLAN',
    '- Four stations; groups rotate clockwise every ____ minutes.',
    '- Each station has its own prompt and assigned group.',
    '',
    'STATION EXPECTATIONS',
    '- Read the station prompt before starting.',
    '- Leave the station as you found it; materials stay in place.',
    "- Finish the station's exit question before rotating.",
    '',
    'TEACHER ROLE',
    '- Circulate, check progress, and signal each rotation.',
    '- Note which station needs more time in the next lesson.',
  ]),

  // Legacy activity type (its layout template was removed). Kept so old
  // documents still get sensible instructions.
  'free-for-all': lines([
    'WHOLE-CLASS ACTIVITY',
    '- Everyone participates; keep the space open and safe.',
    '- Agree on the rules and the winning condition before starting.',
    '- Pause at the end to name one thing that worked and one to change next time.',
  ]),

  // Blank layouts intentionally start with no guidance.
  custom: '',
};

export function activityGuidelines(activity: ActivityType): string {
  return ACTIVITY_GUIDELINES[activity];
}
