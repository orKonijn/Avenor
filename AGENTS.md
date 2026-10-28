# Git, Changelog, Commits, Branches, and Code Review

Follow this workflow whenever you implement changes in a Git repository. Handle branching, changelog updates, verification, code review, and local commits as part of completing the task.

Use existing repository conventions where they are established; apply the defaults below where conventions are missing. Follow my explicit task instructions and preserve authorization already provided in the conversation.

For requests that only ask for advice, investigation, or code review, report your findings without making changes or commits unless requested.

## 1. Inspect the repository before making changes

- Read applicable `AGENTS.md`, contribution guidelines, PR templates, and relevant development instructions.
- Inspect the current branch, working tree, staged changes, upstream, and recent commits.
- Identify the intended integration branch from the repository or task context. Do not assume it is named `main`.
- Understand the repository’s testing, formatting, changelog, and release conventions before introducing new ones.
- Preserve existing user changes, including staged changes and edits in files you also need to modify. Include existing work in your commits only when it belongs to the requested task.
- Keep the change focused. Separate unrelated refactoring, formatting, and dependency upgrades from the requested work.

## 2. Branch strategy

Use one short-lived branch per coherent task.

- Continue on the existing task branch when the request extends the same task or PR.
- Create a new branch for a separate feature, bug fix, or independent task.
- Follow the repository’s branch naming convention. Otherwise use:
  - `codex/feat/<short-description>`
  - `codex/fix/<short-description>`
  - `codex/refactor/<short-description>`
  - `codex/docs/<short-description>`
  - `codex/chore/<short-description>`
- Start new independent work from the intended integration branch. Refresh its remote reference when available; disclose when you are working from a potentially outdated local reference.
- Use a separate worktree when concurrent work or unrelated local changes make isolation useful.
- Keep ordinary implementation commits on the task branch. Commit directly to the integration branch only when explicitly instructed.
- Preserve the user’s working tree and index. Do not automatically stash, discard, reset, or move unrelated changes to make branching easier.
- If synchronization causes conflicts, resolve them using the intended behavior of both changes. Escalate only conflicts that require a decision you cannot infer.

## 3. Changelog

Document meaningful changes as part of implementing them.

- Use the repository’s existing mechanism: `CHANGELOG.md`, Changesets, release-note fragments, or another established system.
- If no mechanism exists, create `CHANGELOG.md` with an `Unreleased` section.
- For a manually maintained changelog, use relevant categories: `Added`, `Changed`, `Fixed`, `Deprecated`, `Removed`, and `Security`. Include only categories with entries.
- Describe the observable change and its impact in clear language.
- Record breaking changes, configuration changes, and migration steps explicitly.
- Update the changelog before committing the corresponding change. Include the entry in the same logical commit when practical.
- Keep one concise entry per meaningful change. Refine an existing unreleased entry when subsequent commits adjust the same behavior.
- Internal cleanup, formatting, and test-only changes generally do not need entries unless the repository requires them.
- Follow the existing release tooling for generated changelogs. Do not introduce a second source of release notes.
- Assign versions, release dates, and tags only as part of an authorized release task.

Example entry:

`Fixed: Prevent duplicate order submissions when the checkout button is clicked repeatedly.`

## 4. When to commit

Create commits automatically as part of implementation.

- Commit after completing a coherent, reviewable unit of work and running the relevant checks.
- For a small task, prefer one commit containing the implementation, relevant tests, documentation, and changelog entry.
- For a larger task, create multiple commits at meaningful milestones. Each commit should have a clear purpose and leave the project in a usable state.
- Commit completed work before switching to an unrelated task and before handing the finished task back to me.
- Choose commit boundaries based on logical changes. Avoid arbitrary commits after every edit or fixed time interval.
- Keep a failing regression test together with the fix when committing them separately would leave a broken intermediate state.
- Do not create empty commits or unnecessary checkpoint commits.
- If unfinished checkpoint commits are explicitly requested, label and describe their incomplete state clearly.

Before each commit:

1. Run checks appropriate to the change, such as targeted tests, linting, type checking, or a build.
2. Fix failures introduced by your changes.
3. Stage only the intended files or hunks.
4. Inspect the staged diff for correctness, unrelated changes, secrets, accidental debug code, and unnecessary generated files.
5. Check for whitespace errors and unresolved conflict markers.
6. Confirm that relevant documentation and changelog changes are included.

If verification is blocked by unavailable infrastructure or demonstrated pre-existing failures, you may preserve completed work in a local commit after the available checks. Record the limitation clearly in the commit description and handoff. Do not claim that unavailable or failing checks passed.

Preserve the configured Git author identity and normal timestamps.

## 5. Commit messages

Follow the repository’s convention. Otherwise use:

`type(scope): imperative summary`

Use an appropriate type: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, or `chore`. Include a scope when it adds useful context.

Keep the subject specific and preferably under 72 characters. Every implementation commit should have a concise body explaining:

- **Why:** The problem or reason for the change.
- **What:** The meaningful changes and resulting behavior.
- **Validation:** The checks actually performed and their outcomes.
- **Compatibility:** Breaking changes or migration requirements, when relevant.

Reference real issue or ticket identifiers when available.

Example:

```text
fix(auth): prevent duplicate token refresh requests

Why:
Concurrent expired requests could start competing token refreshes,
causing intermittent sign-outs.

What:
Share one in-flight refresh operation and retry waiting requests
after it completes.

Validation:
Passed the auth unit tests, type checking, and linting.
Added regression coverage for concurrent expired requests.
```

For breaking changes, use the repository’s required notation. If it follows Conventional Commits, include `!` in the subject and a `BREAKING CHANGE:` footer explaining the impact and migration.

## 6. Code Review Rules

Review your work before declaring the task complete or publishing it for review.

- Review the complete task diff against the correct base, including interactions across commits. Include any remaining uncommitted task changes in your assessment.
- Check correctness, edge cases, error handling, security, compatibility, data integrity, performance, and maintainability where relevant.
- Confirm that tests cover meaningful behavior and regressions. Add tests when they provide useful protection; avoid tests that merely mirror implementation details.
- Check that documentation and changelog entries accurately describe the final behavior.
- Use an independent reviewer or review agent when available and useful. Distinguish independent review from self-review.
- Report actionable findings with severity, file and line references, concrete impact, and supporting evidence.
- Separate defects from optional improvements. Do not invent findings or treat personal style preferences as bugs.
- Fix confirmed, in-scope defects and rerun affected checks. Re-review changed areas after fixes.
- Disclose unresolved findings and verification gaps. Do not mark work ready for merge while known blocking defects remain.
- If no actionable findings remain, say so directly and identify any material limits of the review.
- Self-review does not replace required external approvals.

For review-only requests, present findings first and avoid modifying the branch unless asked to fix them.

## 7. Pushes, PRs, and merging

- Push the task branch and create or update its PR when the task or standing instructions authorize that workflow.
- Reuse authorization already provided. Do not ask again for every commit, push, or PR update within the authorized scope.
- If remote publication is outside the current scope, finish the local work and provide a proposed PR title and description.
- Use the repository’s PR template. Explain the problem, changes, resulting behavior, validation, and any relevant migration steps or risks.
- Include screenshots or recordings when they materially help review a UI change.
- Keep incomplete work in a draft PR. Report required CI results accurately when they are available.
- Address review feedback in focused follow-up commits and update the PR description when its scope or behavior changes.
- Merge PRs, enable auto-merge, create releases, or publish tags only when explicitly authorized.
- Preserve published history. Rewriting shared commits or force-pushing requires explicit authorization.
- Follow required checks and branch protections without bypassing them.

## 8. Final handoff

End each implementation task with a concise report containing:

- **Changes:** What changed and why.
- **Branch:** The branch used.
- **Commits:** Actual short commit hashes and subjects.
- **Changelog:** What was added or why no entry was needed.
- **Validation:** Checks performed, outcomes, and limitations.
- **Code review:** Review performed, fixes made, and unresolved findings.
- **Remote status:** Whether work was pushed, the PR link if created, and its current state.
- **Remaining work:** Any blockers or decisions still needed.

Ensure all completed task changes are committed. Preserve unrelated user work, and distinguish it from any unfinished task changes.

Never claim a commit, push, test, review, or merge succeeded without verifying the result.