# Security

This repository is currently **private**. A vulnerability disclosure channel
will be added if and when the repository becomes public — until then, security
issues can be raised by the repository owner directly through normal commits or
issues.

## Approach

The security posture is documented here so future contributors (and future me)
don't have to re-derive what's already been decided.

- **Server-authoritative.** The game engine in `packages/engine` is pure and
  deterministic. The future Colyseus server in `apps/server` is the single
  source of truth for all game state. Clients send requests and receive state
  updates; clients never tell the server what is true.
- **Engine purity is enforced, not just documented.**
  [packages/engine/src/purity.test.ts](packages/engine/src/purity.test.ts)
  scans non-test engine source for banned identifiers (`Math.random`,
  `Date.now`, `process.*`, `crypto.*`, etc.).
  [.dependency-cruiser.cjs](.dependency-cruiser.cjs) enforces structural
  rules (no Node built-ins in engine, no cross-layer imports, no circular
  dependencies).
- **Secrets are never committed.** `.env*` files are git-ignored. GitHub
  secret-scanning push protection is enabled at the repository level to catch
  accidental commits before they hit the remote.
- **Dependencies are reviewed.**
  [Renovate](renovate.json) manages updates with patch auto-merge on green CI;
  Renovate's `vulnerabilityAlerts` is enabled. New deps introduced by PRs are
  checked against known vulnerabilities by
  [.github/workflows/dependency-review.yml](.github/workflows/dependency-review.yml),
  which fails the PR on `high`-severity findings.
- **CI integrity.** GitHub Actions in
  [.github/workflows/](.github/workflows/) are pinned to commit SHAs (not
  moveable tags) to defend against action-supply-chain attacks. Renovate
  bumps SHAs via reviewable PRs.
- **Branch protection.** `main` requires CI green, requires a PR, requires
  linear history, and rejects force-pushes.
- **Irreversible operations are denied.**
  [.claude/settings.json](.claude/settings.json) denies `pnpm/npm/yarn
  publish` and `gh repo/release delete` for the Claude Code agent that
  operates on this repo.

## Deferred (with trigger)

The following will be addressed when the related code lands:

| Area | Trigger |
|---|---|
| Vulnerability disclosure channel + `SECURITY.md` reporting section | Repository becomes public |
| GitHub private vulnerability reporting | Repository becomes public |
| CodeQL / SAST | Server or web has real code (CodeQL gives ~zero signal on a pure functional engine) |
| Runtime input validation at network boundary (Zod schemas) | Server has message handlers |
| Runtime input validation for JSON data files (Zod schemas) | Engine starts loading card data files |
| Authentication / session handling | User accounts are added |
| CSRF / CORS / rate limiting | Web client + server both exist |
| Database security (parameterized queries, least-privilege role) | DB is wired (planned to use Drizzle, which parameterizes by default) |
| TLS / HTTPS | Production deployment |
| Anti-abuse (DDoS, WAF) | Production deployment with public traffic |
| Penetration testing | Before opening play to anyone outside trusted testers |
