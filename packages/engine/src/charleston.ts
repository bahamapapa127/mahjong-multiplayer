import type { Action } from "./action.js";
import type { EngineError } from "./errors.js";
import type { CharlestonPassIndex, CharlestonReceived, CharlestonStep } from "./phase.js";
import type { PlayerId } from "./player.js";
import type { Result } from "./result.js";
import type { GameState, PlayerState, PlayerStateTuple } from "./state.js";
import { type Tile, tilesEqual } from "./tile.js";

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

function removeTiles(hand: readonly Tile[], toRemove: readonly Tile[]): Result<Tile[], Tile> {
  const result = [...hand];
  for (const tile of toRemove) {
    const idx = result.findIndex((t) => tilesEqual(t, tile));
    if (idx === -1) return { ok: false, error: tile };
    result.splice(idx, 1);
  }
  return { ok: true, value: result };
}

function isJoker(tile: Tile): boolean {
  return "honor" in tile && tile.honor === "joker";
}

function setPlayer(players: PlayerStateTuple, id: PlayerId, next: PlayerState): PlayerStateTuple {
  if (id === 0) return [next, players[1], players[2], players[3]];
  if (id === 1) return [players[0], next, players[2], players[3]];
  if (id === 2) return [players[0], players[1], next, players[3]];
  return [players[0], players[1], players[2], next];
}

function nextStep(passIndex: CharlestonPassIndex): CharlestonStep {
  if (passIndex === 0) return { kind: "collecting", passIndex: 1, received: {} };
  if (passIndex === 1) return { kind: "collecting", passIndex: 2, received: {} };
  if (passIndex === 2) return { kind: "stopWindow" };
  if (passIndex === 3) return { kind: "collecting", passIndex: 4, received: {} };
  if (passIndex === 4) return { kind: "collecting", passIndex: 5, received: {} };
  return { kind: "courtesy", offers: {} };
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
  if (state.phase.kind !== "charleston" || state.phase.step.kind !== "collecting") {
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
  return {
    ok: true,
    value: {
      ...state,
      players: playersAfterSwap,
      phase: { kind: "charleston", step: nextStep(step.passIndex) },
    },
  };
}
