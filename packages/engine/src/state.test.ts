import { describe, expect, it } from "vitest";
import type { Card } from "./card.js";
import type { RuleConfig } from "./config.js";
import type { Phase } from "./phase.js";
import { PLAYER_IDS, type PlayerId } from "./player.js";
import type { Exposure, GameState, PlayerState, PlayerStateTuple } from "./state.js";

const flower = { honor: "flower" } as const;
const fiveCrak = { suit: "crak", value: 5 } as const;

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

function makePlayer(id: PlayerId): PlayerState {
  return { id, hand: [], exposures: [], isDead: false };
}

function makePlayers(): PlayerStateTuple {
  return [makePlayer(0), makePlayer(1), makePlayer(2), makePlayer(3)];
}

function makeStateWithPhase(phase: Phase): GameState {
  return {
    config: defaultConfig,
    seed: "seed",
    card: placeholderCard,
    wall: [],
    discards: [],
    players: makePlayers(),
    east: 0,
    currentTurn: 0,
    phase,
  };
}

describe("Exposure", () => {
  it("constructs an exposure with groupSize 3 and zero jokers", () => {
    const exposure: Exposure = {
      groupSize: 3,
      baseTile: fiveCrak,
      jokerSlots: 0,
    };
    expect(exposure.groupSize).toBe(3);
    expect(exposure.jokerSlots).toBe(0);
  });

  it("allows jokerSlots > 0 for a kong", () => {
    const exposure: Exposure = {
      groupSize: 4,
      baseTile: fiveCrak,
      jokerSlots: 2,
    };
    expect(exposure.groupSize).toBe(4);
    expect(exposure.jokerSlots).toBe(2);
  });
});

describe("PlayerState", () => {
  it("constructs an empty player", () => {
    const player: PlayerState = makePlayer(1);
    expect(player.id).toBe(1);
    expect(player.hand).toHaveLength(0);
    expect(player.exposures).toHaveLength(0);
    expect(player.isDead).toBe(false);
  });
});

describe("GameState", () => {
  it("provides a fixture for phase='charleston'", () => {
    const state = makeStateWithPhase({
      kind: "charleston",
      step: { kind: "collecting", passIndex: 0, received: {} },
    });
    expect(state.phase.kind).toBe("charleston");
    expect(state.players).toHaveLength(4);
    expect(state.east).toBe(0);
  });

  it("provides a fixture for phase='awaitingTurnAction'", () => {
    const state = makeStateWithPhase({
      kind: "awaitingTurnAction",
      player: 0,
      cameFrom: "wall",
    });
    expect(state.phase.kind).toBe("awaitingTurnAction");
  });

  it("provides a fixture for phase='awaitingClaimWindow'", () => {
    const state = makeStateWithPhase({
      kind: "awaitingClaimWindow",
      discarder: 0,
      tile: flower,
    });
    expect(state.phase.kind).toBe("awaitingClaimWindow");
  });

  it("provides a fixture for phase='terminal'", () => {
    const state = makeStateWithPhase({
      kind: "terminal",
      outcome: { kind: "wallGame" },
    });
    expect(state.phase.kind).toBe("terminal");
  });

  it("typed PlayerId narrows when indexing the players tuple", () => {
    const state = makeStateWithPhase({
      kind: "awaitingTurnAction",
      player: 0,
      cameFrom: "wall",
    });
    for (const id of PLAYER_IDS) {
      expect(state.players[id].id).toBe(id);
    }
  });
});
