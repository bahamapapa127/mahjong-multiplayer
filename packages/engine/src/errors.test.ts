import { describe, expect, it } from "vitest";
import type { EngineError } from "./errors.js";
import { flower } from "./test-fixtures.js";

describe("EngineError", () => {
  it("narrows on kind='wrongPhase'", () => {
    const error: EngineError = {
      kind: "wrongPhase",
      expected: ["awaitingTurnAction"],
      actual: "charleston",
    };
    if (error.kind === "wrongPhase") {
      expect(error.expected).toEqual(["awaitingTurnAction"]);
      expect(error.actual).toBe("charleston");
      return;
    }
    throw new Error("expected wrongPhase");
  });

  it("narrows on kind='notYourTurn'", () => {
    const error: EngineError = { kind: "notYourTurn", expected: 0, actual: 2 };
    if (error.kind === "notYourTurn") {
      expect(error.expected).toBe(0);
      expect(error.actual).toBe(2);
      return;
    }
    throw new Error("expected notYourTurn");
  });

  it("narrows on kind='tileNotInHand'", () => {
    const error: EngineError = {
      kind: "tileNotInHand",
      player: 1,
      tile: flower,
    };
    if (error.kind === "tileNotInHand") {
      expect(error.player).toBe(1);
      return;
    }
    throw new Error("expected tileNotInHand");
  });

  it("narrows on kind='invalidDiscard'", () => {
    const error: EngineError = {
      kind: "invalidDiscard",
      tile: flower,
      reason: "not in hand",
    };
    if (error.kind === "invalidDiscard") {
      expect(error.reason).toBe("not in hand");
      return;
    }
    throw new Error("expected invalidDiscard");
  });

  it("narrows on kind='invalidExposure'", () => {
    const error: EngineError = {
      kind: "invalidExposure",
      reason: "group size mismatch",
    };
    if (error.kind === "invalidExposure") {
      expect(error.reason).toBe("group size mismatch");
      return;
    }
    throw new Error("expected invalidExposure");
  });

  it("narrows on kind='invalidJokerSwap'", () => {
    const error: EngineError = {
      kind: "invalidJokerSwap",
      reason: "joker not present",
    };
    if (error.kind === "invalidJokerSwap") {
      expect(error.reason).toBe("joker not present");
      return;
    }
    throw new Error("expected invalidJokerSwap");
  });

  it("narrows on kind='mahjongInError'", () => {
    const error: EngineError = {
      kind: "mahjongInError",
      handId: "h-1",
      reason: "hand does not match card",
    };
    if (error.kind === "mahjongInError") {
      expect(error.handId).toBe("h-1");
      return;
    }
    throw new Error("expected mahjongInError");
  });

  it("narrows on kind='invalidCharlestonPass'", () => {
    const error: EngineError = {
      kind: "invalidCharlestonPass",
      reason: "joker passed",
    };
    if (error.kind === "invalidCharlestonPass") {
      expect(error.reason).toBe("joker passed");
      return;
    }
    throw new Error("expected invalidCharlestonPass");
  });

  it("narrows on kind='deadPlayerAction'", () => {
    const error: EngineError = { kind: "deadPlayerAction", player: 3 };
    if (error.kind === "deadPlayerAction") {
      expect(error.player).toBe(3);
      return;
    }
    throw new Error("expected deadPlayerAction");
  });

  it("narrows on kind='failedDeadHandChallenge'", () => {
    const error: EngineError = { kind: "failedDeadHandChallenge", target: 2 };
    if (error.kind === "failedDeadHandChallenge") {
      expect(error.target).toBe(2);
      return;
    }
    throw new Error("expected failedDeadHandChallenge");
  });

  it("narrows on kind='unknown'", () => {
    const error: EngineError = { kind: "unknown", message: "boom" };
    if (error.kind === "unknown") {
      expect(error.message).toBe("boom");
      return;
    }
    throw new Error("expected unknown");
  });
});
