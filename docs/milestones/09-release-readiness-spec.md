# Milestone 9 — V1 Release Readiness

## Metadata

| Field | Value |
|---|---|
| Status | Authoritative implementation specification |
| Target branch | `feature/v1-release-readiness` |
| Base branch | Latest `develop` after Milestone 8 is merged |
| Depends on | Milestones 4–8 complete and individually verified |
| Required before | V1 release decision/tag |
| Product version | V1 — Track |

## 1. Objective

Establish the final repeatable verification gate, runtime-data hygiene, CI browser execution, master user journey, and documentation synchronization required to certify XPENSE V1 as a stable local-development personal finance dashboard.

This milestone does not transform local JSON/plaintext authentication into production infrastructure. Release documentation must state that limitation explicitly.

## 2. Scope

### In scope

- Add Playwright E2E execution to GitHub Actions.
- Install and cache compatible headless Chromium dependencies deterministically.
- Enforce backend/frontend clean install, unit test, and build gates.
- Ensure `backend/data/*.json` runtime stores are untracked and ignored.
- Remove tracked runtime/test financial records from the Git index without deleting a developer's local file.
- Add a comprehensive master V1 Playwright journey.
- Ensure E2E records are isolated and do not dirty the working tree.
- Synchronize README and authoritative docs with implemented V1 behavior.
- Record known local-development security and persistence limitations.
- Verify the repository remains clean after the release suite.

### Out of scope

- Production deployment or hosting.
- Docker, Kubernetes, or container CI.
- PostgreSQL, database, ORM, or cloud storage.
- bcrypt, Argon2, password hashing, OAuth, refresh tokens, secret management redesign, or production identity architecture.
- LLMs, AI assistant, automated ingestion, SMS parsing, or V2/V3 functionality.
- External UI component libraries.
- New V1 product capabilities beyond fixing release-blocking regressions.

## 2.1 Authoritative contracts

This milestone adds no application-domain DTO and does not change the user, transaction, or budget JSON schemas. It defines the release evidence artifact contract:

```ts
export type ReleaseGateStatus = 'passed' | 'failed';

export interface ReleaseGateResult {
  name: string;
  command: string;
  status: ReleaseGateStatus;
  summary: string;
}

export interface V1ReleaseEvidence {
  commit: string;
  generatedAt: string;
  gates: ReleaseGateResult[];
}
```

If release evidence is emitted as a CI artifact, it must use this JSON shape:

```json
{
  "commit": "full-git-commit-sha",
  "generatedAt": "2026-09-25T18:00:00.000Z",
  "gates": [
    {
      "name": "backend-tests",
      "command": "npm test -- --runInBand",
      "status": "passed",
      "summary": "All backend Jest suites passed"
    }
  ]
}
```

This evidence file is a generated CI artifact and must not be committed. Runtime application JSON continues to follow Milestones 4, 5, and 7.

## 3. Release architecture contracts

### 3.1 Supported local-development stack

```text
Frontend: Angular 21 + Tailwind CSS + Vitest + Playwright
Backend: NestJS 11 + JWT + Jest
Persistence: backend/data/users.json
             backend/data/expenses.json
             backend/data/budgets.json
Session: Browser sessionStorage accessToken
CI: GitHub Actions on pull requests to develop
```

No documentation may claim PostgreSQL, Docker, production password security, AI, or automated transaction ingestion is implemented.

### 3.2 Runtime data hygiene

`backend/.gitignore` must exclude runtime JSON while allowing source files outside `data/`:

```gitignore
# Local JSON data stores
/data/*.json
```

Required repository state:

- `backend/data/users.json` is untracked.
- `backend/data/expenses.json` is untracked.
- `backend/data/budgets.json` is untracked.
- No real or test identity, password, JWT, budget, or financial record exists in Git history added by V1 release work.
- Services create missing data directories/files at runtime.

If `backend/data/expenses.json` remains tracked when this milestone begins, remove it from the index while preserving the local working copy:

```bash
git rm --cached backend/data/expenses.json
```

This exact action must be reviewed before commit because it changes repository tracking. Do not delete a developer's local runtime data.

### 3.3 Test-data isolation

Playwright must not depend on pre-existing JSON records. Each run uses unique email/merchant identifiers. The suite must adopt one deterministic cleanup strategy:

1. Preferred: start backend with an E2E-specific data directory supplied by environment configuration; or
2. Before/after suite: reset only E2E-owned runtime files in a temporary test directory.

Tests must never truncate a developer's default `backend/data` directory. The selected test data directory must be ignored and disposable.

## 4. CI pipeline contract

### 4.1 Trigger

CI remains required for:

```yaml
on:
  pull_request:
    branches:
      - develop
  workflow_dispatch:
```

### 4.2 Required jobs

#### Backend job

```text
checkout
setup Node 22 with backend npm cache
npm ci
npm test -- --runInBand
npm run build
```

#### Frontend unit/build job

```text
checkout
setup Node 22 with frontend npm cache
npm ci
npm test -- --watch=false
npm run build
```

#### Playwright E2E job

Runs after backend and frontend jobs succeed:

```yaml
e2e:
  needs: [backend-build, frontend-build]
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
        cache-dependency-path: |
          backend/package-lock.json
          frontend/package-lock.json
    - name: Install backend dependencies
      working-directory: backend
      run: npm ci
    - name: Install frontend dependencies
      working-directory: frontend
      run: npm ci
    - name: Cache Playwright browsers
      uses: actions/cache@v4
      with:
        path: ~/.cache/ms-playwright
        key: ${{ runner.os }}-playwright-${{ hashFiles('frontend/package-lock.json') }}
    - name: Install Chromium
      working-directory: frontend
      run: npx playwright install --with-deps chromium
    - name: Run E2E
      working-directory: frontend
      run: npx playwright test
      env:
        CI: true
        XPENSE_DATA_DIR: ${{ runner.temp }}/xpense-e2e-data
    - name: Upload Playwright report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report
        path: frontend/playwright-report
        retention-days: 14
```

Job names in the final YAML must match the actual `needs` references. Do not weaken or remove existing build/unit gates.

### 4.3 CI failure policy

- No `continue-on-error` for tests or builds.
- Playwright retries may remain CI-only at two retries.
- Traces are retained on first retry or failure.
- Screenshots/videos are failure artifacts, not committed files.
- A failing release gate blocks merge.

## 5. Master V1 smoke journey

Create or consolidate a Playwright test named:

```text
V1 master journey — account, budget, transactions, insights, profile and logout
```

Authoritative flow:

1. Visit signup.
2. Create a unique account with username different from email prefix.
3. Observe success status and redirect to login.
4. Login and verify dashboard empty state.
5. Set monthly budget and category limit.
6. Create an expense and income.
7. Create an additional dated expense required for comparison/trend behavior.
8. Verify current-month dashboard total excludes income.
9. Verify persisted budget and remaining amount.
10. Verify recent activity.
11. Open Insights and verify deterministic category/trend/average values.
12. Open History and verify type/category/date filtering.
13. Open read-only transaction detail.
14. Edit one expense and verify recalculated dashboard/insights.
15. Delete one record and verify removal/recalculation.
16. Open Profile and verify exact persisted username/initials/email.
17. Change currency and verify persistence after reload.
18. Logout.
19. Navigate directly to a protected route and verify login redirect.
20. Attempt duplicate signup and verify conflict message.

This master journey supplements focused tests; it does not replace unit tests or smaller diagnostic E2E cases.

## 6. Release gate checklist

### Git and repository

- [ ] Current branch started from latest `develop`.
- [ ] No unrelated feature commits.
- [ ] `git diff --check` passes.
- [ ] Runtime JSON is untracked and ignored.
- [ ] No secret, JWT, password, or user financial data is staged.
- [ ] Build/test artifacts are ignored.
- [ ] Working tree is clean after verification.

### Backend

- [ ] `npm ci` succeeds from a clean dependency directory.
- [ ] All Jest suites pass.
- [ ] Nest build passes.
- [ ] Auth, ownership, budgets, profile, and malformed-store behavior remain covered.

### Frontend

- [ ] `npm ci` succeeds.
- [ ] All Vitest suites pass.
- [ ] Production/SSR build passes.
- [ ] No browser-global SSR errors.
- [ ] No hardcoded demonstration financial values remain.
- [ ] No unhandled Angular runtime warnings in critical journeys.

### E2E

- [ ] Focused signup/login tests pass.
- [ ] Expense/income CRUD and isolation pass.
- [ ] Budget persistence pass.
- [ ] Dynamic dashboard/insights pass.
- [ ] Profile/preferences pass.
- [ ] Viewport and keyboard matrix pass.
- [ ] Master V1 journey passes.
- [ ] Tests leave no tracked data changes.

### Documentation

- [ ] README accurately describes Angular, NestJS, local JSON, and CI.
- [ ] Business requirements match delivered V1 behavior.
- [ ] Design system and UI guide links resolve from root `docs/`.
- [ ] Milestone specifications reflect final contracts or contain explicit amendments.
- [ ] V1 limitations are disclosed.
- [ ] V2/V3 capabilities are clearly labeled planned, not implemented.

## 7. Final verification commands

Run from a clean clone or equivalent clean dependency state:

```bash
cd backend
npm ci
npm test -- --runInBand
npm run build

cd ../frontend
npm ci
npm test -- --watch=false
npm run build
npx playwright install chromium
npx playwright test

cd ..
git diff --check
git status --short --branch
```

Expected final status contains no modified runtime or generated files.

## 8. V1 release statement contract

The final documentation may state:

> XPENSE V1 is a complete local-development personal finance dashboard supporting persisted account signup/login, authenticated transaction tracking, per-user budgets, deterministic spending insights, profile preferences, responsive layouts, and accessible core journeys.

It must also state:

> XPENSE V1 uses local JSON persistence and plaintext development passwords. It is not production-grade authentication or financial-data infrastructure.

The release must not imply production hosting, database durability, AI assistance, or automated transaction capture.

## 9. Acceptance criteria

- [ ] CI runs backend tests/build, frontend tests/build, and Playwright.
- [ ] Chromium installation/cache is deterministic on GitHub-hosted Ubuntu runners.
- [ ] All runtime JSON stores are untracked and ignored.
- [ ] E2E uses isolated disposable data.
- [ ] Master V1 journey covers the complete lifecycle.
- [ ] All focused and master journeys pass from a clean install.
- [ ] README and root docs accurately represent the implementation.
- [ ] No production-security claim is made.
- [ ] No Docker, ORM, database, password architecture, AI, or external UI framework is introduced.
- [ ] Final verification leaves a clean working tree.

## 10. Verification plan

### Automated

- Execute every command in Section 7.
- Verify all required CI jobs on the release-readiness PR.
- Download and inspect Playwright artifacts for any retried test.
- Confirm E2E data directory is outside default runtime data.

### Manual

- Review final diff for secrets and runtime records.
- Validate all documentation links.
- Run final responsive/accessibility checklist from Milestone 8.
- Confirm no roadmap feature is represented as implemented without evidence.
- Confirm release statement and limitations appear together.

## 11. Definition of done

Milestone 9 is complete only when every release gate passes locally and in CI, runtime financial data is absent from Git tracking, the master journey is green, documentation is synchronized, the working tree remains clean after verification, and the resulting V1 release is explicitly identified as stable local-development software rather than production financial infrastructure.
