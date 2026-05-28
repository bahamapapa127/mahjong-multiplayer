# Mahjong Multiplayer — Project Conventions

## What this is

An online multiplayer American Mahjong game (chess.com-style: real-time lobbies of 4, modern
web UI). Server-authoritative; deterministic engine; ship our own starter winning-hands "card"
(NMJL is copyrighted — don't hardcode it).

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node 24 LTS (pinned `.nvmrc`, `engines.node`) |
| Pkg mgr | pnpm 11.x (pinned `packageManager`) |
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript strict (see `tsconfig.base.json`) |
| Lint+format | Biome 2.x — single tool, format on save |
| Tests | Vitest 4 (workspace mode) |
| Git hooks | Lefthook (parallel, single YAML) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |
| Future runtime | Colyseus (server), React + Vite (web) |

## Package map

- `packages/engine` — pure game logic. No I/O, no networking, no global randomness. Must be
  fully simulatable from tests with a seed. Rules spec: [`docs/rules.md`](docs/rules.md).
  Implementation patterns: [`docs/engine-architecture.md`](docs/engine-architecture.md).
- `packages/shared` — types shared between engine, server, and web.
- `apps/server` — *stub*. Will host the authoritative Colyseus server.
- `apps/web` — *stub*. Will host the React + Vite client.

## Common commands

```sh
pnpm install               # install everything
pnpm test                  # run all tests (Turbo-cached)
pnpm test:watch            # interactive Vitest
pnpm typecheck             # turbo run typecheck (Turbo-cached)
pnpm lint                  # biome lint via turbo
pnpm format                # biome format --write across repo
pnpm check                 # typecheck + lint + test + deps:check
pnpm deps:check            # dependency-cruiser: workspace boundary rules
pnpm --filter @mahjong/engine test   # scope to one package
```

After `pnpm install`, lefthook auto-installs the git hooks (`prepare` script).

## Branching & PRs

`main` is protected: required CI, required PR, linear history, no force-push. The flow:

```sh
git checkout -b <type>/<short-desc>
# edit, commit (commit-msg hook enforces conventional commits)
git push -u origin <branch>
gh pr create --base main --head <branch> --title "..." --body "..."
gh pr merge <N> --auto --squash --delete-branch   # only for the tiers below
```

GitHub auto-merges when CI is green and deletes the branch on merge. **PR test plan checklist
should only contain locally-verified items** — never list post-creation outcomes like "CI
green" or "auto-merge fires"; those belong in Notes.

### Auto-merge policy

When Claude opens a PR, it sets the auto-merge flag based on the conventional-commit prefix
of the PR's primary commit:

| Prefix                                                    | Default                                |
|-----------------------------------------------------------|----------------------------------------|
| `docs:`, `chore:`, `build:`, `ci:`, `style:`              | Auto-merge **enabled** on PR creation. |
| `feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `revert:` | Auto-merge **not** enabled — waits for human review before merge. |

For the "not enabled" tier, Claude's end-of-turn note should call out that the PR is open
and unmerged so the human knows to review. The human can flip the default per PR at any
time: "auto-merge this one" enables it; "hold this one" leaves it off.

Renovate's PRs are governed by [`renovate.json`](renovate.json), not by this policy.

## Conventions

- **Engine is pure.** No `Math.random()`, no `Date.now()`, no `process`, no fs/net. Pass a
  seed-able RNG and a clock through the call signature. The server is the source of all I/O.
- **Cards are data.** Winning-hand definitions live in JSON/TS data files, not in if/else
  ladders. New hand variations should not require engine code changes.
- **Strict TS everywhere.** `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are on.
  Embrace explicit types; don't lean on `any` or non-null assertions.
- **No comments unless they explain WHY.** Names and types document the WHAT. Comments are
  for non-obvious constraints, invariants, or workarounds.
- **Tests live next to source.** `tile.ts` and `tile.test.ts` in the same directory.
- **Conventional commits.** Subject prefixed with `feat:`, `fix:`, `chore:`, `docs:`, `test:`,
  `refactor:`, `perf:`, `build:`, `ci:`, or `revert:`. Lowercase subject, 1-100 chars. The
  `commit-msg` hook (commitlint) rejects non-conforming messages.

### Code conventions

How engine and shared code is shaped. Keep these in mind when adding or modifying TypeScript files.

1. **Module layout.** Files follow a fixed top-to-bottom order: imports → types → module-level
   constants (exported when useful elsewhere) → internal helper functions → exported functions.
2. **Export domain-enumeration constants** for closed sets. `Suit` is paired with
   `SUITS: readonly Suit[]`, exported. Tests and other modules import these — never redefine.
3. **Discriminator naming.** Data types use the natural property (`Tile.suit`, `Tile.honor`).
   Structural types (`Action`, `Phase`, `EngineError`) use `kind`.
4. **Test file structure.** Imports → local helpers/fixtures → `fast-check` arbitraries → one
   `describe` per exported function → property tests grouped at the end.
5. **One `it()` per failure mode** when a function has 3+ failure cases. Cleaner reports,
   clearer coverage signal.
6. **JSDoc only on public API**, one line max. Internals get no JSDoc — names and types
   document them.
7. **Factory functions prefixed `make*`** (`makeStandardDeck`, `makeInitialState`, etc.).
   Avoid `create*` / `build*` / bare nouns.
8. **Prefer narrowing over `!` or `as`** for nullable values. `if (x !== null) { use(x) }`
   rather than `use(x!)` or `use(x as T)`.
9. **`/* v8 ignore start/stop */` is allowed for two specific defensive patterns:**
   (a) branches required to satisfy `noUncheckedIndexedAccess` where the index is mathematically
   guaranteed by surrounding logic (see `shuffle` in [`packages/engine/src/rng.ts`](packages/engine/src/rng.ts)),
   and (b) `try/catch` wrappers required by the architecture's throw-and-catch contract before
   any internal handler throws (see `reduce` in [`packages/engine/src/reduce.ts`](packages/engine/src/reduce.ts)).
   Each ignore must carry a `--` comment explaining *why* the branch is unreachable, not just
   *that* coverage is suppressed. Prefer restructuring code to eliminate the ignore over adding
   new ones.

State-internal arrays (`hand`, `wall`, `discards`, `exposures`) are `readonly Tile[]` /
`readonly Exposure[]`. Factory outputs (`makeStandardDeck()`) remain mutable so callers can
shuffle them. Settled in the state-types PR.

## Working with AI agents (Claude Code)

This project uses Claude Code as the primary coding agent. Two rules exist to compensate for
agent failure modes:

- **Context7 before writing code/config for post-cutoff libraries.** The current agent's
  knowledge cutoff is January 2026. Any library whose latest major was released at or after
  that date must be looked up via the Context7 MCP (`mcp__context7__query-docs`) before
  writing non-trivial config or API calls. As of writing, this applies to TypeScript 6,
  Vitest 4, Lefthook 2, fast-check 4, commitlint 21 — and any future library matching the
  rule. Skipping this risks fabricated API shapes that look right but don't exist.
- **`/review` for non-trivial AI-authored PRs.** Renovate / mechanical PRs go straight to
  auto-merge on green CI. PRs that introduce or modify logic should be run through the
  `/review` skill before merging — CI catches typecheck/lint/test, not design issues, dead
  code, or weird abstractions.

## Glossary (American Mahjong)

- **Tile**: one physical playing piece. 152 total in a standard American set.
- **Suit**: cracks (crak), dots (dot), bams (bam) — 1-9, four of each.
- **Honors**: winds (N/E/S/W) and dragons (red/green/white) — four of each.
- **Flowers**: 8 special tiles, no suit; usually scored or used to swap for jokers.
- **Jokers**: 8 wild tiles, usable only in certain hands depending on the card.
- **Card**: the published list of legal winning hands for the year. Players must match one
  exactly to win. Ours is custom; never use the NMJL card.
- **Charleston**: opening tile-passing ritual before play begins.
- **Pung / Kong / Quint**: 3 / 4 / 5 of a kind.

## Don'ts

- Don't add I/O or global state to `packages/engine`.
- Don't hardcode the NMJL card (copyright). Use the `packages/engine/cards/` data files.
- Don't use `Math.random()` anywhere in the engine — pass a seeded RNG.
- Don't use `// @ts-ignore` or `as any`. Prefer narrowing or fixing the type.
- Don't bypass git hooks with `--no-verify` unless the user explicitly asks.
- Don't commit to `main` directly. Branch + PR + green CI.
- Don't write non-conventional commit messages. The hook will reject them.

## Setup history

The original project-setup plan (with rationale for every tooling choice) lives at
`C:\Users\apmil\.claude\plans\i-was-working-in-nested-cherny.md`. Read it if you need to
understand WHY a tooling decision was made before changing it.

## Automation already wired

- **Format on save** in VSCode (Biome) + PostToolUse hook auto-formats every file Claude edits.
- **PreToolUse hook** blocks foot-gun Bash patterns (`rm -rf /`, force-push to main, etc.).
- **Sensitive-path edits prompt** — `.github/`, `lefthook.yml`, `renovate.json`, root
  `package.json`, etc. require per-touch confirmation via Claude's `ask` permission.
- **Pre-commit**: Biome on staged files + Turbo typecheck on affected packages.
- **Commit-msg**: commitlint enforces conventional-commits format.
- **Pre-push**: full `pnpm check` (typecheck + lint + test + dep-cruiser).
- **Engine purity is enforced.** [`packages/engine/src/purity.test.ts`](packages/engine/src/purity.test.ts)
  scans non-test engine source for banned identifiers (`Math.random`, `Date.now`,
  `process.*`, `crypto.*`, etc.).
- **Engine coverage threshold = 100%.** Configured in
  [`packages/engine/vitest.config.ts`](packages/engine/vitest.config.ts). Engine test script
  runs `--coverage` by default, so the gate fires on every check.
- **Module boundaries** enforced by [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs):
  engine cannot import Node built-ins, engine cannot import from apps, shared cannot
  import from anywhere else, no circular deps.
- **CI**: GitHub Actions runs `pnpm check` + dependency-review on every PR with Turbo cache.
  Actions are SHA-pinned (not tag refs) and Renovate-maintained.
- **Branch protection**: `main` requires CI green + PR + linear history; auto-merge available.
- **Renovate**: weekly Monday grouped dep PRs; patches auto-merge on green CI; lock-file
  maintenance auto-merges; major bumps need manual review.
- **MCP**: Context7 available for fetching up-to-date library docs (and mandated by the
  rule above for post-cutoff libraries).
- **Security posture** documented in [`SECURITY.md`](SECURITY.md) with the deferred-items
  roadmap.
