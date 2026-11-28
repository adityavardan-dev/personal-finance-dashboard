import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LedgerSolver } from '../src/peer-splits/domain/ledger-solver';
import { PeerSplitValidationError } from '../src/peer-splits/domain/peer-split.errors';
import type {
  PeerObligation,
  PeerSplitInput,
  PeerSplitResult,
} from '../src/peer-splits/domain/peer-split.types';

interface ManualExpectedResult {
  allocations: Record<string, number>;
  balances: Record<string, number>;
  obligations: PeerObligation[];
}

interface ManualCase {
  id: string;
  description: string;
  input: PeerSplitInput;
  expected: ManualExpectedResult;
}

function comparableResult(result: PeerSplitResult): ManualExpectedResult {
  return {
    allocations: Object.fromEntries(
      result.allocations.map((item) => [
        item.participantId,
        item.amountOwedMinor,
      ]),
    ),
    balances: Object.fromEntries(
      result.balances.map((item) => [item.participantId, item.netBalanceMinor]),
    ),
    obligations: result.obligations,
  };
}

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}

function printFriendlyResult(
  testCase: ManualCase,
  actual: ManualExpectedResult,
): void {
  const names = new Map(
    testCase.input.participants.map((participant) => [
      participant.id,
      participant.displayName,
    ]),
  );
  const currency = testCase.input.currency;
  console.log('Calculated allocations:');
  for (const [participantId, amountMinor] of Object.entries(
    actual.allocations,
  )) {
    console.log(
      `  ${names.get(participantId) ?? participantId}: ${formatMoney(amountMinor, currency)}`,
    );
  }
  console.log('Calculated net balances:');
  for (const [participantId, amountMinor] of Object.entries(actual.balances)) {
    console.log(
      `  ${names.get(participantId) ?? participantId}: ${formatMoney(amountMinor, currency)}`,
    );
  }
  console.log('Calculated obligations:');
  for (const obligation of actual.obligations) {
    console.log(
      `  ${names.get(obligation.fromParticipantId) ?? obligation.fromParticipantId} owes ${names.get(obligation.toParticipantId) ?? obligation.toParticipantId} ${formatMoney(obligation.amountMinor, currency)}`,
    );
  }
}

const args = process.argv.slice(2);
const fileFlagIndex = args.indexOf('--file');
const caseFlagIndex = args.indexOf('--case');
const fixturePath = resolve(
  fileFlagIndex >= 0 && args[fileFlagIndex + 1]
    ? args[fileFlagIndex + 1]
    : 'examples/peer-split-cases.json',
);
const selectedCaseId =
  caseFlagIndex >= 0 && args[caseFlagIndex + 1]
    ? args[caseFlagIndex + 1]
    : null;
const cases = JSON.parse(readFileSync(fixturePath, 'utf8')) as ManualCase[];
const selectedCases = selectedCaseId
  ? cases.filter((testCase) => testCase.id === selectedCaseId)
  : cases;

if (selectedCases.length === 0) {
  console.error(`No example matched case ID: ${selectedCaseId}`);
  process.exitCode = 1;
} else {
  const solver = new LedgerSolver();
  let failureCount = 0;

  for (const testCase of selectedCases) {
    console.log(`\n=== ${testCase.id} ===`);
    console.log(testCase.description);
    try {
      const actual = comparableResult(solver.solve(testCase.input));
      const passed = isDeepStrictEqual(actual, testCase.expected);
      console.log(`Expected:\n${JSON.stringify(testCase.expected, null, 2)}`);
      console.log(`Actual:\n${JSON.stringify(actual, null, 2)}`);
      printFriendlyResult(testCase, actual);
      console.log(passed ? 'RESULT: PASS' : 'RESULT: FAIL');
      if (!passed) failureCount += 1;
    } catch (error) {
      failureCount += 1;
      if (error instanceof PeerSplitValidationError) {
        console.log(
          `Validation rejected the example:\n${JSON.stringify(error.issues, null, 2)}`,
        );
      } else {
        console.error(error);
      }
      console.log('RESULT: FAIL');
    }
  }

  console.log(
    `\n${selectedCases.length - failureCount}/${selectedCases.length} examples passed.`,
  );
  if (failureCount > 0) process.exitCode = 1;
}
