import { describe, expect, it } from "vitest";
import type { Action } from "./action.js";
import { makeInitialState } from "./init.js";
import type { PlayerId } from "./player.js";
import { reduce } from "./reduce.js";
import { replay } from "./replay.js";
import { makeOpts, unwrapErr, unwrapOk } from "./test-fixtures.js";
import { isJoker, type Tile } from "./tile.js";

const initial = makeInitialState(makeOpts({ seed: "replay-test", east: 0 }));

function firstThreeNonJokers(hand: readonly Tile[]): Tile[] {
  return hand.filter((t) => !isJoker(t)).slice(0, 3);
}

function pass(player: PlayerId, tiles: readonly Tile[]): Action {
  return { kind: "charlestonPass", player, tiles, blind: false };
}

// A complete first Charleston pass: all four players submit, triggering the swap.
function firstPassActions(): Action[] {
  return [
    pass(0, firstThreeNonJokers(initial.players[0].hand)),
    pass(1, firstThreeNonJokers(initial.players[1].hand)),
    pass(2, firstThreeNonJokers(initial.players[2].hand)),
    pass(3, firstThreeNonJokers(initial.players[3].hand)),
  ];
}

describe("replay", () => {
  it("returns the initial state unchanged for an empty action list", () => {
    expect(unwrapOk(replay(initial, []))).toBe(initial);
  });

  it("folds a sequence equivalently to chaining reduce manually", () => {
    const actions = firstPassActions();
    let manual = initial;
    for (const action of actions) {
      manual = unwrapOk(reduce(manual, action));
    }
    expect(unwrapOk(replay(initial, actions))).toEqual(manual);
  });

  it("advances the phase after a full first Charleston pass", () => {
    const next = unwrapOk(replay(initial, firstPassActions()));
    if (next.phase.kind !== "charleston" || next.phase.step.kind !== "collecting") {
      throw new Error("expected collecting phase");
    }
    expect(next.phase.step.passIndex).toBe(1);
  });

  it("is deterministic: replaying the same actions twice yields equal state", () => {
    const actions = firstPassActions();
    expect(unwrapOk(replay(initial, actions))).toEqual(unwrapOk(replay(initial, actions)));
  });

  it("returns the first error and stops folding the remaining actions", () => {
    const tiles = firstThreeNonJokers(initial.players[0].hand);
    // Player 0 submits, then submits again: the second action is rejected as
    // "already submitted", proving the first applied and the fold halted there.
    const error = unwrapErr(replay(initial, [pass(0, tiles), pass(0, tiles)]));
    expect(error.kind).toBe("invalidCharlestonPass");
  });
});
