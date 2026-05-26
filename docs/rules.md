# Mahjong Engine — Rules Specification

## Purpose & scope

This document defines the rules of American Mahjong as implemented by [`packages/engine`](../packages/engine). It is the authoritative specification for what the engine enforces, validates, and emits. Anything not listed here is either out of scope or universal procedural detail with no engine-level variation.

**In scope:**
- Tile set, setup, Charleston, turn flow, claiming discards, exposures, jokers, win validation, end conditions.
- The `RuleConfig` toggles a host sets at game start.

**Out of scope:**
- Scoring, payments, kitty conventions.
- Multi-hand session state (who deals next, dealer rotation across hands).
- Penalties beyond making a hand "dead."
- Variant player counts (3 / 5 / multi-table rotations).
- House rules not represented in `RuleConfig`.

The engine handles a **single hand** from setup to terminal state. Anything across hands belongs to the session/server layer.

## RuleConfig

The host sets these at game-start. They are immutable for the duration of the hand and travel inside `GameState.config`.

```ts
type RuleConfig = {
  charleston: {
    allowBlindPasses: boolean;         // default true
    courtesyPass: boolean;             // default true
    allowJokersInCharleston: boolean;  // default false
  };
  jokers: {
    allowDiscardingJokers: boolean;    // default true
  };
  play: {
    deadHandDetection: 'auto' | 'manual'; // default 'manual'
  };
};
```

All defaults match canonical NMJL play. Each section below calls out where a toggle affects the rule with **[CONFIG]**.

---

## 1. The tile set

A standard set contains **152 tiles** in seven groups:

| Group   | Members                 | Each | Total |
|---------|-------------------------|------|-------|
| Dots    | 1 through 9             | 4    | 36    |
| Cracks  | 1 through 9             | 4    | 36    |
| Bams    | 1 through 9             | 4    | 36    |
| Winds   | N, E, S, W              | 4    | 16    |
| Dragons | Red, Green, White       | 4    | 12    |
| Flowers | (interchangeable)       | —    | 8     |
| Jokers  | (interchangeable wilds) | —    | 8     |

**Suit-dragon mapping** (engine-level fact, used for win validation):

| Dragon | Suit   |
|--------|--------|
| Red    | Cracks |
| Green  | Bams   |
| White  | Dots   |

**Flowers** are treated as interchangeable for hand-matching. Any flower satisfies any "flower" slot in any card hand.

---

## 2. Setup & deal

1. Build a wall: shuffle all 152 tiles into a single ordered sequence. (The physical "dice roll to break the wall" is irrelevant digitally — a shuffled list with a known seed is equivalent.)
2. Pick **East** (the dealer):
   - **First hand:** East is chosen uniformly at random by the engine (the seeded RNG).
   - **Subsequent hands:** session/server layer's concern; engine accepts East as an input.
3. Deal initial tiles by drawing from the front of the wall:
   - East receives **14 tiles**.
   - The other three players each receive **13 tiles**.
4. Proceed to the Charleston (§3).

---

## 3. The Charleston

Pre-game tile exchange. Follows the **ROLLOR** mnemonic: **R**ight → **O**ver → **L**eft → **L**eft → **O**ver → **R**ight.

Each pass exchanges exactly **3 tiles**.

### Pass-by-pass behavior

| Pass | Direction | Mandatory?                  | Blind allowed?                        |
|------|-----------|-----------------------------|---------------------------------------|
| 1    | Right     | Yes                         | No                                    |
| 2    | Across    | Yes                         | No                                    |
| 3    | Left      | Yes                         | Yes **[CONFIG: `allowBlindPasses`]** |
| —    | **Stop point** — any player may halt the Charleston here, no reason required. If anyone halts, the second Charleston is skipped. |||
| 4    | Left      | If 2nd Charleston proceeds  | Yes **[CONFIG: `allowBlindPasses`]** |
| 5    | Across    | If 2nd Charleston proceeds  | No                                    |
| 6    | Right     | If 2nd Charleston proceeds  | No                                    |
| 7    | Courtesy  | Optional; between opposite-seated players only **[CONFIG: `courtesyPass`]** | N/A |

### Blind passes

When `allowBlindPasses = true`, on a Left pass a player may pass any combination of tiles **face-down without looking at them** — including passing the entire 3-tile incoming pass straight through. When `false`, all passed tiles must be selected from the player's known rack.

### Courtesy pass

When enabled, after the Charleston ends (whether after 3 passes or 6) each pair of opposite-seated players may simultaneously declare a max number of tiles (0-3) they want to exchange. They exchange `min(playerA.declared, playerB.declared)` tiles, face-down. Both pairs act independently.

### Jokers in passes

**[CONFIG: `allowJokersInCharleston`]**
- `false` (default, canonical): a pass containing a joker is invalid; the engine rejects it.
- `true`: jokers may be passed.

---

## 4. Turn flow

East takes the first turn. Subsequent turns proceed counterclockwise.

A turn has two entry paths depending on whether the player **drew from the wall** or **claimed the previous discard**:

### Path A — Normal turn (no claim)

1. Player draws the next tile from the wall. (Hand size: 13 → 14.)
2. Optional: any number of **joker swaps** (§7).
3. Optional: declare **mahjong** (§8) if the hand matches a card hand.
4. Discard exactly one tile, face-up. (Hand size: 14 → 13.)
5. Claim window opens (§5).

### Path B — Claim turn

If the previous discard was claimed by a player (see §5), that player's turn now begins:

1. The claimed discard is added to the claimer's exposure (§6), face-up. (Hand size: 13 → 14.)
2. Optional: additional joker swaps.
3. Optional: declare mahjong.
4. Discard exactly one tile.
5. Claim window opens.

A claim "skips" the players between the previous discarder and the claimer — the next normal-draw turn belongs to the player counterclockwise of the claimer.

---

## 5. Claiming discards

Immediately after a discard, a **claim window** opens. Any player may attempt to claim the discard. The window closes when one of:
- All non-discarding players signal pass.
- A claim is accepted.
- A fixed timeout elapses (digital UX convention, not a rule).

### What can be claimed for

- **Mahjong** — claimer declares a winning hand that requires this tile.
- **Exposure** — claimer adds the tile to a pung / kong / quint exposure on their rack (§6).

A discard **cannot** be claimed for a joker swap.
A discarded **joker** cannot be claimed for any reason — it is permanently dead.

### Priority

When multiple players attempt claims on the same discard:

1. **Mahjong always beats exposure.** If anyone claims mahjong, all exposure claims are dropped.
2. **Mahjong tie-break:** the player **next in counterclockwise turn order from the discarder** wins. (Matters only when two players both hold valid winning hands for the same tile.)
3. **Exposure tie-break:** the player next in counterclockwise turn order from the discarder wins.

---

## 6. Exposures

When a player claims a discard for exposure, the claimed tile plus matching tiles from the claimer's hand are placed **face-up on top of their rack**, forming an exposed group.

### Valid exposed groups

- **Pung** — 3 of a kind.
- **Kong** — 4 of a kind.
- **Quint** — 5 of a kind.

Pairs and singles are never exposed — they remain concealed in the hand until mahjong is declared.

### Joker substitution in exposures

Tiles in an exposure other than the claimed discard itself may be jokers, subject to the universal joker rules (§7). The exposure must remain **potentially valid for at least one hand on the active card**; if not, the claimer's hand is dead (§10).

### Exposures are locked

Once exposed, tiles cannot return to the concealed hand. They remain **joker-swap-eligible** by any player (§7) for the rest of the hand, including after the original owner's hand is declared dead.

---

## 7. Jokers

### Where jokers may appear

| Group               | Joker allowed? |
|---------------------|----------------|
| Pung / Kong / Quint | Yes            |
| Pair                | **No**         |
| Single              | **No**         |

A pung / kong / quint may be **entirely composed of jokers**.

Specialty card hands may further restrict joker use (e.g., the entire "Singles & Pairs" category disallows them). This is encoded on the card hand itself, not as a global rule.

### Joker swap

On a player's own turn — **after** drawing or claiming, **before** discarding — they may swap a real tile from their hand for a joker sitting in **any exposed group on the table** (their own or any opponent's), provided the real tile is the one the joker is representing.

- Multiple swaps per turn are allowed, across any number of exposures.
- The swap is purely physical: the joker moves to the swapper's hand, the real tile takes its place in the exposure.
- A discarded tile cannot be used in a swap.
- A discarded joker cannot be reclaimed by a swap.

### Discarding jokers

**[CONFIG: `allowDiscardingJokers`]**
- `true` (default, canonical NMJL): legal at any discard step.
- `false`: the engine rejects a discard action whose tile is a joker.

A discarded joker is **always** permanently dead — universal, not configurable.

### Jokers in Charleston

Governed by `charleston.allowJokersInCharleston` — see §3.

---

## 8. Winning ("Mahjong")

### Declaring mahjong

A player declares mahjong either:
- **By self-pick** — after drawing from the wall, before discarding.
- **By claim** — by claiming a discard with intent "mahjong" (§5).

### Validation

The engine checks the player's 14-tile hand against the active `Card`'s list of hands:

- The hand must match **exactly one** card hand.
- All hand-specific constraints apply (concealed-only, joker positions, suit constraints).
- If valid: terminal state, winner = this player.

### Mahjong-in-error

If the declared mahjong does **not** validate, the declarer's hand is marked **dead** (§10). Play continues with the remaining players. Penalty escalation is deferred — see "Future work."

---

## 9. The card (data shape)

The card is **data, not code** — see [`CLAUDE.md`](../CLAUDE.md). A `Card` is the list of winning hands for the year/variant in use. Each `Hand` minimally needs:

```ts
type Hand = {
  id: string;             // stable identifier
  name: string;           // human-readable
  concealed: boolean;     // true → cannot make exposures
  allowJokers: boolean;   // false for e.g. Singles & Pairs
  groups: GroupSpec[];    // tile pattern (full schema in engine-architecture.md)
};
```

The full `GroupSpec` schema is deferred to [`docs/engine-architecture.md`](engine-architecture.md). It must be expressive enough to encode pungs, kongs, quints, pairs, singles, numeric / sequence constraints, suit constraints, and per-group joker eligibility.

> **Important: never hardcode the NMJL card.** It is copyrighted. The engine ships with custom cards stored as data files under `packages/engine/cards/`.

---

## 10. End conditions

A hand reaches a **terminal state** in one of two ways.

### Mahjong win

A player successfully declares and validates mahjong:

```ts
{ kind: 'mahjong', winner: PlayerId, hand: Hand, claimedFrom: 'wall' | PlayerId }
```

### Wall game

The wall is fully drawn and the last discard's claim window has closed without any successful mahjong:

```ts
{ kind: 'wallGame' }
```

No winner. The session/server layer decides what happens next.

### Dead hand

A hand becomes **dead** when it can no longer win — typically through an invalid exposure, a mahjong-in-error, wrong tile count, or visible state incompatible with every card hand.

**[CONFIG: `deadHandDetection`]**
- `manual` (default, canonical): the engine never auto-marks a hand dead. Any player may issue a `challengeDeadHand` action against any other player; the engine validates the challenge.
  - **Valid challenge:** the challenged player's hand is marked dead.
  - **Invalid challenge:** no penalty in v1. (Future work.)
- `auto`: the engine marks a hand dead the moment it becomes provably unwinnable against any card hand.

A dead player:
- Continues to draw and discard each turn (their position in the rotation is preserved).
- Cannot call discards, declare mahjong, or initiate joker swaps.
- Their exposures remain joker-swap-eligible by other players.

---

## 11. Glossary

| Term              | Meaning                                                        |
|-------------------|----------------------------------------------------------------|
| **Pung**          | 3 of a kind                                                    |
| **Kong**          | 4 of a kind                                                    |
| **Quint**         | 5 of a kind                                                    |
| **Pair**          | 2 of a kind (no jokers allowed)                                |
| **Single**        | 1 specific tile (no jokers allowed)                            |
| **Exposure**      | A face-up group on a player's rack, formed by claiming a discard |
| **Concealed hand**| A card hand that must be played without any exposures          |
| **Charleston**    | The pre-game tile-passing ritual                               |
| **Mahjong**       | A declared winning hand; also the act of declaring it          |
| **Dead hand**     | A hand that can no longer win for the current round            |
| **Wall game**     | Terminal state where the wall is exhausted with no winner      |
| **East**          | The dealer for the current hand                                |

---

## Future work (deliberately deferred)

- **Penalty escalation** for invalid mahjong declarations, misnamed discards, and false dead-hand challenges.
- **`'assistive'` mode** for `deadHandDetection` — engine privately tells a player their hand is dead without notifying opponents.
- **Custom "blank" tile** as an additional wild type with table-defined swap rules. (Discussed and punted.)
- **Variant player counts** (3-player, 5-player rotations) and multi-table session formats.
- **Scoring and payments.**
