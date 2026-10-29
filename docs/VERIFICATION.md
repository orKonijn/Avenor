# Verification record

Verified locally on 28 October 2026 with Node 24.19.0 and installed Chrome on Windows.

- `npm run typecheck`: passed.
- `npm test`: 27 tests passed, including the specification's decimal accounting fixtures, chronological offset ordering, FIFO/splits, missing FX/prices, aggregate holdings, ownership/CSRF, concurrent revisions, idempotency replay, single-use reset, verification, and alert crossing/cooldown.
- `npm run build`: passed with no warnings. Initial output approximately 379 kB raw / 92 kB estimated transferred, plus lazy feature chunks and self-hosted font assets. These are build sizes, not measured page-load budgets.
- `BROWSER_CHANNEL=chrome npx playwright test`: eight tests passed against the production-served application. They cover navigation, sample reconciliation, theme persistence, portfolio/deposit/purchase/edit/audit, watchlists, alert notifications, mobile overflow at 390/320 px, committed-then-502 retry without duplication, and revoked-session private-state clearing.
- Automated axe WCAG A/AA check on the overview: no violations reported. This is not a whole-application accessibility certification.
- `npm audit --audit-level=high`: zero reported vulnerabilities.
- Desktop light/dark and mobile screenshots were inspected. Production CSS loading under CSP was repaired during browser verification.
- Independent code review identified timestamp-ordering, same-asset aggregation, split-fee, session-state, verification-resend, idempotency-retry, stale-response and account-switch issues. These were fixed and re-reviewed; the final targeted review found no remaining blockers in those changes.

Not performed: manual screen-reader testing, complete keyboard/zoom/device matrix, provider integration/outage tests, a deployment penetration test, staging performance measurements, or a production release review. See `IMPLEMENTATION.md` for remaining product and operational work.

## Onboarding and portfolio-alert continuation

- Added domain/API coverage for persisted revision-protected drafts, atomic idempotent completion, invalid openings, unknown-basis FIFO disposal and correction, fixed-currency alerts, flow-neutral daily losses, stale/gapped/zero-base comparisons, and Notify now.
- Browser coverage verifies draft refresh, mobile setup, unknown-basis correction, fixed alert currency after display-currency changes, and notification navigation. Axe checks on setup and alert creation report no violations.
- Actual runtime screenshots are under `docs/changelog/assets/unreleased/`; desktop alert creation and mobile opening holdings were visually inspected.
- One browser run overlapped a production rebuild and failed navigation. Running the complete browser suite after the build completed passed all eight tests. Keep build and browser execution sequential.
- Independent targeted re-review confirmed all four continuation findings resolved: stale-close baselines, setup transaction locking, acquisition dates, and daily-loss threshold bounds. No remaining actionable findings in that scope.

## Portfolio history and mobile holdings increment

- Typecheck, 28 domain/API tests, and production build passed. Decimal sorting regression verifies precision beyond JavaScript numbers and missing-values-last behavior.
- The complete 10-test browser suite passed, followed by all three portfolio-history browser tests after adding a 26-holding pagination fixture (11 unique browser tests total).
- Verified archived history persistence and isolation from active totals; currency filter and table-mode refresh; cards/table pagination and filter reset; no page overflow at 767/390/320 px; axe checks for archive and mobile table.
- Visually inspected actual archive and mobile-table screenshots in `docs/changelog/assets/unreleased/`.
- Independent source review found no actionable correctness or security findings. Existing provider, identity, manual accessibility, and deployment limitations still apply.

## Ledger-history increment

- Typecheck, 35 domain/API tests, and warning-free production build passed. History fixtures cover fee/flow neutrality, corrections, unknown-basis opening capital, same-day splits, missing closes, dated FX, zero bases, date limits and endpoint ownership.
- All 13 browser journeys passed; both history journeys passed again after review fixes. Verified sample reconciliation, unavailable data, currency changes, mobile layout, axe accessibility and stale portfolio-response suppression.
- Independent review identified a same-day split/opening-flow calculation defect. Fixed with regression coverage and re-reviewed with no remaining actionable findings.
- Actual desktop/mobile history screenshots are included in the Unreleased changelog. No live historical provider or production deployment was tested.

## Changelog presentation correction

- Verified GitHub default branch is main and PR #4 merged.
- 36 unit/API tests, build, and all 14 browser journeys passed. Changelog checks cover source text, four screenshot loads, section links, mobile navigation, overflow and axe accessibility.
- Independent review found no actionable issues; accessibility testing identified and fixed missing underlines on screenshot links.
- Desktop and mobile page captures: [desktop](changelog/changelog-page-desktop.png), [mobile](changelog/changelog-page-mobile.png). Historical screenshot assets were preserved.

## Linked portfolio transfers and visible versions

- 40 unit/API tests verify pair integrity, ownership, duplicate replay, revisions, insufficient funds, setup/archive restrictions, backdated replay, aggregate flow treatment, and dependent-activity void rejection.
- Transfer browser journeys verify receipt links, pair voids, uncertain-save retries, and receipt isolation during browser Back; the changelog asserts current version 1.0.0 and planned 1.1.0 Unreleased.
- Independent review identified pending-operation route reuse. Fixed with a browser regression and targeted re-review. Same-currency cash only; no transfer FX or bundled fees.

## Watchlist conflict protection

- Typecheck, 41 calculation/API tests, production build, and dependency audit passed (zero reported vulnerabilities).
- All 18 browser journeys passed on the full-suite rerun. An existing transfer browser-Back assertion failed once in the initial run; all three transfer journeys then passed three repeated runs before the full suite passed. No transfer code was changed in this increment.
- New coverage checks stale edits/deletes, legacy lists without revisions, owner isolation, idempotent retries, and alerts surviving list deletion. A two-tab browser journey verifies conflict recovery, deliberate retry, persistence, no axe violations, and no horizontal overflow at 390 px.
- Independent review of the full change found no actionable findings. Actual conflict screenshot added at docs/changelog/assets/unreleased/watchlist-conflict.png; changelog screenshots load on desktop and mobile with current 1.0.0 and planned 1.1.0 Unreleased labels.
- Manual screen-reader/device coverage and production deployment remain outside this verification.

## Workspace preferences — 29 October 2026

- Typecheck, 42 calculation/API tests, production build, all 20 browser journeys, and dependency audit passed (zero reported vulnerabilities).
- New API coverage verifies legacy density defaults, omitted-field preservation, valid interest choices, duplicate removal, invalid/stale update rejection, explicit clearing, and idempotency.
- Browser coverage checks saved choices after refresh, visible selected interests, measured compact row height, unchanged mobile row height, mobile overflow, axe accessibility, stale forms after workspace refresh, explicit conflict recovery, and returning to onboarding preferences after creating a portfolio.
- Independent review found stale onboarding revisions after portfolio creation and invisible selected-interest styling. Both were fixed and re-reviewed with no remaining blockers.
- Captured and inspected the actual Settings screenshot at docs/changelog/assets/unreleased/workspace-preferences.png. The in-app changelog loads all seven screenshots and displays current 1.0.0 and planned 1.1.0 Unreleased labels on desktop and mobile.
- Personalized news and configurable market coverage remain unfinished. No production release or manual screen-reader review was performed.

## Private live-launch preparation — 29 October 2026

- Typecheck, 51 calculation/API tests, production build and dependency audit passed (zero reported vulnerabilities). All 21 browser journeys passed after fixing public auth configuration requests consuming the credential-attempt rate limit. Regression coverage exercises 35 configuration reads before registration; the global API rate limit remains in force.
- Provider validation and unavailable-data behavior, private registration, session revocation, durable mail retries, expiry and idempotency are covered with local test services. No production email delivery or live provider quotes were verified.
- Independent review identified revoked sessions returning 403 without clearing client state. Fixed to invalidate the session and return 401; re-review found no remaining actionable findings. The rate-limit follow-up also received independent review.
- Executed the online SQLite backup command against a temporary database, checked integrity and read the expected record back from the backup.
- Captured the actual private-workspace unavailable-data screen and refreshed desktop/mobile changelog screenshots. Current version remains 1.0.0; planned 1.1.0 is Unreleased, with eight screenshot entries.
- Hosting is prepared but not deployed. Provider accounts and billing are operator setup steps; no credentials belong in the repository. A free market-data alternative is being evaluated before purchasing Twelve Data. Historical market data, FX, news, continuous alerts, production restart persistence and external backup recovery remain unverified or unimplemented as documented in PRIVATE_LAUNCH.md.
