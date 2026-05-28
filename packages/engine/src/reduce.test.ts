import { describe, expect, it } from "vitest";
import type { Action } from "./action.js";
import { makeInitialState } from "./init.js";
import { reduce } from "./reduce.js";
import { flower, makeOpts, unwrapErr, unwrapOk } from "./test-fixtures.js";

describe("reduce dispatch", () => {
  const initialState = makeInitialState(makeOpts({ seed: "reduce-test", east: 0 }));

  function assertNotImplemented(action: Action, kind: Action["kind"]) {
    const error = unwrapErr(reduce(initialState, action));
    expect(error.kind).toBe("unknown");
    if (error.kind !== "unknown") return;
    expect(error.message).toContain(kind);
  }

  it("stubs courtesyPassDeclare", () => {
    assertNotImplemented(
      { kind: "courtesyPassDeclare", player: 0, count: 0 },
      "courtesyPassDeclare",
    );
  });

  it("stubs jokerSwap", () => {
    assertNotImplemented(
      {
        kind: "jokerSwap",
        player: 0,
        swaps: [{ exposureOwner: 1, exposureIndex: 0, ownTile: flower }],
      },
      "jokerSwap",
    );
  });

  it("stubs discard", () => {
    assertNotImplemented({ kind: "discard", player: 0, tile: flower }, "discard");
  });

  it("stubs declareMahjongSelfPick", () => {
    assertNotImplemented(
      { kind: "declareMahjongSelfPick", player: 0, handId: "h-1" },
      "declareMahjongSelfPick",
    );
  });

  it("stubs resolveClaimWindow", () => {
    assertNotImplemented(
      {
        kind: "resolveClaimWindow",
        discarder: 0,
        intents: {
          0: { kind: "pass" },
          1: { kind: "pass" },
          2: { kind: "pass" },
          3: { kind: "pass" },
        },
      },
      "resolveClaimWindow",
    );
  });

  it("stubs challengeDeadHand", () => {
    assertNotImplemented(
      { kind: "challengeDeadHand", challenger: 0, target: 1 },
      "challengeDeadHand",
    );
  });

  it("dispatches charlestonPass to the handler (happy path)", () => {
    const nonJokers = initialState.players[0].hand.filter(
      (t) => !("honor" in t) || t.honor !== "joker",
    );
    const tiles = nonJokers.slice(0, 3);
    const value = unwrapOk(
      reduce(initialState, { kind: "charlestonPass", player: 0, tiles, blind: false }),
    );
    expect(value.players[0].hand).toHaveLength(initialState.players[0].hand.length - 3);
  });
});
