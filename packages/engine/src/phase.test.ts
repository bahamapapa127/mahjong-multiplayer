import { describe, expect, it } from "vitest";
import type { CharlestonStep, GameOutcome, Phase } from "./phase.js";

describe("CharlestonStep", () => {
  it("narrows on kind='collecting'", () => {
    const step: CharlestonStep = {
      kind: "collecting",
      passIndex: 0,
      received: {},
    };
    if (step.kind === "collecting") {
      expect(step.passIndex).toBe(0);
      return;
    }
    throw new Error("expected collecting");
  });

  it("narrows on kind='stopWindow'", () => {
    const step: CharlestonStep = { kind: "stopWindow" };
    expect(step.kind).toBe("stopWindow");
  });

  it("narrows on kind='courtesy'", () => {
    const step: CharlestonStep = {
      kind: "courtesy",
      offers: { 0: { tiles: [{ honor: "flower" }] } },
    };
    if (step.kind === "courtesy") {
      expect(step.offers[0]?.tiles).toHaveLength(1);
      return;
    }
    throw new Error("expected courtesy");
  });
});

describe("GameOutcome", () => {
  it("narrows on kind='mahjong'", () => {
    const outcome: GameOutcome = {
      kind: "mahjong",
      winner: 0,
      handId: "h-1",
      claimedFrom: "wall",
    };
    if (outcome.kind === "mahjong") {
      expect(outcome.winner).toBe(0);
      expect(outcome.claimedFrom).toBe("wall");
      return;
    }
    throw new Error("expected mahjong");
  });

  it("narrows on kind='wallGame'", () => {
    const outcome: GameOutcome = { kind: "wallGame" };
    expect(outcome.kind).toBe("wallGame");
  });
});

describe("Phase", () => {
  it("narrows on kind='charleston'", () => {
    const phase: Phase = {
      kind: "charleston",
      step: { kind: "stopWindow" },
    };
    if (phase.kind === "charleston") {
      expect(phase.step.kind).toBe("stopWindow");
      return;
    }
    throw new Error("expected charleston");
  });

  it("narrows on kind='awaitingTurnAction'", () => {
    const phase: Phase = {
      kind: "awaitingTurnAction",
      player: 1,
      cameFrom: "wall",
    };
    if (phase.kind === "awaitingTurnAction") {
      expect(phase.player).toBe(1);
      expect(phase.cameFrom).toBe("wall");
      return;
    }
    throw new Error("expected awaitingTurnAction");
  });

  it("narrows on kind='awaitingClaimWindow'", () => {
    const phase: Phase = {
      kind: "awaitingClaimWindow",
      discarder: 2,
      tile: { honor: "flower" },
    };
    if (phase.kind === "awaitingClaimWindow") {
      expect(phase.discarder).toBe(2);
      return;
    }
    throw new Error("expected awaitingClaimWindow");
  });

  it("narrows on kind='terminal'", () => {
    const phase: Phase = {
      kind: "terminal",
      outcome: { kind: "wallGame" },
    };
    if (phase.kind === "terminal") {
      expect(phase.outcome.kind).toBe("wallGame");
      return;
    }
    throw new Error("expected terminal");
  });
});
