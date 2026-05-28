# Workflow

This project is a single-developer + AI-assistant collaboration. The cadence for engine work (and similar bottom-up implementation) is **issue-driven asynchronous PRs** with a rolling 1-2 issue backlog.

## The cycle

1. **Draft.** Claude proposes the next issue body in chat — one issue at a time, not batched.
2. **Approve.** Developer reads, redirects if needed, says "file it."
3. **File.** Claude creates the issue via `gh issue create` using the template at [`.github/ISSUE_TEMPLATE/engine-task.md`](../.github/ISSUE_TEMPLATE/engine-task.md).
4. **Implement.** Developer says "implement issue #N" (or equivalent). Claude checks out a fresh branch off `main`, implements against the issue's acceptance criteria, runs `pnpm check` locally, opens a PR with `Closes #N` in the body. The PR body's test plan lists only items verified locally before push (`pnpm check` passed, specific behaviors observed). Post-creation outcomes — "CI green", "auto-merge fires", "branch deleted" — belong in Notes, not the test plan.
5. **Review.** Developer reviews the PR (browser, mobile, or `gh pr view`), merges or comments.
6. **Iterate.** On merge, the cycle repeats with the next issue.

## Rolling window, not batch

Only 1-2 issues exist in the backlog at any time. Batch-filing all upcoming engine issues was considered and rejected: implementation learnings from PR N inform issue N+1, and stale issues are worse than absent ones.

## Deferring cleanups

When an audit, review, or implementation surfaces a cleanup that isn't worth doing now, name the trigger condition that would make it worth doing later — *"extract X at N=2"*, *"move Y to a shared module when the discard handler lands"*. Deferrals without a trigger become permanent debt; deferrals with one come back into focus the moment the condition fires.

## Specs are authoritative; issues are tactical

[`docs/rules.md`](rules.md) and [`docs/engine-architecture.md`](engine-architecture.md) are the long-term spec. Issues reference them and add per-PR detail (scope, acceptance criteria, gotchas). When in doubt, the spec wins and the issue gets corrected.

## Code conventions

The 8 conventions in [`CLAUDE.md` → Code conventions](../CLAUDE.md#code-conventions) shape what code in any PR should look like. The engine-task template doesn't repeat them; Claude is expected to follow them by default.

## Phone-first workflow (deferred)

Eventual goal: developer files an issue from phone → an Anthropic Routine triggers Claude on cloud infrastructure → PR appears → developer reviews on phone. See `claude.ai/code/routines` with a GitHub `issues.opened` trigger.

Not enabled yet. We validate the manual cycle first; after 2-3 successful PR cycles confirm the issue template and code conventions hold up, we set up the routine. Automating before validation risks autonomous PRs against an unproven template.

## Reading order for a new Claude session

1. [`CLAUDE.md`](../CLAUDE.md) — stack, conventions, automation already wired (auto-loaded by Claude Code)
2. [`docs/rules.md`](rules.md) — engine-scoped American Mahjong rules and the `RuleConfig` toggles
3. [`docs/engine-architecture.md`](engine-architecture.md) — engine implementation patterns: state shape, action surface, phase machine, card schema
4. This file — workflow process
5. `gh issue list` and `gh pr list` — current state of work in flight
6. `git log --oneline -20` — what's recently landed

The engine implementation roadmap (sketched in `docs/engine-architecture.md` "Module organization", elaborated in chat) is bottom-up: **Tile → seeded RNG + shuffle → Wall → Result / EngineError → state shape → reducer → Charleston → turn flow → claim resolution → win validation → dead-hand → replay + integration tests.** `Tile` landed in PR #20.
