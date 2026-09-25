# Milestone 7 — Persisted Profile & Preferences

## Metadata

| Field | Value |
|---|---|
| Status | Authoritative implementation specification |
| Target branch | `feature/v1-profile-settings` |
| Base branch | Latest `develop` after Milestone 6 is merged |
| Depends on | Milestone 3 persisted users; Milestone 5 budget/currency persistence |
| Required before | Milestone 8 UX/Accessibility Hardening and Milestone 9 Release Readiness |
| Product version | V1 — Track |

## 1. Objective

Bind `/profile` to the authenticated persisted signup identity instead of deriving the display name from the email prefix. Expose a password-safe current-user API and persist the user's supported V1 display currency while retaining system-controlled light/dark appearance.

## 2. Scope

### In scope

- Add protected `GET /users/me`.
- Add protected `PUT /users/me/preferences` for V1 currency selection.
- Return persisted `id`, `username`, normalized `email`, and preferences.
- Never expose password.
- Display exact signup username on Profile.
- Derive initials from persisted username.
- Support INR, USD, and EUR display preferences.
- Keep appearance fixed to `system` for V1.
- Remove the demo-profile disclaimer.
- Add profile loading, saving, success, and error states.
- Keep logout behavior unchanged.

### Out of scope

- Password change/reset architecture.
- Email or username editing.
- Avatar upload.
- Manual light/dark toggle.
- Locale, timezone, notification, or privacy-settings systems.
- Account deletion.
- OAuth, refresh tokens, bcrypt, Argon2, password hashing, JWT redesign, database, ORM, Docker, or deployment work.
- LLMs, AI, and V2/V3 capabilities.
- External UI component libraries.

## 3. Authoritative data contracts

### 3.1 Existing persisted user record

The current local identity record remains internal and must never be returned directly:

```ts
export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
}
```

The existing `backend/data/users.json` schema remains:

```json
[
  {
    "id": 12,
    "username": "Aditya Vardan",
    "email": "aditya@example.com",
    "password": "local-development-plaintext-password"
  }
]
```

The password shown is a schema placeholder, not a credential. Plaintext storage remains local-development-only and is not production-safe.

### 3.2 Public profile response

```ts
export type CurrencyCode = 'INR' | 'USD' | 'EUR';
export type ThemePreference = 'system';

export interface UserPreferences {
  currency: CurrencyCode;
  theme: ThemePreference;
}

export interface UserPublicProfile {
  id: number;
  username: string;
  email: string;
  preferences: UserPreferences;
}
```

Contract rules:

- `id`, `username`, and `email` come from the persisted user matching JWT `sub`.
- `password` is excluded by explicit mapping, never by object spread followed by deletion.
- `email` is the normalized persisted email.
- `theme` is always `system` in V1.
- Currency is read from the Milestone 5 budget configuration; when no record exists, default to `INR`.
- `budgets.json.currency` is the V1 canonical persisted display currency. Do not add a second currency source to `users.json`.

### 3.3 Preferences update request

```ts
export class UpdateUserPreferencesDto {
  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;
}
```

Theme is not accepted in the request because no V1 manual theme choice exists.

### 3.4 Preferences update response

```ts
export interface UpdateUserPreferencesResponse {
  preferences: UserPreferences;
}
```

Updating currency modifies the authenticated user's canonical budget/preferences record while preserving monthly and category limits. If no budget record exists, create the canonical no-budget record defined by Milestone 5:

```json
{
  "userId": 12,
  "monthlyLimit": null,
  "categoryLimits": [],
  "currency": "USD",
  "createdAt": "2026-09-25T18:00:00.000Z",
  "updatedAt": "2026-09-25T18:00:00.000Z"
}
```

V1 performs no currency conversion. Changing currency changes display interpretation only, and the UI must disclose this before saving.

## 4. Backend architecture

### 4.1 Module ownership

Create a dedicated users module so persisted identities are not owned only by authentication wiring:

```text
backend/src/users/
├── dto/
│   └── update-user-preferences.dto.ts
├── users.controller.ts
├── users.controller.spec.ts
├── users.module.ts
├── users.service.ts
└── users.service.spec.ts
```

The existing `UsersService` implementation may be moved from `auth/` to `users/` in this milestone, with imports updated atomically. This is a bounded ownership correction, not a general refactor.

`UsersModule` exports `UsersService`; `AuthModule` imports `UsersModule`. `UsersModule` imports `BudgetsModule` or a narrow exported `BudgetsService` to compose preferences.

### 4.2 API endpoints

#### `GET /users/me`

- Protected by `JwtAuthGuard` at controller level.
- Uses `req.user.userId` only.
- Returns `UserPublicProfile`.
- Missing persisted user returns `404 Not Found`.
- Never returns password, JWT, or internal file paths.

Example response:

```json
{
  "id": 12,
  "username": "Aditya Vardan",
  "email": "aditya@example.com",
  "preferences": {
    "currency": "INR",
    "theme": "system"
  }
}
```

#### `PUT /users/me/preferences`

- Protected by `JwtAuthGuard`.
- Accepts `UpdateUserPreferencesDto`.
- Updates only the authenticated user's currency.
- Preserves all budget limits and timestamps according to BudgetsService rules.
- Returns `UpdateUserPreferencesResponse`.

### 4.3 Service mapping

```ts
function toPublicProfile(user: User, currency: CurrencyCode): UserPublicProfile {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    preferences: {
      currency,
      theme: 'system',
    },
  };
}
```

No public method may return the internal `User` object as an API response.

## 5. Frontend architecture

### 5.1 API service

Create `frontend/src/app/core/profile/profile.service.ts`:

```ts
@Injectable({ providedIn: 'root' })
export class ProfileService {
  getMine(): Observable<UserPublicProfile>;
  updatePreferences(payload: { currency: CurrencyCode }): Observable<UpdateUserPreferencesResponse>;
}
```

### 5.2 Signal-based profile store

```ts
export type ProfileStatus = 'idle' | 'loading' | 'loaded' | 'saving' | 'error';

@Injectable({ providedIn: 'root' })
export class ProfileStore {
  readonly profile: Signal<UserPublicProfile | null>;
  readonly status: Signal<ProfileStatus>;
  readonly errorMessage: Signal<string | null>;
  readonly initials: Signal<string>;

  load(): void;
  updateCurrency(currency: CurrencyCode): Observable<UserPreferences>;
  clear(): void;
}
```

Profile state must be cleared on logout. Components must not decode the JWT for display identity after this milestone.

### 5.3 Initials algorithm

```ts
export function initialsFromUsername(username: string): string {
  return username
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';
}
```

Examples:

| Username | Initials |
|---|---|
| `Aditya Vardan` | `AV` |
| `Prince` | `P` |
| `  Mary   Jane Watson ` | `MJ` |
| Empty defensive fallback | `U` |

### 5.4 Profile UI

- Load profile through `ProfileStore` when `/profile` opens.
- Display persisted username exactly as stored after trimming during signup.
- Display normalized email.
- Display calculated initials.
- Replace static preference rows with a labeled currency select and non-editable `System default` appearance row.
- Save currency with an explicit action and loading state.
- Announce success with `role="status"`; announce failures with `role="alert"`.
- Explain that V1 does not perform currency conversion.
- Remove the `Demo profile` disclaimer.
- Retain Quick links and Logout unless accessibility review requires small corrections.

### 5.5 Currency formatting

Dashboard, History, transaction forms, and Insights must consume the shared selected currency formatter after preference changes. Do not hardcode `₹` in components after this milestone.

Use Angular formatting or a shared formatter with explicit currency code; do not add a formatting library.

## 6. Acceptance criteria

- [ ] `GET /users/me` returns persisted username and normalized email for JWT user.
- [ ] Password is absent from every current-user response and test snapshot.
- [ ] Signup username differing from email prefix displays correctly.
- [ ] Initials derive from username, not email.
- [ ] Currency selection persists across reload and login.
- [ ] Theme remains system-controlled with no manual toggle.
- [ ] Existing budget limits survive a currency preference update.
- [ ] Components no longer decode JWT payload for display identity.
- [ ] Hardcoded currency symbols are replaced by shared formatting where financial values are displayed.
- [ ] Demo-profile disclaimer is removed.
- [ ] Logout clears profile, budget, and metrics stores before navigation.
- [ ] No database, ORM, Docker, password redesign, AI, or external UI library is introduced.

## 7. Verification plan

### 7.1 Backend Jest scenarios

- Map persisted user to public profile.
- Password is never returned.
- Missing user returns 404.
- Controller uses JWT user ID, never request body/query identity.
- GET returns budget currency or default INR.
- PUT updates supported currency.
- PUT rejects unsupported currency.
- PUT preserves monthly/category limits.
- User A cannot read or update user B preferences.
- Existing auth signup/login tests continue passing after module ownership move.

### 7.2 Frontend Vitest scenarios

- ProfileService request contracts.
- Store loading, saving, error, and clear behavior.
- Exact persisted username rendering.
- Initials algorithm cases.
- Currency selection and status/error announcements.
- Appearance remains system default.
- No JWT decoding for profile display.
- Logout clears all user-scoped stores.

### 7.3 Playwright journeys

1. Signup with username `River Stone` and email `different.prefix@example.com`.
2. Login and open Profile.
3. Verify `River Stone`, `RS`, and normalized email.
4. Select USD and save.
5. Reload and verify USD remains selected and financial symbols update.
6. Logout/login and verify persistence.
7. Login as a second user and verify independent default preferences.

### 7.4 Required commands

```bash
cd backend && npm test
cd backend && npm run build
cd frontend && npm test -- --watch=false
cd frontend && npm run build
cd frontend && npx playwright test
```

## 8. Definition of done

Milestone 7 is complete only when persisted identity and currency are served through authenticated APIs, Profile no longer derives identity from JWT email, password exclusion is verified, all financial surfaces use the selected currency, tests/builds/E2E pass, and the branch contains no unrelated account-security or UI redesign work.
