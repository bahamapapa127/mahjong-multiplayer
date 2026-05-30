import type { Action } from "./action.js";
import type { EngineError } from "./errors.js";
import type {
  CharlestonCourtesyOffer,
  CharlestonOffers,
  CharlestonPassIndex,
  CharlestonReceived,
  CharlestonStep,
  Phase,
} from "./phase.js";
import type { PlayerId } from "./player.js";
import type { Result } from "./result.js";
import type { GameState, PlayerState, PlayerStateTuple } from "./state.js";
import { setPlayer } from "./state-update.js";
import { isJoker, removeTiles, type Tile } from "./tile.js";

// ROLLOR direction encoded as CCW offset from sender to recipient.
// rules.md §4: turn order is counterclockwise — the player one CCW seat away
// (offset +1) is to the sender's *left*; the player one CCW seat back
// (offset +3 ≡ -1 mod 4) is to the sender's *right*. The first three passes
// are Right, Across, Left (rules.md §3).
const PASS_OFFSET: readonly [1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3, 1 | 2 | 3] = [
  3, 2, 1, 1, 2, 3,
];

function recipientOf(player: PlayerId, passIndex: CharlestonPassIndex): PlayerId {
  const raw = (player + PASS_OFFSET[passIndex]) % 4;
  if (raw === 0) return 0;
  if (raw === 1) return 1;
  if (raw === 2) return 2;
  return 3;
}

function nextStep(passIndex: 0 | 1 | 2 | 3 | 4): CharlestonStep {
  if (passIndex === 0) return { kind: "collecting", passIndex: 1, received: {} };
  if (passIndex === 1) return { kind: "collecting", passIndex: 2, received: {} };
  if (passIndex === 2) return { kind: "stopWindow" };
  if (passIndex === 3) return { kind: "collecting", passIndex: 4, received: {} };
  return { kind: "collecting", passIndex: 5, received: {} };
}

function enterFirstTurn(state: GameState): Phase {
  // rules.md §2: East already holds 14 tiles from the initial deal — no draw
  // fires on this transition. `cameFrom: "initialDeal"` distinguishes this
  // first entry from later wall-draw / claim transitions, so the future
  // discard / claim-window handler can auto-draw on "wall" without auto-drawing
  // East into a 15-tile hand here.
  return { kind: "awaitingTurnAction", player: state.east, cameFrom: "initialDeal" };
}

function enterPostCharleston(state: GameState): Phase {
  if (!state.config.charleston.courtesyPass) return enterFirstTurn(state);
  return { kind: "charleston", step: { kind: "courtesy", offers: {} } };
}

type PassEntry = { readonly tiles: readonly Tile[]; readonly blind: boolean };

function applySwap(
  players: PlayerStateTuple,
  entries: readonly [PassEntry, PassEntry, PassEntry, PassEntry],
  passIndex: CharlestonPassIndex,
): PlayerStateTuple {
  // Snapshot incoming tiles per recipient before mutating anything: simultaneous
  // swap. (Across passes have player N sending to N+2 and vice versa.)
  const incoming: Record<PlayerId, readonly Tile[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const senderKey of [0, 1, 2, 3] as const) {
    const recipient = recipientOf(senderKey, passIndex);
    incoming[recipient] = [...incoming[recipient], ...entries[senderKey].tiles];
  }
  let next = players;
  for (const id of [0, 1, 2, 3] as const) {
    const current = next[id];
    const updated: PlayerState = {
      ...current,
      hand: [...current.hand, ...incoming[id]],
    };
    next = setPlayer(next, id, updated);
  }
  return next;
}

export function reduceCharlestonPass(
  state: GameState,
  action: Extract<Action, { kind: "charlestonPass" }>,
): Result<GameState, EngineError> {
  if (
    state.phase.kind !== "charleston" ||
    (state.phase.step.kind !== "collecting" && state.phase.step.kind !== "stopWindow")
  ) {
    return {
      ok: false,
      error: {
        kind: "wrongPhase",
        expected: ["charleston"],
        actual: state.phase.kind,
      },
    };
  }
  // rules.md §3: the stop window has no explicit "continue" action — submitting
  // pass-3 tiles is the player's consent to the second Charleston.
  const step: Extract<CharlestonStep, { kind: "collecting" }> =
    state.phase.step.kind === "stopWindow"
      ? { kind: "collecting", passIndex: 3, received: {} }
      : state.phase.step;
  if (step.received[action.player] !== undefined) {
    return {
      ok: false,
      error: { kind: "invalidCharlestonPass", reason: "already submitted" },
    };
  }
  if (action.tiles.length !== 3) {
    return {
      ok: false,
      error: {
        kind: "invalidCharlestonPass",
        reason: "must pass exactly 3 tiles",
      },
    };
  }
  // rules.md §3: a blind pass is only legal on a Left pass and only when the host
  // enabled it. PASS_OFFSET is 1 for exactly the two Left passes (indexes 2 and 3),
  // so it doubles as the "is this a Left pass" test.
  if (
    action.blind &&
    (!state.config.charleston.allowBlindPasses || PASS_OFFSET[step.passIndex] !== 1)
  ) {
    return {
      ok: false,
      error: {
        kind: "invalidCharlestonPass",
        reason: "blind passes are only allowed on a left pass when enabled",
      },
    };
  }
  // Joker policy is checked before tileNotInHand: it's a flat rule violation
  // (cheap O(n) scan), while tileNotInHand signals client/server state divergence.
  if (!state.config.charleston.allowJokersInCharleston) {
    for (const tile of action.tiles) {
      if (isJoker(tile)) {
        return {
          ok: false,
          error: {
            kind: "invalidCharlestonPass",
            reason: "jokers may not be passed",
          },
        };
      }
    }
  }
  const removed = removeTiles(state.players[action.player].hand, action.tiles);
  if (!removed.ok) {
    return {
      ok: false,
      error: {
        kind: "tileNotInHand",
        player: action.player,
        tile: removed.error,
      },
    };
  }

  const updatedReceived: CharlestonReceived = {
    ...step.received,
    [action.player]: { tiles: action.tiles, blind: action.blind },
  };

  const updatedSender: PlayerState = {
    ...state.players[action.player],
    hand: removed.value,
  };
  const playersAfterSender = setPlayer(state.players, action.player, updatedSender);

  const r0 = updatedReceived[0];
  const r1 = updatedReceived[1];
  const r2 = updatedReceived[2];
  const r3 = updatedReceived[3];
  if (r0 === undefined || r1 === undefined || r2 === undefined || r3 === undefined) {
    return {
      ok: true,
      value: {
        ...state,
        players: playersAfterSender,
        phase: {
          kind: "charleston",
          step: {
            kind: "collecting",
            passIndex: step.passIndex,
            received: updatedReceived,
          },
        },
      },
    };
  }

  const playersAfterSwap = applySwap(playersAfterSender, [r0, r1, r2, r3], step.passIndex);
  const stateAfterSwap: GameState = { ...state, players: playersAfterSwap };
  const newPhase: Phase =
    step.passIndex === 5
      ? enterPostCharleston(stateAfterSwap)
      : { kind: "charleston", step: nextStep(step.passIndex) };
  return { ok: true, value: { ...stateAfterSwap, phase: newPhase } };
}

export function reduceCharlestonHalt(
  state: GameState,
  _action: Extract<Action, { kind: "charlestonHalt" }>,
): Result<GameState, EngineError> {
  if (state.phase.kind !== "charleston" || state.phase.step.kind !== "stopWindow") {
    return {
      ok: false,
      error: {
        kind: "wrongPhase",
        expected: ["charleston"],
        actual: state.phase.kind,
      },
    };
  }
  return { ok: true, value: { ...state, phase: enterPostCharleston(state) } };
}

function applyCourtesyExchange(
  players: PlayerStateTuple,
  offers: readonly [
    CharlestonCourtesyOffer,
    CharlestonCourtesyOffer,
    CharlestonCourtesyOffer,
    CharlestonCourtesyOffer,
  ],
): PlayerStateTuple {
  // Snapshot incoming + returning per player BEFORE mutating any hand.
  const incoming: Record<PlayerId, readonly Tile[]> = { 0: [], 1: [], 2: [], 3: [] };
  const returning: Record<PlayerId, readonly Tile[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const [aId, bId] of [
    [0, 2],
    [1, 3],
  ] as const) {
    const a = offers[aId];
    const b = offers[bId];
    const n = Math.min(a.tiles.length, b.tiles.length);
    incoming[aId] = b.tiles.slice(0, n);
    incoming[bId] = a.tiles.slice(0, n);
    returning[aId] = a.tiles.slice(n);
    returning[bId] = b.tiles.slice(n);
  }
  let next = players;
  for (const id of [0, 1, 2, 3] as const) {
    const current = next[id];
    next = setPlayer(next, id, {
      ...current,
      hand: [...current.hand, ...incoming[id], ...returning[id]],
    });
  }
  return next;
}

export function reduceCourtesyPassDeclare(
  state: GameState,
  action: Extract<Action, { kind: "courtesyPassDeclare" }>,
): Result<GameState, EngineError> {
  if (state.phase.kind !== "charleston" || state.phase.step.kind !== "courtesy") {
    return {
      ok: false,
      error: {
        kind: "wrongPhase",
        expected: ["charleston"],
        actual: state.phase.kind,
      },
    };
  }
  const step = state.phase.step;
  if (step.offers[action.player] !== undefined) {
    return {
      ok: false,
      error: { kind: "invalidCharlestonPass", reason: "already submitted" },
    };
  }
  if (action.tiles.length > 3) {
    return {
      ok: false,
      error: {
        kind: "invalidCharlestonPass",
        reason: "courtesy pass exceeds 3 tiles",
      },
    };
  }
  // Joker policy is checked before tileNotInHand: it's a flat rule violation
  // (cheap O(n) scan), while tileNotInHand signals client/server state divergence.
  if (!state.config.charleston.allowJokersInCharleston) {
    for (const tile of action.tiles) {
      if (isJoker(tile)) {
        return {
          ok: false,
          error: {
            kind: "invalidCharlestonPass",
            reason: "jokers may not be passed",
          },
        };
      }
    }
  }
  const removed = removeTiles(state.players[action.player].hand, action.tiles);
  if (!removed.ok) {
    return {
      ok: false,
      error: {
        kind: "tileNotInHand",
        player: action.player,
        tile: removed.error,
      },
    };
  }

  const updatedOffers: CharlestonOffers = {
    ...step.offers,
    [action.player]: { tiles: action.tiles },
  };

  const updatedSender: PlayerState = {
    ...state.players[action.player],
    hand: removed.value,
  };
  const playersAfterSender = setPlayer(state.players, action.player, updatedSender);

  const o0 = updatedOffers[0];
  const o1 = updatedOffers[1];
  const o2 = updatedOffers[2];
  const o3 = updatedOffers[3];
  if (o0 === undefined || o1 === undefined || o2 === undefined || o3 === undefined) {
    return {
      ok: true,
      value: {
        ...state,
        players: playersAfterSender,
        phase: { kind: "charleston", step: { kind: "courtesy", offers: updatedOffers } },
      },
    };
  }

  const playersAfterExchange = applyCourtesyExchange(playersAfterSender, [o0, o1, o2, o3]);
  const stateAfterExchange: GameState = { ...state, players: playersAfterExchange };
  return { ok: true, value: { ...stateAfterExchange, phase: enterFirstTurn(stateAfterExchange) } };
}
