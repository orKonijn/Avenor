# Changelog

## Unreleased

### Added

- Angular investment workspace with responsive navigation, light/dark/system themes, sample overview, portfolios, analysis, discovery, asset detail, watchlists, alerts, notifications, and settings.
- Persistent, isolated demo accounts and a server-authoritative decimal ledger with FIFO accounting, backdated validation, paired FX legs, split events, immutable correction history, and duplicate-save protection.
- Holdings filters and allocation with explicit missing-data coverage; synthetic charts and sample quotes are labeled throughout.
- Server-side sample price-crossing evaluation, recurring reset/cooldown rules, and in-app notification read state.
- Calculation/API/browser regression tests, CI checks, setup documentation, and a specification coverage/release checklist.
- Root `AGENTS.md` containing the user's Git, changelog, branch, commit, code-review, and handoff workflow for future Codex work.

### Security

- Object ownership, CSRF protection, same-site HttpOnly sessions, secure production cookies, password hashing, rate limits, CSP, single-use expiring recovery tokens, and revision-protected server state.
- Real registration remains disabled until an email adapter is configured. No production market feed or financial-history export is implied by the sample workspace.
