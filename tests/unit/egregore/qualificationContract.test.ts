import { describe, expect, it } from 'vitest';

import {
  localQualificationSpansRequired,
  splitQualificationCases,
} from '../../manual/qualificationContract';

describe('real-model qualification contract', () => {
  it('requires detailed spans only from the local qualification build', () => {
    expect(localQualificationSpansRequired(undefined)).toBe(true);
    expect(
      localQualificationSpansRequired('https://preview.example/chatbot/'),
    ).toBe(false);
  });

  it('keeps the frozen cold/warm case while retaining every other warm case', () => {
    const cases = [{ id: 'frozen' }, { id: 'second' }, { id: 'third' }];

    expect(splitQualificationCases(cases, 'frozen')).toEqual({
      frozen: { id: 'frozen' },
      remainingWarm: [{ id: 'second' }, { id: 'third' }],
    });
  });
});
