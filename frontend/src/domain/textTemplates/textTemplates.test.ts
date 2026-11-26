import { describe, expect, it } from 'vitest';
import { createTextSegment } from '../lesson';
import { TEXT_TEMPLATES, textTemplateFor } from './index';

describe('text templates', () => {
  it('has unique ids and offers a blank option first', () => {
    expect(TEXT_TEMPLATES[0]?.id).toBe('blank');
    expect(new Set(TEXT_TEMPLATES.map((template) => template.id)).size).toBe(TEXT_TEMPLATES.length);
  });

  it('offers the requested routines plus supporting structures', () => {
    for (const id of [
      'think-pair-share',
      'exit-ticket',
      'reflection',
      'do-now',
      'debrief',
      'mini-lesson',
      'learning-goals',
      'vocabulary',
      'homework',
    ]) {
      expect(textTemplateFor(id), id).toBeDefined();
    }
  });

  it('ships non-empty content and a duration for every non-blank template', () => {
    for (const template of TEXT_TEMPLATES.filter((candidate) => candidate.id !== 'blank')) {
      expect(template.content?.type, template.id).toBe('doc');
      expect((template.content?.content ?? []).length, template.id).toBeGreaterThan(0);
      expect(template.durationMin, template.id).toBeGreaterThan(0);
      expect(template.title.length, template.id).toBeGreaterThan(0);
    }
  });

  it('writes the Think-Pair-Share steps', () => {
    const json = JSON.stringify(textTemplateFor('think-pair-share')?.content);
    expect(json).toContain('Think (2 min)');
    expect(json).toContain('Pair (3 min)');
    expect(json).toContain('Share (5 min)');
  });

  it('clones template content instead of sharing the same object', () => {
    const template = textTemplateFor('exit-ticket');
    if (!template?.content) throw new Error('Missing exit-ticket content');
    const before = JSON.stringify(template.content);
    const segment = createTextSegment(template.title, template.content, template.durationMin);
    segment.content?.content?.push({ type: 'paragraph', content: [{ type: 'text', text: 'extra' }] });
    expect(JSON.stringify(template.content)).toBe(before);
  });
});
