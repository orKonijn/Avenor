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
