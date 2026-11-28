# Peer-split manual examples

Run every example from the `backend` directory:

```powershell
npm run peer-split:examples
```

Run one example by ID:

```powershell
npm run peer-split:examples -- --case bowling-fixed-plus-remainder
```

Run a separate fixture file:

```powershell
npm run peer-split:examples -- --file examples/my-peer-split-cases.json
```

Copy `peer-split-cases.json` when creating a fixture file. Each case contains:

- `input`: typed participants, contributions, and allocation rules passed to the solver.
- `expected.allocations`: how much each participant ultimately bears.
- `expected.balances`: `paid - owed`; positive means the participant receives money and negative means they owe money.
- `expected.obligations`: the expected `from -> to` settlement edges.

All amounts are integer minor units. For INR, USD, and EUR, `100000` represents `1000.00`.

The runner prints expected JSON, actual JSON, a human-readable currency summary, and `PASS` or `FAIL`. It exits with a non-zero status when any comparison fails or validation rejects a case.
