import type { Action } from "./action.js";
import {
  reduceCharlestonHalt,
  reduceCharlestonPass,
  reduceCourtesyPassDeclare,
} from "./charleston.js";
import type { EngineError } from "./errors.js";
import { reduceDiscard } from "./play.js";
import type { Result } from "./result.js";
import type { GameState } from "./state.js";

function notImplemented(kind: Action["kind"]): Result<GameState, EngineError> {
  return {
    ok: false,
    error: { kind: "unknown", message: `not implemented: ${kind}` },
  };
}

function dispatch(state: GameState, action: Action): Result<GameState, EngineError> {
  switch (action.kind) {
    case "charlestonPass":
      return reduceCharlestonPass(state, action);
    case "charlestonHalt":
      return reduceCharlestonHalt(state, action);
    case "courtesyPassDeclare":
      return reduceCourtesyPassDeclare(state, action);
    case "jokerSwap":
      return notImplemented("jokerSwap");
    case "discard":
      return reduceDiscard(state, action);
    case "declareMahjongSelfPick":
      return notImplemented("declareMahjongSelfPick");
    case "resolveClaimWindow":
      return notImplemented("resolveClaimWindow");
    case "challengeDeadHand":
      return notImplemented("challengeDeadHand");
  }
}

/** Apply an action to a game state, returning a new state or a typed error. */
export function reduce(state: GameState, action: Action): Result<GameState, EngineError> {
  try {
    return dispatch(state, action);
  } catch (err) {
    /* v8 ignore start -- defensive: handlers are validation-first and don't throw
     * in this PR; the catch is here per the architecture doc's throw-and-catch
     * contract and will activate once handlers gain shouldn't-happen asserts. */
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: { kind: "unknown", message } };
    /* v8 ignore stop */
  }
}
