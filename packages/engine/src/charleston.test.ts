import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Action } from "./action.js";
import type { RuleConfig } from "./config.js";
import { makeInitialState } from "./init.js";
import { PLAYER_IDS, type PlayerId } from "./player.js";
import { reduce } from "./reduce.js";
import type { GameState, PlayerStateTuple } from "./state.js";
import {
  defaultConfig,
  flower,
  joker,
  makeOpts,
  multisetEqual,
  unwrapOk,
} from "./test-fixtures.js";
import { makeStandardDeck, serializeTile, type Tile } from "./tile.js";

const baseOpts = makeOpts({ seed: "charleston-test", east: 0 });

function overrideHand(state: GameState, id: PlayerId, hand: readonly Tile[]): GameState {
  const players: PlayerStateTuple = [
    id === 0 ? { ...state.players[0], hand } : state.players[0],
    id === 1 ? { ...state.players[1], hand } : state.players[1],
    id === 2 ? { ...state.players[2], hand } : state.players[2],
    id === 3 ? { ...state.players[3], hand } : state.players[3],
  ];
  return { ...state, players };
}

function pass(player: PlayerId, tiles: readonly Tile[], blind = false): Action {
  return { kind: "charlestonPass", player, tiles, blind };
}

function step(state: GameState, action: Action): GameState {
  return unwrapOk(reduce(state, action));
}

function allTiles(state: GameState): Tile[] {
  const tiles: Tile[] = [...state.wall];
  for (const id of PLAYER_IDS) {
    tiles.push(...state.players[id].hand);
  }
  tiles.push(...state.discards);
  if (state.phase.kind === "charleston" && state.phase.step.kind === "collecting") {
    for (const id of PLAYER_IDS) {
      const entry = state.phase.step.received[id];
      if (entry !== undefined) tiles.push(...entry.tiles);
    }
  }
  return tiles;
}

function applyPass(state: GameState): GameState {
  // Each player passes their first 3 tiles (skipping jokers if config forbids).
  let next = state;
  for (const id of PLAYER_IDS) {
    const skipJokers = !state.config.charleston.allowJokersInCharleston;
    const eligible = skipJokers
      ? next.players[id].hand.filter((t) => !("honor" in t) || t.honor !== "joker")
      : next.players[id].hand;
    const tiles = eligible.slice(0, 3);
    next = step(next, pass(id, tiles));
  }
  return next;
}

const seedArb = fc.string({ minLength: 1, maxLength: 16 });

describe("reduceCharlestonPass validation", () => {
  it("rejects wrong phase", () => {
    const initial = makeInitialState(baseOpts);
    const terminalState: GameState = {
      ...initial,
      phase: { kind: "terminal", outcome: { kind: "wallGame" } },
    };
    const action = pass(0, initial.players[0].hand.slice(0, 3));
    const result = reduce(terminalState, action);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrongPhase");
  });

  it("rejects already-submitted player", () => {
    let state = makeInitialState(baseOpts);
    const tiles = state.players[0].hand.slice(0, 3);
    state = step(state, pass(0, tiles));
    const result = reduce(state, pass(0, state.players[0].hand.slice(0, 3)));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalidCharlestonPass");
    if (result.error.kind !== "invalidCharlestonPass") return;
    expect(result.error.reason).toBe("already submitted");
  });

  it("rejects wrong tile count", () => {
    const state = makeInitialState(baseOpts);
    const result = reduce(state, pass(0, state.players[0].hand.slice(0, 2)));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalidCharlestonPass");
    if (result.error.kind !== "invalidCharlestonPass") return;
    expect(result.error.reason).toBe("must pass exactly 3 tiles");
  });

  it("rejects jokers when allowJokersInCharleston is false", () => {
    const state = overrideHand(makeInitialState(baseOpts), 0, [
      joker,
      flower,
      flower,
      ...makeInitialState(baseOpts).players[0].hand.slice(3),
    ]);
    const result = reduce(state, pass(0, [joker, flower, flower]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalidCharlestonPass");
    if (result.error.kind !== "invalidCharlestonPass") return;
    expect(result.error.reason).toBe("jokers may not be passed");
  });

  it("rejects tiles not in hand", () => {
    const state = overrideHand(
      makeInitialState(baseOpts),
      0,
      Array.from({ length: 14 }, () => flower),
    );
    const action = pass(0, [
      { suit: "crak", value: 1 },
      { suit: "crak", value: 1 },
      { suit: "crak", value: 1 },
    ]);
    const result = reduce(state, action);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("tileNotInHand");
    if (result.error.kind !== "tileNotInHand") return;
    expect(result.error.player).toBe(0);
  });
});

describe("reduceCharlestonPass happy path", () => {
  it("removes 3 tiles from the player's hand and records the pass", () => {
    const initial = makeInitialState(baseOpts);
    const tiles = initial.players[1].hand.slice(0, 3);
    const next = step(initial, pass(1, tiles));

    expect(next.players[1].hand).toHaveLength(initial.players[1].hand.length - 3);
    for (const id of PLAYER_IDS) {
      if (id === 1) continue;
      expect(next.players[id].hand).toEqual(initial.players[id].hand);
    }
    if (next.phase.kind !== "charleston" || next.phase.step.kind !== "collecting") {
      throw new Error("expected collecting phase");
    }
    expect(next.phase.step.received[1]).toEqual({ tiles, blind: false });
  });

  it("preserves the blind flag", () => {
    const initial = makeInitialState(baseOpts);
    const tiles = initial.players[1].hand.slice(0, 3);
    const next = step(initial, pass(1, tiles, true));
    if (next.phase.kind !== "charleston" || next.phase.step.kind !== "collecting") {
      throw new Error("expected collecting phase");
    }
    expect(next.phase.step.received[1]).toEqual({ tiles, blind: true });
  });

  it("accepts jokers when allowJokersInCharleston is true", () => {
    const permissive: RuleConfig = {
      ...defaultConfig,
      charleston: { ...defaultConfig.charleston, allowJokersInCharleston: true },
    };
    const initial = makeInitialState({ ...baseOpts, config: permissive });
    const state = overrideHand(initial, 0, [
      joker,
      joker,
      joker,
      ...initial.players[0].hand.slice(3),
    ]);
    const result = reduce(state, pass(0, [joker, joker, joker]));
    expect(result.ok).toBe(true);
  });
});

describe("reduceCharlestonPass auto-transitions", () => {
  it("advances passIndex 0 → 1 and clears received after 4 passes", () => {
    const initial = makeInitialState(baseOpts);
    const after = applyPass(initial);
    if (after.phase.kind !== "charleston") throw new Error("expected charleston");
    if (after.phase.step.kind !== "collecting") {
      throw new Error("expected collecting");
    }
    expect(after.phase.step.passIndex).toBe(1);
    expect(after.phase.step.received).toEqual({});
  });

  it("transitions to stopWindow after pass 2 completes", () => {
    let state = makeInitialState(baseOpts);
    state = applyPass(state);
    state = applyPass(state);
    state = applyPass(state);
    expect(state.phase).toEqual({
      kind: "charleston",
      step: { kind: "stopWindow" },
    });
  });

  it("keeps East at 14 and others at 13 after each pass completes", () => {
    let state = makeInitialState(baseOpts);
    for (let i = 0; i < 3; i++) {
      state = applyPass(state);
      expect(state.players[0].hand).toHaveLength(14);
      expect(state.players[1].hand).toHaveLength(13);
      expect(state.players[2].hand).toHaveLength(13);
      expect(state.players[3].hand).toHaveLength(13);
    }
  });

  it("sends pass 0 tiles to recipient at offset +3 (Right)", () => {
    const initial = makeInitialState(baseOpts);
    const playerTiles = initial.players[0].hand.slice(0, 3);
    const after = applyPass(initial);
    // pass 0 = Right = offset +3, so player 0's tiles go to player 3.
    const player3Hand = after.players[3].hand;
    for (const tile of playerTiles) {
      expect(player3Hand.some((t: Tile) => serializeTile(t) === serializeTile(tile))).toBe(true);
    }
  });

  it("sends pass 1 tiles to recipient at offset +2 (Across)", () => {
    let state = makeInitialState(baseOpts);
    state = applyPass(state); // pass 0 done
    const player0PassTiles = state.players[0].hand.slice(0, 3);
    state = applyPass(state); // pass 1 done
    const player2Hand = state.players[2].hand;
    for (const tile of player0PassTiles) {
      expect(player2Hand.some((t: Tile) => serializeTile(t) === serializeTile(tile))).toBe(true);
    }
  });

  it("sends pass 2 tiles to recipient at offset +1 (Left)", () => {
    let state = makeInitialState(baseOpts);
    state = applyPass(state);
    state = applyPass(state);
    const player0PassTiles = state.players[0].hand.slice(0, 3);
    state = applyPass(state);
    const player1Hand = state.players[1].hand;
    for (const tile of player0PassTiles) {
      expect(player1Hand.some((t: Tile) => serializeTile(t) === serializeTile(tile))).toBe(true);
    }
  });
});

describe("reduceCharlestonPass tile conservation", () => {
  it("preserves the 152-tile multiset across pass 0, 1, 2 for a fixed seed", () => {
    const deck = makeStandardDeck();
    let state = makeInitialState(baseOpts);
    expect(multisetEqual(allTiles(state), deck)).toBe(true);
    state = applyPass(state);
    expect(multisetEqual(allTiles(state), deck)).toBe(true);
    state = applyPass(state);
    expect(multisetEqual(allTiles(state), deck)).toBe(true);
    state = applyPass(state);
    expect(multisetEqual(allTiles(state), deck)).toBe(true);
  });

  it("preserves the 152-tile multiset for any seed", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const deck = makeStandardDeck();
        let state = makeInitialState({ ...baseOpts, seed });
        state = applyPass(state);
        state = applyPass(state);
        state = applyPass(state);
        expect(multisetEqual(allTiles(state), deck)).toBe(true);
      }),
    );
  });
});

describe("reduceCharlestonPass mid-pass partial state", () => {
  it("records each player's pass without transitioning until the 4th", () => {
    let state = makeInitialState(baseOpts);
    for (const id of [0, 1, 2] as const) {
      const tiles = state.players[id].hand.slice(0, 3);
      state = step(state, pass(id, tiles));
      if (state.phase.kind !== "charleston" || state.phase.step.kind !== "collecting") {
        throw new Error("expected collecting");
      }
      expect(state.phase.step.passIndex).toBe(0);
      expect(state.phase.step.received[id]).toBeDefined();
    }
  });
});

describe("reduceCharlestonPass second-Charleston auto-transitions", () => {
  // These tests inject the state directly, exercising nextStep's branches for
  // the second-Charleston passes in isolation. The end-to-end path through the
  // real reducer is covered by the "full Charleston path" tests below.

  function withCollectingPass(state: GameState, passIndex: 3 | 4 | 5): GameState {
    return {
      ...state,
      phase: {
        kind: "charleston",
        step: { kind: "collecting", passIndex, received: {} },
      },
    };
  }

  it("advances passIndex 3 → 4 (Left pass)", () => {
    let state = withCollectingPass(makeInitialState(baseOpts), 3);
    state = applyPass(state);
    if (state.phase.kind !== "charleston" || state.phase.step.kind !== "collecting") {
      throw new Error("expected collecting");
    }
    expect(state.phase.step.passIndex).toBe(4);
    expect(state.phase.step.received).toEqual({});
  });

  it("advances passIndex 4 → 5 (Across pass)", () => {
    let state = withCollectingPass(makeInitialState(baseOpts), 4);
    state = applyPass(state);
    if (state.phase.kind !== "charleston" || state.phase.step.kind !== "collecting") {
      throw new Error("expected collecting");
    }
    expect(state.phase.step.passIndex).toBe(5);
    expect(state.phase.step.received).toEqual({});
  });

  it("advances passIndex 5 → courtesy step (Right pass)", () => {
    let state = withCollectingPass(makeInitialState(baseOpts), 5);
    state = applyPass(state);
    expect(state.phase).toEqual({
      kind: "charleston",
      step: { kind: "courtesy", offers: {} },
    });
  });
});

function halt(player: PlayerId): Action {
  return { kind: "charlestonHalt", player };
}

function toStopWindow(opts: typeof baseOpts = baseOpts): GameState {
  let state = makeInitialState(opts);
  state = applyPass(state);
  state = applyPass(state);
  state = applyPass(state);
  return state;
}

describe("reduceCharlestonHalt", () => {
  for (const id of PLAYER_IDS) {
    it(`accepts halt from player ${id} at stopWindow and advances to courtesy`, () => {
      const state = toStopWindow();
      const next = step(state, halt(id));
      expect(next.phase).toEqual({
        kind: "charleston",
        step: { kind: "courtesy", offers: {} },
      });
    });
  }

  it("leaves hands, wall, and discards untouched", () => {
    const state = toStopWindow();
    const next = step(state, halt(0));
    expect(next.wall).toEqual(state.wall);
    expect(next.discards).toEqual(state.discards);
    for (const id of PLAYER_IDS) {
      expect(next.players[id]).toEqual(state.players[id]);
    }
  });

  it("rejects halt during collecting (passIndex 0)", () => {
    const state = makeInitialState(baseOpts);
    const result = reduce(state, halt(0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrongPhase");
  });

  it("rejects halt during collecting (passIndex 3)", () => {
    let state = toStopWindow();
    state = step(state, pass(0, state.players[0].hand.slice(0, 3)));
    const result = reduce(state, halt(0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrongPhase");
  });

  it("rejects halt during courtesy", () => {
    const state = toStopWindow();
    const courtesy = step(state, halt(0));
    const result = reduce(courtesy, halt(0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrongPhase");
  });
});

describe("reduceCharlestonPass stopWindow exit", () => {
  it("accepts a pass at stopWindow and enters collecting passIndex 3", () => {
    const state = toStopWindow();
    const tiles = state.players[0].hand.slice(0, 3);
    const next = step(state, pass(0, tiles));
    if (next.phase.kind !== "charleston" || next.phase.step.kind !== "collecting") {
      throw new Error("expected collecting");
    }
    expect(next.phase.step.passIndex).toBe(3);
    expect(next.phase.step.received[0]).toEqual({ tiles, blind: false });
    expect(next.players[0].hand).toHaveLength(state.players[0].hand.length - 3);
  });

  it("rejects a joker pass at stopWindow when config forbids it", () => {
    const initial = toStopWindow();
    const state = overrideHand(initial, 0, [
      joker,
      flower,
      flower,
      ...initial.players[0].hand.slice(3),
    ]);
    const result = reduce(state, pass(0, [joker, flower, flower]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalidCharlestonPass");
    if (result.error.kind !== "invalidCharlestonPass") return;
    expect(result.error.reason).toBe("jokers may not be passed");
  });
});

describe("reduceCharlestonPass full Charleston (passes 0-5)", () => {
  function fullCharleston(state: GameState): GameState {
    let next = state;
    for (let i = 0; i < 6; i++) next = applyPass(next);
    return next;
  }

  it("reaches courtesy step after 24 passes", () => {
    const final = fullCharleston(makeInitialState(baseOpts));
    expect(final.phase).toEqual({
      kind: "charleston",
      step: { kind: "courtesy", offers: {} },
    });
  });

  it("preserves hand sizes (14 East, 13 others) after each completed pass", () => {
    let state = makeInitialState(baseOpts);
    for (let i = 0; i < 6; i++) {
      state = applyPass(state);
      expect(state.players[0].hand).toHaveLength(14);
      expect(state.players[1].hand).toHaveLength(13);
      expect(state.players[2].hand).toHaveLength(13);
      expect(state.players[3].hand).toHaveLength(13);
    }
  });

  it("sends pass 3 tiles to recipient at offset +1 (Left)", () => {
    let state = toStopWindow();
    const tiles = state.players[0].hand.slice(0, 3);
    state = applyPass(state);
    const player1Hand = state.players[1].hand;
    for (const tile of tiles) {
      expect(player1Hand.some((t) => serializeTile(t) === serializeTile(tile))).toBe(true);
    }
  });

  it("sends pass 4 tiles to recipient at offset +2 (Across)", () => {
    let state = toStopWindow();
    state = applyPass(state); // pass 3 done
    const tiles = state.players[0].hand.slice(0, 3);
    state = applyPass(state); // pass 4 done
    const player2Hand = state.players[2].hand;
    for (const tile of tiles) {
      expect(player2Hand.some((t) => serializeTile(t) === serializeTile(tile))).toBe(true);
    }
  });

  it("sends pass 5 tiles to recipient at offset +3 (Right)", () => {
    let state = toStopWindow();
    state = applyPass(state);
    state = applyPass(state);
    const tiles = state.players[0].hand.slice(0, 3);
    state = applyPass(state); // pass 5 done
    const player3Hand = state.players[3].hand;
    for (const tile of tiles) {
      expect(player3Hand.some((t) => serializeTile(t) === serializeTile(tile))).toBe(true);
    }
  });

  it("preserves the 152-tile multiset across all 6 passes for any seed", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const deck = makeStandardDeck();
        let state = makeInitialState({ ...baseOpts, seed });
        for (let i = 0; i < 6; i++) {
          state = applyPass(state);
          expect(multisetEqual(allTiles(state), deck)).toBe(true);
        }
      }),
    );
  });

  it("is deterministic — same seed + same actions yield equal final state", () => {
    const a = fullCharleston(makeInitialState(baseOpts));
    const b = fullCharleston(makeInitialState(baseOpts));
    expect(a).toEqual(b);
  });
});
