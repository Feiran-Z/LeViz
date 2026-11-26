import { describe, expect, it } from 'vitest';
import { ACTIVITY_GUIDELINES, activityGuidelines } from './activityGuidelines';
import { ACTIVITY_TYPES } from './types';

describe('activity guidelines', () => {
  it('has guidance for every non-blank activity', () => {
    for (const activity of ACTIVITY_TYPES) {
      if (activity === 'custom') {
        expect(activityGuidelines(activity)).toBe('');
      } else {
        expect(activityGuidelines(activity).length, activity).toBeGreaterThan(80);
      }
    }
  });

  it('covers the activity-specific roles and preparation', () => {
    expect(activityGuidelines('mock-trial')).toContain('Jury');
    expect(activityGuidelines('mock-trial')).toContain('Prosecution counsel');
    expect(activityGuidelines('mock-trial')).toContain('Judge');
    expect(activityGuidelines('harkness')).toContain('Read and annotate');
    expect(activityGuidelines('debate')).toContain('Affirmative');
    expect(activityGuidelines('group-discussion')).toContain('Facilitator');
    expect(activityGuidelines('gallery-walk')).toContain('stop');
    expect(activityGuidelines('station-rotation')).toContain('rotate');
  });

  it('keeps blank layouts blank', () => {
    expect(ACTIVITY_GUIDELINES.custom).toBe('');
  });
});
