import type { Action } from "./action.js";
import type { EngineError } from "./errors.js";
import type { PlayerId } from "./player.js";
import type { Result } from "./result.js";
import type { GameState, PlayerState, PlayerStateTuple } from "./state.js";
import { isJoker, removeTiles } from "./tile.js";

function setPlayer(players: PlayerStateTuple, id: PlayerId, next: PlayerState): PlayerStateTuple {
  if (id === 0) return [next, players[1], players[2], players[3]];
  if (id === 1) return [players[0], next, players[2], players[3]];
  if (id === 2) return [players[0], players[1], next, players[3]];
  return [players[0], players[1], players[2], next];
}

export function reduceDiscard(
  state: GameState,
  action: Extract<Action, { kind: "discard" }>,
): Result<GameState, EngineError> {
  if (state.phase.kind !== "awaitingTurnAction") {
    return {
      ok: false,
      error: {
        kind: "wrongPhase",
        expected: ["awaitingTurnAction"],
        actual: state.phase.kind,
      },
    };
  }
  if (state.phase.player !== action.player) {
    return {
      ok: false,
      error: { kind: "notYourTurn", expected: state.phase.player, actual: action.player },
    };
  }
  // Joker policy is checked before tileNotInHand: it's a flat rule violation
  // (O(1)), while tileNotInHand signals client/server state divergence.
  if (!state.config.jokers.allowDiscardingJokers && isJoker(action.tile)) {
    return {
      ok: false,
      error: {
        kind: "invalidDiscard",
        tile: action.tile,
        reason: "jokers may not be discarded",
      },
    };
  }
  const removed = removeTiles(state.players[action.player].hand, [action.tile]);
  if (!removed.ok) {
    return {
      ok: false,
      error: { kind: "tileNotInHand", player: action.player, tile: removed.error },
    };
  }

  const updatedPlayer: PlayerState = {
    ...state.players[action.player],
    hand: removed.value,
  };
  const players = setPlayer(state.players, action.player, updatedPlayer);

  return {
    ok: true,
    value: {
      ...state,
      players,
      discards: [...state.discards, action.tile],
      phase: { kind: "awaitingClaimWindow", discarder: action.player, tile: action.tile },
    },
  };
}
