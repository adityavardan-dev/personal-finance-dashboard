import { parseSplitDateFollowUp, isValidSplitDate } from './split-date';

describe('split date follow-ups', () => {
  it('recognizes a valid date correction without treating a new expense as a correction', () => {
    expect(parseSplitDateFollowUp('date is 2026-11-13')).toBe('2026-11-13');
    expect(parseSplitDateFollowUp('spent 200 today')).toBeNull();
    expect(parseSplitDateFollowUp('2026-02-30 is the date')).toBeNull();
  });

  it('rejects invalid calendar dates', () => {
    expect(isValidSplitDate('2026-02-30')).toBe(false);
    expect(isValidSplitDate('2026-02-28')).toBe(true);
  });
});
