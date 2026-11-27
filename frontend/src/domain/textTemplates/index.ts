import type { RichTextDoc, RichTextNode } from '../types';

/**
 * Starting points for text segments. Content is TipTap JSON restricted to the
 * app's allowed formatting set (headings, paragraphs, lists, bold, italic, links).
 */

export type TextTemplateId =
  | 'blank'
  | 'learning-goals'
  | 'vocabulary'
  | 'do-now'
  | 'think-pair-share'
  | 'mini-lesson'
  | 'debrief'
  | 'reflection'
  | 'exit-ticket'
  | 'homework';

export interface TextTemplate {
  id: TextTemplateId;
  name: string;
  description: string;
  /** Segment title used when the template is applied. */
  title: string;
  durationMin: number;
  content: RichTextDoc | null;
}

const text = (value: string, marks?: RichTextNode['marks']): RichTextNode =>
  marks ? { type: 'text', text: value, marks } : { type: 'text', text: value };

const paragraph = (...content: RichTextNode[]): RichTextNode => ({ type: 'paragraph', content });

const heading = (value: string): RichTextNode => ({
  type: 'heading',
  attrs: { level: 3 },
  content: [text(value)],
});

const list = (ordered: boolean, items: string[]): RichTextNode => ({
  type: ordered ? 'orderedList' : 'bulletList',
  content: items.map((item) => ({
    type: 'listItem',
    content: [paragraph(text(item))],
  })),
});

const emphasis = (value: string): RichTextNode => text(value, [{ type: 'italic' }]);

const doc = (...blocks: RichTextNode[]): RichTextDoc => ({ type: 'doc', content: blocks });

export const TEXT_TEMPLATES: TextTemplate[] = [
  {
    id: 'blank',
    name: 'Blank text segment',
    description: 'Start with an empty page.',
    title: 'Text segment',
    durationMin: 5,
    content: null,
  },
  {
    id: 'learning-goals',
    name: 'Learning goals',
    description: 'State and unpack what students should be able to do.',
    title: 'Learning goals',
    durationMin: 3,
    content: doc(
      paragraph(text('By the end of the lesson, students will be able to:')),
      list(false, ['They can [first content goal].', 'They can [second content goal].']),
      paragraph(text('Why this matters: [connect to the unit or a real-world use].')),
      paragraph(text('Students will also be able to:')),
      list(false, ['They can [first language goal].', 'They can [second language goal].']),
    ),
  },
  {
    id: 'vocabulary',
    name: 'Key vocabulary',
    description: 'Introduce terms with definitions and examples.',
    title: 'Key vocabulary',
    durationMin: 5,
    content: doc(
      paragraph(text('Introduce each term with a definition and an example.')),
      list(false, ['[Term] — [definition] — [example]', '[Term] — [definition] — [example]']),
      paragraph(text('Students write one sentence that uses two of the terms.')),
    ),
  },
  {
    id: 'do-now',
    name: 'Do Now',
    description: 'An independent warm-up students begin the moment they sit down.',
    title: 'Do Now',
    durationMin: 5,
    content: doc(
      paragraph(text('Students begin immediately when they sit down.')),
      heading('Prompt'),
      paragraph(text('Write 2–3 sentences: What do you already know about today’s topic?')),
      heading('What to look for'),
      list(false, ['A common misconception to address in the opening', 'One strong response to share aloud']),
    ),
  },
  {
    id: 'think-pair-share',
    name: 'Think-Pair-Share',
    description: 'Think time, partner talk, then selected shares with the class.',
    title: 'Think-Pair-Share',
    durationMin: 10,
    content: doc(
      paragraph(text('Use a question worth discussing — one with more than a single right answer.')),
      heading('The question'),
      paragraph(text('[Write your question here]')),
      list(true, [
        'Think (2 min): jot your answer and one reason.',
        'Pair (3 min): compare with a partner and add one new idea.',
        'Share (5 min): a few pairs share their reasoning with the class.',
      ]),
      heading('Sentence starters'),
      list(false, ['I think ___ because ___.', 'I agree with ___ because ___.', 'Could you say more about ___?']),
      paragraph(emphasis('Circulate during pair time; choose shares that surface different reasoning.')),
    ),
  },
  {
    id: 'mini-lesson',
    name: 'Mini-lesson',
    description: 'Teacher-led explanation with a model before independent practice.',
    title: 'Mini-lesson',
    durationMin: 15,
    content: doc(
      paragraph(text('Teacher-led explanation of a concept, theory, or model, before students practise independently.')),
      heading('Concept/Theory/Model'),
      list(true, [
        'Show the worked example.',
        'Think aloud through the key decisions.',
        'Name one common mistake and how to avoid it.',
      ]),
      heading('Check for understanding'),
      paragraph(text('Ask two students to explain the model in their own words before practice.')),
      heading('Resources'),
      paragraph(text('Links to the resources: [link 1], [link 2], [link 3]')),
    ),
  },
  {
    id: 'debrief',
    name: 'Debrief',
    description: 'Bring the class back together to consolidate the learning.',
    title: 'Debrief',
    durationMin: 10,
    content: doc(
      paragraph(text('Bring the class back together to consolidate the learning.')),
      heading('Discussion questions'),
      list(true, [
        'What did your group notice or discover?',
        'Which strategy was most efficient, and why?',
        'What would you do differently next time?',
      ]),
      paragraph(text('Record 2–3 key takeaways on the board so the class sees its shared thinking.')),
    ),
  },
  {
    id: 'reflection',
    name: 'Reflection',
    description: 'Individual prompts about learning, challenge, and next questions.',
    title: 'Reflection',
    durationMin: 5,
    content: doc(
      paragraph(text('Independent writing, then an optional partner share.')),
      heading('Prompts'),
      list(false, [
        'What did you learn today?',
        'What was challenging, and what did you do about it?',
        'What is one question you still have?',
      ]),
      paragraph(emphasis('Optionally, students share one sentence with a partner before submitting.')),
    ),
  },
  {
    id: 'exit-ticket',
    name: 'Exit ticket',
    description: 'A short end-of-lesson check for understanding.',
    title: 'Exit ticket',
    durationMin: 5,
    content: doc(
      paragraph(text('Answer on a slip of paper before leaving.')),
      heading('Questions'),
      list(true, [
        'In your own words, explain [concept].',
        'Show your work for [problem].',
        'Rate your confidence (1–5) and explain your rating.',
      ]),
      paragraph(emphasis('Sort responses into got it / almost / not yet to plan the next lesson.')),
    ),
  },
  {
    id: 'homework',
    name: 'Homework',
    description: 'Assign next steps and connect them to the lesson.',
    title: 'Homework',
    durationMin: 3,
    content: doc(
      paragraph(text('Due [date].')),
      list(false, ['[Task 1]', '[Task 2]']),
      paragraph(emphasis('Optional: preview how this connects to the next lesson.')),
    ),
  },
];

export function textTemplateFor(id: TextTemplateId | string | undefined): TextTemplate | undefined {
  if (!id) return undefined;
  return TEXT_TEMPLATES.find((template) => template.id === id);
}
