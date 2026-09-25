# Milestone 8 — UX, Responsive & Accessibility Hardening

## Metadata

| Field | Value |
|---|---|
| Status | Authoritative implementation specification |
| Target branch | `feature/v1-accessibility-responsive` |
| Base branch | Latest `develop` after Milestone 7 is merged |
| Depends on | Milestones 4–7 complete dynamic product flows |
| Required before | Milestone 9 V1 Release Readiness |
| Product version | V1 — Track |

## 1. Objective

Harden the complete dynamic V1 application across documented viewport sizes, keyboard interaction, assistive semantics, touch targets, reduced-motion preferences, loading/error states, and expired-session behavior without redesigning the established XPENSE visual system.

## 2. Scope

### In scope

- Validate all V1 routes at 320, 375, 425, 768, 1024, and 1440 pixels.
- Correct overflow, clipping, layout collision, and unreachable controls.
- Enforce a 44×44 CSS pixel minimum target for every interactive control.
- Correct undersized history edit/delete and filter controls.
- Add `prefers-reduced-motion` behavior for animations, transitions, progress, and charts.
- Validate semantic landmarks and heading order.
- Validate keyboard Tab/Shift+Tab, Enter, Space, Escape, and modal focus behavior.
- Standardize `status`, `alert`, `progressbar`, busy, current-page, and expanded-state ARIA.
- Add centralized authenticated API `401` handling.
- Add explicit loading, empty, retry, success, and error states for complete V1 flows.
- Validate system light/dark behavior and contrast.
- Add viewport and keyboard Playwright coverage.

### Out of scope

- Visual redesign, new navigation model, or design-system replacement.
- Manual theme toggle in V1.
- External UI/component libraries.
- Database, ORM, Docker, deployment, bcrypt, Argon2, password hashing, OAuth, or refresh tokens.
- LLMs, AI assistant, automated transaction ingestion, or other V2/V3 work.
- New product features unrelated to accessibility or responsive hardening.

## 2.1 Authoritative contracts

This milestone introduces no backend DTO and no new persisted JSON schema. Existing user, transaction, and budget contracts remain unchanged.

```ts
export type SupportedViewportWidth = 320 | 375 | 425 | 768 | 1024 | 1440;

export interface ViewportVerificationCase {
  width: SupportedViewportWidth;
  height: number;
  expectedNavigation: 'bottom' | 'collapsed-sidebar' | 'expanded-sidebar';
}

export interface SessionExpiryContext {
  reason: 'expired-or-invalid';
  returnUrl: string;
}
```

`SessionExpiryContext` is browser session-state metadata only. It must never be persisted to JSON or sent as an API DTO.

## 3. Viewport verification contract

Every route below must be verified at every required width using a representative phone/tablet/desktop height:

| Width | Reference height | Expected navigation |
|---:|---:|---|
| 320 | 568 | Bottom navigation |
| 375 | 667 | Bottom navigation |
| 425 | 800 | Bottom navigation |
| 768 | 1024 | Collapsed sidebar |
| 1024 | 768 | Expanded desktop layout |
| 1440 | 900 | Expanded desktop layout within `max-w-7xl` |

Routes:

```text
/login
/signup
/forgot-password
/dashboard
/insights
/expenses/new
/expenses/:id/edit
/history
/history/:id
/profile
```

Required behavior:

- No horizontal document scrollbar at any target.
- Main content remains readable without zoom.
- Fixed bottom navigation does not cover content or actions.
- Safe-area bottom padding remains effective on mobile.
- Header, forms, cards, charts, filters, and dialogs stay within viewport.
- Text may wrap but must not overlap icons, controls, or amounts.
- At 768px, collapsed sidebar links remain identifiable by title, accessible name, and focus state.
- At 1024px and 1440px, expanded sidebar labels remain visible.
- Charts remain horizontally contained and bars retain usable focus targets.

## 4. Touch-target contract

All interactive controls must have a rendered hit area of at least 44×44 CSS pixels, including:

- Header buttons.
- Sidebar and bottom-navigation links.
- History filter buttons.
- History detail/edit/delete controls.
- Category/date controls.
- Chart bars that receive focus.
- Modal close controls.
- Password reveal buttons.
- Budget category add/remove controls.
- Currency selection/save controls.

Text-only actions may visually remain compact while padding or a parent button/link supplies the required hit area. Adjacent destructive and edit targets require at least 8px visual separation.

Playwright must assert bounding boxes for the known historically undersized history filters and edit/delete actions.

## 5. Reduced-motion contract

Add a global rule in the existing global stylesheet; do not add an animation library:

```css
@media (prefers-reduced-motion: reduce) {
  html:focus-within {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

Component rules:

- Progress bars and chart bars update immediately under reduced motion.
- Loading indicators remain understandable; a static busy indicator is acceptable.
- No essential state change depends only on animation.
- Hover/focus appearance still changes without requiring movement.

## 6. Semantic and ARIA contract

### 6.1 Landmarks and headings

- Exactly one primary `<main>` per page.
- Auth pages use `<main>` directly; authenticated pages use `AppLayout` main.
- Navigation has distinct accessible names: `Primary navigation` and `Mobile navigation`.
- Each page has one descriptive level-one heading. Shared greeting must not create a competing page-level heading.
- Heading levels do not skip solely for visual sizing.

### 6.2 Live states

| State | Required semantics |
|---|---|
| Form/API error | `role="alert"`; concise actionable text |
| Non-destructive success | `role="status"` and `aria-live="polite"` |
| Loading container | `aria-busy="true"` with visible text |
| Budget/category progress | `role="progressbar"`, min/max/current, descriptive label |
| Current navigation route | `aria-current="page"` |
| Toggle/filter | Native button and `aria-pressed` when appropriate |
| Modal | `role="dialog"`, `aria-modal="true"`, labelled title |

Messages must not disappear before assistive technology can announce them. Color is supplementary, never the only signal.

### 6.3 Form contract

- Every input has a persistent visible label.
- Invalid fields set `aria-invalid="true"` only after interaction/submission.
- `aria-describedby` references field-level help/error text.
- Focus moves to the first invalid field or an error summary after failed submit.
- Disabled state is managed through Angular form APIs for reactive controls, not conflicting template bindings.
- Submit buttons expose visible pending text and cannot double-submit.

### 6.4 Charts

- Chart container describes period and purpose.
- Each keyboard-focusable data point announces period/category and formatted value.
- Focus order follows visual chronological order.
- Empty charts render text, not zero-height unexplained graphics.
- Tooltips shown on hover must also appear on keyboard focus.

## 7. Keyboard interaction contract

All primary journeys must be operable without pointer input.

- `Tab` and `Shift+Tab` follow DOM/visual order.
- Native links activate with Enter.
- Native buttons activate with Enter and Space.
- Escape closes modal/dialog surfaces without saving.
- Opening a modal moves focus to its heading or first control.
- Focus remains inside an open modal.
- Closing restores focus to the opener.
- Route transitions place focus on the destination main heading or main region.
- Focus rings remain visible in light and dark mode.
- No positive `tabindex` values are permitted.

## 8. Centralized 401 handling

### 8.1 Behavior contract

Enhance the existing auth interceptor or add a narrowly scoped authenticated-response interceptor. Use the `SessionExpiryContext` contract from Section 2.1.

For a `401 Unauthorized` response:

1. If the request is `/auth/login` or `/auth/signup`, preserve the normal form error; do not redirect.
2. If the request is an authenticated API request:
   - clear `accessToken` from `sessionStorage`;
   - clear profile, budget, transaction/metrics stores;
   - redirect once to `/login` with `reason=session-expired` and a safe internal `returnUrl`;
   - rethrow the original HTTP error to terminate subscribers correctly.
3. Multiple simultaneous `401` responses cause one clear/redirect operation.
4. Server-side rendering never accesses browser storage or performs browser navigation.
5. Login displays a polite message: `Your session expired. Sign in again to continue.`
6. After successful login, only an internal route beginning with `/` may be used as `returnUrl`; external URLs are rejected and `/dashboard` is used.

No refresh-token behavior is introduced.

### 8.2 Security constraints

- Never place the JWT in a URL, log, error message, or analytics payload.
- Never redirect to an absolute/external return URL.
- Do not clear session for ordinary `400`, `403`, `404`, or `500` responses.

## 9. Contrast and theme contract

- System `prefers-color-scheme` remains the sole V1 theme selection mechanism.
- Normal text meets WCAG AA 4.5:1.
- Large text and essential non-text UI meet 3:1.
- Focus indicators meet 3:1 against adjacent colors.
- Red/amber/green financial states retain text/icon labels.
- Verify emerald controls, zinc secondary text, disabled states, and chart bars in both themes.
- No manual toggle is added.

## 10. Loading, empty, and error-state matrix

Every data route must implement:

| Route | Loading | Empty | Error/retry |
|---|---|---|---|
| Dashboard | Metrics skeleton/text | Add first transaction/set budget CTAs | Visible retry |
| Insights | Metrics skeleton/text | Explain insufficient data | Visible retry |
| History | Transaction loading | First-transaction CTA | Load/delete retry message |
| Detail/Edit | Record loading | Not applicable | Safe not-found and retry |
| Profile | Profile loading | Defensive identity fallback only | Visible retry |
| Budget editor | Existing config loading | Setup form | Save/load retry |

Do not silently transform an API failure into an empty successful state.

## 11. Acceptance criteria

- [ ] All routes pass the six-width viewport matrix with no horizontal overflow.
- [ ] Every interactive target is at least 44×44 CSS pixels.
- [ ] History filters and edit/delete actions meet touch standards.
- [ ] Reduced-motion media behavior is implemented and verified.
- [ ] Keyboard users can complete signup, login, budget, transaction, history, profile, and logout journeys.
- [ ] Landmarks, headings, live regions, progress bars, and navigation state satisfy this contract.
- [ ] Authenticated `401` clears session and redirects once; auth-form `401` remains local.
- [ ] Loading, empty, and failure states are visible and distinct.
- [ ] Light/dark contrast is manually verified and documented.
- [ ] Existing visual hierarchy and design tokens remain intact.
- [ ] No external UI library, database, ORM, Docker, auth expansion, AI, or V2/V3 work is introduced.

## 12. Verification plan

### 12.1 Vitest scenarios

- 401 authenticated request clear/redirect behavior.
- Login/signup 401 exclusion.
- Multiple concurrent 401 deduplication.
- Safe return URL validation.
- SSR path does not access browser globals.
- ARIA status/error/busy/progress states.
- Focus restoration for modal implementation.
- Empty/error/retry component states.

### 12.2 Playwright viewport matrix

Use parameterized projects or tests for all six widths. At each width:

- Navigate authenticated shell routes.
- Assert no `document.documentElement.scrollWidth > clientWidth`.
- Assert correct mobile/sidebar navigation visibility.
- Capture screenshot on failure.

### 12.3 Playwright keyboard journeys

- Signup and login with keyboard only.
- Open/save/close budget editor.
- Add and edit a transaction.
- Filter/open transaction detail.
- Change profile currency.
- Logout.
- Verify visible focus throughout.

### 12.4 Playwright media journeys

- Light system theme.
- Dark system theme.
- Reduced-motion context.
- Session-expiry API response.

### 12.5 Manual checklist

- Screen-reader landmark and heading navigation.
- Contrast measurements for both themes.
- 200% browser zoom at desktop widths.
- Touch target inspection.
- Mobile safe-area behavior on a device/emulator.

### 12.6 Required commands

```bash
cd backend && npm test
cd backend && npm run build
cd frontend && npm test -- --watch=false
cd frontend && npm run build
cd frontend && npx playwright test
```

## 13. Definition of done

Milestone 8 is complete only when the entire dynamic V1 product satisfies the viewport, input, motion, semantics, session-expiry, and state contracts; automated and manual evidence is recorded in the PR; and the branch contains no unrelated feature or visual redesign work.
