/** Compares a stored Penny response with the human-reviewed expected subset. */

export interface EvalFieldCheck {
  path: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

export interface EvalCaseResult {
  caseId: string;
  passed: boolean;
  passedFieldChecks: number;
  totalFieldChecks: number;
  checks: EvalFieldCheck[];
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): JsonRecord => (isRecord(value) ? value : {});

const participantNames = (value: unknown): unknown => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
  }
  return value;
};

const normalizeSplitDraft = (value: unknown): JsonRecord => {
  const draft = asRecord(value);
  return {
    ...draft,
    participantNames: participantNames(draft.participantNames ?? draft.names),
  };
};

const normalizePersonalDraft = (value: unknown): JsonRecord => {
  const wrapper = asRecord(value);
  const draft = isRecord(wrapper.draft) ? wrapper.draft : wrapper;
  return { ...draft };
};

/** Maps replies from every Penny medium into the common evaluation vocabulary. */
export function canonicalizeObserved(observedValue: unknown): JsonRecord {
  const observed = asRecord(observedValue);
  const after = asRecord(observed.after);
  const response = asRecord(observed.response ?? observed.appResponse);

  const splitSource = Array.isArray(after.pendingSplits)
    ? after.pendingSplits
    : Array.isArray(response.splitDrafts)
      ? response.splitDrafts
      : Array.isArray(response.drafts) &&
          response.drafts.some((item) => {
            const draft = asRecord(item);
            return 'amountMinor' in draft || 'peopleCount' in draft;
          })
        ? response.drafts
        : [];

  const personalSource = Array.isArray(after.personalDrafts)
    ? after.personalDrafts
    : Array.isArray(response.personalDrafts)
      ? response.personalDrafts
      : Array.isArray(response.drafts)
        ? response.drafts.filter((item) => {
            const wrapper = asRecord(item);
            const draft = isRecord(wrapper.draft) ? wrapper.draft : wrapper;
            return !('amountMinor' in draft) && !('peopleCount' in draft);
          })
        : [];

  return {
    ...observed,
    splitDrafts: splitSource.map(normalizeSplitDraft),
    personalDrafts: personalSource.map(normalizePersonalDraft),
  };
}

function compareSubset(
  expected: unknown,
  actual: unknown,
  path: string,
  checks: EvalFieldCheck[],
): void {
  if (Array.isArray(expected)) {
    const actualArray = Array.isArray(actual) ? actual : [];
    expected.forEach((expectedItem, index) => {
      const expectedRecord = asRecord(expectedItem);
      const ordinal = expectedRecord.ordinal;
      const actualItem =
        ordinal === undefined
          ? actualArray[index]
          : actualArray.find((item) => asRecord(item).ordinal === ordinal);
      compareSubset(expectedItem, actualItem, `${path}[${index}]`, checks);
    });
    return;
  }

  if (isRecord(expected)) {
    const actualRecord = asRecord(actual);
    Object.entries(expected).forEach(([key, value]) => {
      compareSubset(value, actualRecord[key], `${path}.${key}`, checks);
    });
    return;
  }

  checks.push({
    path,
    expected,
    actual: actual === undefined ? null : actual,
    passed: Object.is(expected, actual),
  });
}

export function evaluateCapturedCase(
  caseId: string,
  expected: unknown,
  observed: unknown,
): EvalCaseResult {
  const checks: EvalFieldCheck[] = [];
  compareSubset(expected, canonicalizeObserved(observed), '$', checks);
  const passedFieldChecks = checks.filter((check) => check.passed).length;
  return {
    caseId,
    passed: checks.length > 0 && passedFieldChecks === checks.length,
    passedFieldChecks,
    totalFieldChecks: checks.length,
    checks,
  };
}
