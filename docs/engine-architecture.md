# Mahjong Engine — Architecture

## Purpose & scope

This document specifies the internal shape of the engine in [`packages/engine`](../packages/engine). It is the implementation companion to [`docs/rules.md`](rules.md) — that doc says *what* the rules are; this one says *how the engine encodes them*.

If you're touching engine internals, read this first. If you're touching gameplay rules, read [`rules.md`](rules.md).

## Core principles

Four hard rules govern the engine. The first three come from [`CLAUDE.md`](../CLAUDE.md):

1. **Purity.** No `Math.random`, no `Date.now`, no `process`, no I/O, no global state. Every input is explicit; every output is the returned value.
2. **Determinism.** Given the same `(initialState, seed, actions[])`, the engine produces identical state every time. This is the foundation of replay, anti-cheat, and reproducible tests.
3. **Cards are data.** Winning hands are JSON-loadable, never hardcoded.
4. **Server-authoritative.** The engine assumes nothing about who is calling it. It validates every action against current state and returns errors as data.

[`packages/engine/src/purity.test.ts`](../packages/engine/src/purity.test.ts) scans non-test source for banned identifiers and fails CI if any appear. [`.dependency-cruiser.cjs`](../.dependency-cruiser.cjs) forbids engine from importing apps or Node built-ins.

---

## Public API

A small surface. Everything else is internal.

```ts
// packages/engine/src/index.ts (sketch)
export type { GameState, Action, EngineError, RuleConfig, Card, Hand };

export function makeInitialState(opts: InitOptions): GameState;
export function reduce(state: GameState, action: Action): Result<GameState, EngineError>;
export function replay(initial: GameState, actions: Action[]): Result<GameState, EngineError>;
export function validateCard(card: Card): Result<void, CardValidationError[]>;
```

Four functions: build initial state, apply an action, replay a sequence, validate a card.

---

## Result type

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

One line, no dependency. Used at every public-API boundary where an operation can fail with a typed reason. Internal helpers may throw "shouldn't-happen" errors that the top-level `reduce` catches and converts to `Result.error`.

---

## GameState

The full current-game snapshot. Immutable; the reducer returns a new instance per call.

```ts
type GameState = {
  config: RuleConfig;
  seed: string;                // for the seeded RNG; preserved for the duration
  card: Card;                  // active card; loaded at init, immutable

  wall: Tile[];                // remaining tiles, drawn from index 0
  discards: Tile[];            // all discards in order, oldest first

  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  east: PlayerId;              // 0..3
  currentTurn: PlayerId;       // whose turn it is

  phase: Phase;
};

type PlayerState = {
  id: PlayerId;                // 0..3
  hand: Tile[];                // concealed; order is irrelevant to logic
  exposures: Exposure[];       // face-up groups
  isDead: boolean;
};

type Exposure = {
  groupSize: 3 | 4 | 5;
  baseTile: Tile;              // what this group "is" (always a real tile, since the anchor was a claimed discard)
  jokerSlots: number;          // count of jokers in the exposure; each represents baseTile
};

type Phase =
  | { kind: 'charleston'; step: CharlestonStep }
  | { kind: 'awaitingTurnAction'; player: PlayerId; cameFrom: 'wall' | 'claim' }
  | { kind: 'awaitingClaimWindow'; discarder: PlayerId; tile: Tile }
  | { kind: 'terminal'; outcome: GameOutcome };

type CharlestonStep =
  | { kind: 'collecting';
      passIndex: 0|1|2|3|4|5;
      received: Partial<Record<PlayerId, { tiles: Tile[]; blind: boolean }>>;
    }
  | { kind: 'stopWindow' }              // after pass index 2, before pass index 3
  | { kind: 'courtesy'; offers: Partial<Record<PlayerId, 0|1|2|3>> };

type GameOutcome =
  | { kind: 'mahjong'; winner: PlayerId; handId: string; claimedFrom: 'wall' | PlayerId }
  | { kind: 'wallGame' };
```

Notes:
- `players` is a fixed 4-tuple. American Mahjong is always 4-player.
- `PlayerId` is `0 | 1 | 2 | 3`, indexing into `players`.
- Turn order is counterclockwise; `(currentTurn + 1) % 4` is next.
- East is **chosen by the seeded RNG** at first-hand init; subsequent hands take East as an input.
- `phase` is discriminated; `reduce` matches `phase.kind` to validate which actions are legal at any moment.
- **No `history` field.** The action log lives outside the engine (server-owned); engine state is current-only.

---

## Tile representation

```ts
type Tile =
  | { suit: 'crak' | 'bam' | 'dot'; value: 1|2|3|4|5|6|7|8|9 }
  | { honor: 'wind'; wind: 'N'|'E'|'S'|'W' }
  | { honor: 'dragon'; color: 'red'|'green'|'white' }
  | { honor: 'flower' }
  | { honor: 'joker' };
```

Tiles are **value types** — two tiles are equal iff their data is equal. No unique IDs. Multiple copies in the deck are indistinguishable to the engine.

If the client needs per-tile identity (for animations of specific tiles moving across the table), it tracks that separately; the engine doesn't carry IDs.

---

## Action surface

```ts
type Action =
  | { kind: 'charlestonPass'; player: PlayerId; tiles: Tile[]; blind: boolean }
  | { kind: 'charlestonHalt'; player: PlayerId }
  | { kind: 'courtesyPassDeclare'; player: PlayerId; count: 0|1|2|3 }
  | { kind: 'jokerSwap'; player: PlayerId; swaps: JokerSwap[] /* non-empty */ }
  | { kind: 'discard'; player: PlayerId; tile: Tile }
  | { kind: 'declareMahjongSelfPick'; player: PlayerId; handId: string }
  | { kind: 'resolveClaimWindow';
      discarder: PlayerId;
      intents: Record<PlayerId, ClaimIntent>;
    }
  | { kind: 'challengeDeadHand'; challenger: PlayerId; target: PlayerId };

type JokerSwap = {
  exposureOwner: PlayerId;
  exposureIndex: number;             // index into PlayerState.exposures
  ownTile: Tile;                     // tile from caller's hand
};

type ClaimIntent =
  | { kind: 'pass' }
  | { kind: 'claimMahjong'; handId: string }
  | { kind: 'claimExposure';
      groupSize: 3 | 4 | 5;
      ownTilesUsed: Tile[];           // ownTilesUsed.length + 1 === groupSize
    };
```

Eight actions. Each represents a real player decision. Procedural transitions (draw from wall, claim-window timing, charleston pass completion) are **not** actions — the reducer applies them implicitly.

---

## Phase machine

```text
[charleston: collecting 0..2] ─→ [stopWindow] ─→ [charleston: collecting 3..5]
                                      │                  │
                                      │ (halted)         │ (completed)
                                      ▼                  ▼
                                 [courtesy] ◀────────────┘
                                      │
                                      ▼
                            [awaitingTurnAction: East]
                                      │
                ┌─────────────────────┴────────────────────┐
                │                                          │
                ▼ (discard)                                ▼ (declareMahjongSelfPick)
       [awaitingClaimWindow]                        [terminal: mahjong]
                │
       ┌────────┴─────────┐
       │ (all pass)       │ (claim wins)
       ▼                  ▼
[awaitingTurnAction:   [awaitingTurnAction:
  next, cameFrom:        claimer, cameFrom:
  'wall']                'claim']
       │
       │ (wall empty)
       ▼
[terminal: wallGame]
```

`jokerSwap` and `challengeDeadHand` are valid in many phases; see reducer behavior below.

### Auto-transitions inside the reducer

Three places the reducer makes implicit transitions:

1. **Auto-draw from wall.** When transitioning into `awaitingTurnAction` with `cameFrom: 'wall'`, the reducer pops the next wall tile into the player's hand. No explicit `draw` action.
2. **Wall exhaustion check.** Each transition out of `awaitingClaimWindow` checks if the wall is empty after the implicit auto-draw would happen. If empty and no claim was made, phase → `terminal: wallGame`.
3. **Charleston pass completion.** When all 4 players have submitted tiles for a given pass, the reducer applies all 4 swaps simultaneously and transitions to the next step (next pass, stop window, courtesy, or out of Charleston).

---

## The reducer

```ts
function reduce(state: GameState, action: Action): Result<GameState, EngineError> {
  // 1. Validate action against current phase.
  // 2. Validate player permission (right player; dead-status check; etc.).
  // 3. Apply action-specific logic; may include auto-transitions.
  // 4. Return new state.
}
```

Per-action handlers (`reduceCharlestonPass`, `reduceDiscard`, `reduceJokerSwap`, etc.) handle their slice. Internal helpers may **throw** "shouldn't-happen" assertion errors; the top-level `reduce` catches and converts to `Result.error` of kind `unknown`. This keeps internal code linear without sacrificing the typed-error contract at the API boundary.

---

## Errors

```ts
type EngineError =
  | { kind: 'wrongPhase'; expected: Phase['kind'][]; actual: Phase['kind'] }
  | { kind: 'notYourTurn'; expected: PlayerId; actual: PlayerId }
  | { kind: 'tileNotInHand'; player: PlayerId; tile: Tile }
  | { kind: 'invalidDiscard'; tile: Tile; reason: string }
  | { kind: 'invalidExposure'; reason: string }
  | { kind: 'invalidJokerSwap'; reason: string }
  | { kind: 'mahjongInError'; handId: string; reason: string }
  | { kind: 'invalidCharlestonPass'; reason: string }
  | { kind: 'deadPlayerAction'; player: PlayerId }
  | { kind: 'failedDeadHandChallenge'; target: PlayerId }
  | { kind: 'unknown'; message: string };
```

All errors are **serializable data**. They cross the network to the client as JSON. The server relays them back to the originating player.

---

## RNG

```ts
// packages/engine/src/rng.ts (sketch)
export function makeSeededRng(seed: string): () => number;   // uniform [0, 1)
export function shuffle<T>(items: readonly T[], rng: () => number): T[];
```

A small deterministic PRNG (mulberry32 or splitmix32; cheap, ~10 lines). The seed is a string in `GameState.seed`, set by `makeInitialState` from session info.

Randomness shows up in only two places:
1. The initial wall shuffle.
2. East selection at first-hand init.

After init, the engine is fully deterministic on the action sequence.

---

## Replay

```ts
export function replay(initial: GameState, actions: Action[]): Result<GameState, EngineError> {
  let state = initial;
  for (const action of actions) {
    const result = reduce(state, action);
    if (!result.ok) return result;
    state = result.value;
  }
  return { ok: true, value: state };
}
```

Three uses:
- **Tests** — fold actions onto an initial state, assert on result.
- **Resume from snapshot** — server stores `{ initial, log }`, rehydrates on reconnect.
- **Dev tools** — time-travel debugger walks the log and renders intermediate states.

---

## Card schema

Expanded from [`rules.md` §9](rules.md#9-the-card-data-shape).

```ts
type Card = {
  id: string;                   // e.g., "mahjong-custom-2026"
  name: string;
  version: string;
  hands: Hand[];
};

type Hand = {
  id: string;                   // stable identifier across versions
  name: string;
  category: string;             // e.g., "2468", "Like Numbers", "Year"
  concealed: boolean;
  allowJokers: boolean;
  bindings: Binding[];          // declared variables
  groups: GroupSpec[];          // total tile count across all groups must equal 14
};

type Binding = {
  name: string;                 // e.g., "S", "N", "S1", "S2"
  domain: Domain;
  constraints?: Constraint[];
};

type Domain =
  | { kind: 'suit' }                                  // any of 'crak' | 'bam' | 'dot'
  | { kind: 'number'; values: number[] }              // subset of 1..9
  | { kind: 'wind' }
  | { kind: 'dragon' };

type Constraint =
  | { kind: 'distinct'; from: string[] }
  | { kind: 'equals'; to: string };

type GroupSpec = {
  size: 1 | 2 | 3 | 4 | 5;
  allowJokers: boolean;         // engine forces false for size <= 2 at validation
  contents: TileExpr[];         // length === size
};

type TileExpr =
  | { kind: 'literal'; tile: Tile }
  | { kind: 'suited'; suit: SuitRef; value: NumberRef }
  | { kind: 'wind'; wind: WindRef }
  | { kind: 'dragon'; color: DragonColorRef }
  | { kind: 'flower' };

type SuitRef = { fixed: 'crak'|'bam'|'dot' } | { var: string };
type NumberRef = { fixed: number } | { var: string };
type WindRef = { fixed: 'N'|'E'|'S'|'W' } | { var: string };
type DragonColorRef = { fixed: 'red'|'green'|'white' } | { var: string };
```

Detailed `TileExpr` design will be finalized when we author the first 5-10 hands. The shape above is sufficient for the constraint solver and validator.

### Authoring helpers

To keep cards readable in source form, the engine exports helper functions:

```ts
// packages/engine/src/card-helpers.ts (sketch)
export const pung = (tile: TileExpr): GroupSpec =>
  ({ size: 3, allowJokers: true, contents: [tile, tile, tile] });

export const pair = (tile: TileExpr): GroupSpec =>
  ({ size: 2, allowJokers: false, contents: [tile, tile] });

export const suited = (suit: string | Suit, value: string | number): TileExpr => ...;
// etc.
```

Authors write `pung(suited("S", "N"))`; the underlying data is still structured JSON.

### Win-matching algorithm

The win-check is a small constraint-satisfaction problem:

1. For each `Hand` on the card, attempt to bind each declared variable to a value from its `Domain`, subject to `Constraint`s.
2. For each successful binding, check that the player's 14 tiles satisfy the `groups` under that binding.
3. If any binding satisfies the hand, the player has matched it.

For 14 tiles × ~5 variables per hand × ~70 hands per card, basic backtracking runs in microseconds. No need for an industrial-strength CSP solver.

---

## Card validator

`validateCard(card: Card)` checks structural invariants:

- Each hand's `groups` total exactly 14 tiles.
- Every variable name referenced in `groups` is declared in `bindings`.
- Domains are non-empty.
- `Constraint.from` and `Constraint.to` references point to existing bindings.
- Group `size <= 2` has `allowJokers === false`.

Runs once at card load. Failure aborts game start. ~50 lines, prevents authoring bugs.

---

## Module organization (sketch)

Not prescribing exact filenames; describing rough shape so an implementer knows where things land.

| Concern | What lives there |
|---------|------------------|
| Types | Central type definitions for `GameState`, `Action`, `Card`, etc. |
| State | `makeInitialState`, immutable update helpers |
| Reducer | Top-level `reduce` plus per-action handlers |
| Phase logic | Charleston, turn-flow, claim resolution |
| Card | Schema types, validator, authoring helpers, constraint solver |
| RNG | Seeded PRNG + shuffle |
| Replay | Fold helper |
| Tests | Colocated next to source per CLAUDE.md |
| Card data | `packages/engine/cards/*.ts` (or `*.json`) |

---

## Test strategy

Three layers:

1. **Unit tests** — per-action reducer transitions. Each action's happy path, error paths, edge cases. Live next to source.
2. **Property tests** — `fast-check` powered: random valid action sequences should never violate engine invariants (tile conservation, hand size, win exclusivity, dead-hand monotonicity, etc.).
3. **Replay tests** — given a recorded hand's action log, `replay` should produce identical final state every time.

CLAUDE.md mandates **100% coverage** for the engine. The purity test scans for banned identifiers and fails CI.

---

## Future work

- **Detailed `TileExpr` design** finalized when we author the first 5-10 hands.
- **Optimized constraint solver** if matching becomes slow with large cards (unlikely; basic backtracking is plenty fast at this scale).
- **Snapshot/save schema** for resumable games (server concern, not engine).
- **Versioned card migrations** if card schemas evolve.
- **Penalty escalation** for invalid mahjong declarations, misnamed discards, false dead-hand challenges (deferred from rules.md).
- **`'assistive'` dead-hand mode** (deferred from rules.md).
