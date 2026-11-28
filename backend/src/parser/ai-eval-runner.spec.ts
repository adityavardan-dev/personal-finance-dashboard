import { evaluateCapturedCase } from './ai-eval-runner';

describe('evaluateCapturedCase', () => {
  it('compares only the expected subset across canonical split fields', () => {
    const result = evaluateCapturedCase(
      'split-dates',
      {
        splitDrafts: [
          {
            ordinal: 1,
            amountMinor: 200000,
            currency: 'INR',
            date: '2026-11-25',
            peopleCount: 3,
            participantNames: ['You', 'Katty', 'Sridevi'],
            allocationKind: 'EQUAL',
          },
          {
            ordinal: 2,
            amountMinor: 500000,
            currency: 'INR',
            date: '2026-11-22',
            peopleCount: 3,
            participantNames: ['You', 'Katty', 'Sridevi'],
            allocationKind: 'EQUAL',
          },
        ],
      },
      {
        after: {
          pendingSplits: [
            {
              ordinal: 1,
              amountMinor: 200000,
              currency: 'INR',
              date: null,
              peopleCount: 3,
              names: 'You, Katty, Sridevi',
              allocationKind: 'EQUAL',
            },
            {
              ordinal: 2,
              amountMinor: 500000,
              currency: 'INR',
              date: null,
              peopleCount: 3,
              names: 'You, Katty, Sridevi',
              allocationKind: 'EQUAL',
            },
          ],
        },
      },
    );

    expect(result).toMatchObject({
      passed: false,
      passedFieldChecks: 16,
      totalFieldChecks: 18,
    });
    expect(
      result.checks.filter((check) => !check.passed).map((check) => check.path),
    ).toEqual(['$.splitDrafts[0].date', '$.splitDrafts[1].date']);
  });

  it('marks absent mixed personal and split expectations as failures', () => {
    const result = evaluateCapturedCase(
      'mixed',
      {
        splitDrafts: [
          {
            amountMinor: 100000,
            participantNames: ['You', 'Harsha', 'Jaswanth'],
          },
        ],
        personalDrafts: [{ amount: 700, date: '2026-11-23' }],
      },
      { appResponse: { drafts: [{ draft: { amount: null, date: null } }] } },
    );

    expect(result.passed).toBe(false);
    expect(result.passedFieldChecks).toBe(0);
    expect(result.totalFieldChecks).toBe(6);
  });
});
