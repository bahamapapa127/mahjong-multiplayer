import type { Action } from "./action.js";
import type { EngineError } from "./errors.js";
import { reduce } from "./reduce.js";
import type { Result } from "./result.js";
import type { GameState } from "./state.js";

/** Fold a sequence of actions onto an initial state, returning the final state or the first error encountered. */
export function replay(
  initial: GameState,
  actions: readonly Action[],
): Result<GameState, EngineError> {
  let state = initial;
  for (const action of actions) {
    const result = reduce(state, action);
    if (!result.ok) return result;
    state = result.value;
  }
  return { ok: true, value: state };
}
