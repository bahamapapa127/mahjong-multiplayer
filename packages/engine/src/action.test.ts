import { describe, expect, it } from "vitest";
import type { Action, ClaimIntent, JokerSwap } from "./action.js";
import { flower } from "./test-fixtures.js";

const fiveCrak = { suit: "crak", value: 5 } as const;

describe("ClaimIntent", () => {
  it("narrows on kind='pass'", () => {
    const intent: ClaimIntent = { kind: "pass" };
    expect(intent.kind).toBe("pass");
  });

  it("narrows on kind='claimMahjong'", () => {
    const intent: ClaimIntent = { kind: "claimMahjong", handId: "h-1" };
    if (intent.kind === "claimMahjong") {
      expect(intent.handId).toBe("h-1");
      return;
    }
    throw new Error("expected claimMahjong");
  });

  it("narrows on kind='claimExposure' with size 3", () => {
    const intent: ClaimIntent = {
      kind: "claimExposure",
      groupSize: 3,
      ownTilesUsed: [fiveCrak, fiveCrak],
    };
    if (intent.kind === "claimExposure") {
      expect(intent.groupSize).toBe(3);
      expect(intent.ownTilesUsed).toHaveLength(2);
      return;
    }
    throw new Error("expected claimExposure");
  });
});

describe("JokerSwap", () => {
  it("constructs a swap pointing at an exposure index", () => {
    const swap: JokerSwap = {
      exposureOwner: 1,
      exposureIndex: 0,
      ownTile: fiveCrak,
    };
    expect(swap.exposureOwner).toBe(1);
    expect(swap.exposureIndex).toBe(0);
  });
});

describe("Action", () => {
  it("narrows on kind='charlestonPass'", () => {
    const action: Action = {
      kind: "charlestonPass",
      player: 0,
      tiles: [flower, flower, flower],
      blind: false,
    };
    if (action.kind === "charlestonPass") {
      expect(action.tiles).toHaveLength(3);
      expect(action.blind).toBe(false);
      return;
    }
    throw new Error("expected charlestonPass");
  });

  it("narrows on kind='charlestonHalt'", () => {
    const action: Action = { kind: "charlestonHalt", player: 2 };
    if (action.kind === "charlestonHalt") {
      expect(action.player).toBe(2);
      return;
    }
    throw new Error("expected charlestonHalt");
  });

  it("narrows on kind='courtesyPassDeclare'", () => {
    const action: Action = {
      kind: "courtesyPassDeclare",
      player: 3,
      count: 2,
    };
    if (action.kind === "courtesyPassDeclare") {
      expect(action.count).toBe(2);
      return;
    }
    throw new Error("expected courtesyPassDeclare");
  });

  it("narrows on kind='jokerSwap' with a non-empty swaps tuple", () => {
    const action: Action = {
      kind: "jokerSwap",
      player: 0,
      swaps: [{ exposureOwner: 1, exposureIndex: 0, ownTile: fiveCrak }],
    };
    if (action.kind === "jokerSwap") {
      expect(action.swaps[0].exposureOwner).toBe(1);
      return;
    }
    throw new Error("expected jokerSwap");
  });

  it("narrows on kind='discard'", () => {
    const action: Action = { kind: "discard", player: 1, tile: flower };
    if (action.kind === "discard") {
      expect(action.tile).toEqual(flower);
      return;
    }
    throw new Error("expected discard");
  });

  it("narrows on kind='declareMahjongSelfPick'", () => {
    const action: Action = {
      kind: "declareMahjongSelfPick",
      player: 0,
      handId: "h-1",
    };
    if (action.kind === "declareMahjongSelfPick") {
      expect(action.handId).toBe("h-1");
      return;
    }
    throw new Error("expected declareMahjongSelfPick");
  });

  it("narrows on kind='resolveClaimWindow' with all four intents", () => {
    const action: Action = {
      kind: "resolveClaimWindow",
      discarder: 0,
      intents: {
        0: { kind: "pass" },
        1: { kind: "pass" },
        2: { kind: "pass" },
        3: { kind: "claimMahjong", handId: "h-1" },
      },
    };
    if (action.kind === "resolveClaimWindow") {
      expect(action.intents[3].kind).toBe("claimMahjong");
      return;
    }
    throw new Error("expected resolveClaimWindow");
  });

  it("narrows on kind='challengeDeadHand'", () => {
    const action: Action = {
      kind: "challengeDeadHand",
      challenger: 1,
      target: 2,
    };
    if (action.kind === "challengeDeadHand") {
      expect(action.challenger).toBe(1);
      expect(action.target).toBe(2);
      return;
    }
    throw new Error("expected challengeDeadHand");
  });
});
