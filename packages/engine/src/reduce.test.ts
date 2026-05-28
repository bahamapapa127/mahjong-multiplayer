import { describe, expect, it } from "vitest";
import type { Action } from "./action.js";
import type { Card } from "./card.js";
import type { RuleConfig } from "./config.js";
import { type InitOptions, makeInitialState } from "./init.js";
import { reduce } from "./reduce.js";

const defaultConfig: RuleConfig = {
  charleston: {
    allowBlindPasses: true,
    courtesyPass: true,
    allowJokersInCharleston: false,
  },
  jokers: { allowDiscardingJokers: true },
  play: { deadHandDetection: "manual" },
};

const placeholderCard: Card = {
  id: "test-card",
  name: "Test",
  version: "0.0.0",
};

const baseOpts: InitOptions = {
  config: defaultConfig,
  seed: "reduce-test",
  card: placeholderCard,
  east: 0,
};

const flower = { honor: "flower" } as const;

describe("reduce dispatch", () => {
  const initialState = makeInitialState(baseOpts);

  function assertNotImplemented(action: Action, kind: Action["kind"]) {
    const result = reduce(initialState, action);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.kind).toBe("unknown");
    if (result.error.kind !== "unknown") return;
    expect(result.error.message).toContain(kind);
  }

  it("stubs charlestonHalt", () => {
    assertNotImplemented({ kind: "charlestonHalt", player: 0 }, "charlestonHalt");
  });

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
    const result = reduce(initialState, {
      kind: "charlestonPass",
      player: 0,
      tiles,
      blind: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[0].hand).toHaveLength(initialState.players[0].hand.length - 3);
  });
});
