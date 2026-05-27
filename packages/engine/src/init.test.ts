import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Card } from "./card.js";
import type { RuleConfig } from "./config.js";
import { type InitOptions, makeInitialState } from "./init.js";
import { PLAYER_IDS, type PlayerId } from "./player.js";
import { makeStandardDeck, serializeTile, type Tile } from "./tile.js";

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

function baseOpts(overrides: Partial<InitOptions> = {}): InitOptions {
  return {
    config: defaultConfig,
    seed: "seed-1",
    card: placeholderCard,
    ...overrides,
  };
}

function multisetEqual(a: readonly Tile[], b: readonly Tile[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].map(serializeTile).sort();
  const sortedB = [...b].map(serializeTile).sort();
  return sortedA.every((t, i) => t === sortedB[i]);
}

const playerIdArb = fc.constantFrom<PlayerId>(0, 1, 2, 3);
const seedArb = fc.string({ minLength: 1, maxLength: 32 });

describe("makeInitialState", () => {
  it("is deterministic for identical options", () => {
    const a = makeInitialState(baseOpts());
    const b = makeInitialState(baseOpts());
    expect(a).toStrictEqual(b);
  });

  it("leaves 99 tiles in the wall after dealing", () => {
    const state = makeInitialState(baseOpts());
    expect(state.wall).toHaveLength(99);
  });

  it("deals 14 tiles to East and 13 to each other player", () => {
    const state = makeInitialState(baseOpts({ east: 2 }));
    expect(state.players[2].hand).toHaveLength(14);
    for (const id of PLAYER_IDS) {
      if (id === 2) continue;
      expect(state.players[id].hand).toHaveLength(13);
    }
  });

  it("starts with empty discards", () => {
    const state = makeInitialState(baseOpts());
    expect(state.discards).toHaveLength(0);
  });

  it("sets currentTurn to East", () => {
    const state = makeInitialState(baseOpts({ east: 3 }));
    expect(state.currentTurn).toBe(3);
  });

  it("opens at Charleston collecting/pass-0 with no tiles received", () => {
    const state = makeInitialState(baseOpts());
    expect(state.phase).toEqual({
      kind: "charleston",
      step: { kind: "collecting", passIndex: 0, received: {} },
    });
  });

  it("honors an explicitly provided East", () => {
    for (const east of PLAYER_IDS) {
      const state = makeInitialState(baseOpts({ east }));
      expect(state.east).toBe(east);
      expect(state.players[east].hand).toHaveLength(14);
    }
  });

  it("picks East deterministically from the seed when omitted", () => {
    const a = makeInitialState(baseOpts());
    const b = makeInitialState(baseOpts());
    expect(a.east).toBe(b.east);
  });

  it("eventually picks every player as East across seeds", () => {
    const seen = new Set<PlayerId>();
    for (let i = 0; i < 50 && seen.size < 4; i++) {
      const state = makeInitialState(baseOpts({ seed: `seed-${i}` }));
      seen.add(state.east);
    }
    expect(seen.size).toBe(4);
  });

  it("produces different walls for different seeds", () => {
    const a = makeInitialState(baseOpts({ seed: "alpha" }));
    const b = makeInitialState(baseOpts({ seed: "beta" }));
    expect(a.wall).not.toEqual(b.wall);
  });

  it("preserves all 152 deck tiles across wall + hands (random East)", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const state = makeInitialState(baseOpts({ seed }));
        const allTiles: Tile[] = [
          ...state.wall,
          ...state.players[0].hand,
          ...state.players[1].hand,
          ...state.players[2].hand,
          ...state.players[3].hand,
        ];
        expect(allTiles).toHaveLength(152);
        expect(multisetEqual(allTiles, makeStandardDeck())).toBe(true);
      }),
    );
  });

  it("preserves all 152 deck tiles across wall + hands (provided East)", () => {
    fc.assert(
      fc.property(seedArb, playerIdArb, (seed, east) => {
        const state = makeInitialState(baseOpts({ seed, east }));
        const allTiles: Tile[] = [
          ...state.wall,
          ...state.players[0].hand,
          ...state.players[1].hand,
          ...state.players[2].hand,
          ...state.players[3].hand,
        ];
        expect(allTiles).toHaveLength(152);
        expect(multisetEqual(allTiles, makeStandardDeck())).toBe(true);
        expect(state.east).toBe(east);
      }),
    );
  });
});
