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

const baseOpts = makeOpts({ seed: "discard-test", east: 0 });

function discard(player: PlayerId, tile: Tile): Action {
  return { kind: "discard", player, tile };
}

function step(state: GameState, action: Action): GameState {
  return unwrapOk(reduce(state, action));
}

function toAwaitingTurnAction(opts: typeof baseOpts = baseOpts, player: PlayerId = 0): GameState {
  const initial = makeInitialState(opts);
  return {
    ...initial,
    currentTurn: player,
    phase: { kind: "awaitingTurnAction", player, cameFrom: "initialDeal" },
  };
}

function overrideHand(state: GameState, id: PlayerId, hand: readonly Tile[]): GameState {
  const players: PlayerStateTuple = [
    id === 0 ? { ...state.players[0], hand } : state.players[0],
    id === 1 ? { ...state.players[1], hand } : state.players[1],
    id === 2 ? { ...state.players[2], hand } : state.players[2],
    id === 3 ? { ...state.players[3], hand } : state.players[3],
  ];
  return { ...state, players };
}

function markDead(state: GameState, id: PlayerId): GameState {
  const players: PlayerStateTuple = [
    id === 0 ? { ...state.players[0], isDead: true } : state.players[0],
    id === 1 ? { ...state.players[1], isDead: true } : state.players[1],
    id === 2 ? { ...state.players[2], isDead: true } : state.players[2],
    id === 3 ? { ...state.players[3], isDead: true } : state.players[3],
  ];
  return { ...state, players };
}

function allTiles(state: GameState): Tile[] {
  const tiles: Tile[] = [...state.wall];
  for (const id of PLAYER_IDS) {
    tiles.push(...state.players[id].hand);
  }
  tiles.push(...state.discards);
  return tiles;
}

describe("reduceDiscard validation", () => {
  it("rejects at charleston phase", () => {
    const state = makeInitialState(baseOpts);
    const tile = state.players[0].hand[0];
    if (tile === undefined) throw new Error("expected non-empty hand");
    const result = reduce(state, discard(0, tile));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrongPhase");
  });

  it("rejects at awaitingClaimWindow", () => {
    const initial = makeInitialState(baseOpts);
    const tile = initial.players[0].hand[0];
    if (tile === undefined) throw new Error("expected non-empty hand");
    const state: GameState = {
      ...initial,
      phase: { kind: "awaitingClaimWindow", discarder: 0, tile },
    };
    const result = reduce(state, discard(0, tile));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrongPhase");
  });

  it("rejects at terminal", () => {
    const initial = makeInitialState(baseOpts);
    const tile = initial.players[0].hand[0];
    if (tile === undefined) throw new Error("expected non-empty hand");
    const state: GameState = {
      ...initial,
      phase: { kind: "terminal", outcome: { kind: "wallGame" } },
    };
    const result = reduce(state, discard(0, tile));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("wrongPhase");
  });

  it("rejects when another player tries to discard (notYourTurn)", () => {
    const state = toAwaitingTurnAction(baseOpts, 0);
    const tile = state.players[1].hand[0];
    if (tile === undefined) throw new Error("expected non-empty hand");
    const result = reduce(state, discard(1, tile));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("notYourTurn");
    if (result.error.kind !== "notYourTurn") return;
    expect(result.error.expected).toBe(0);
    expect(result.error.actual).toBe(1);
  });

  it("rejects joker discard when allowDiscardingJokers is false", () => {
    const strict: RuleConfig = {
      ...defaultConfig,
      jokers: { ...defaultConfig.jokers, allowDiscardingJokers: false },
    };
    const initial = toAwaitingTurnAction({ ...baseOpts, config: strict }, 0);
    const state = overrideHand(initial, 0, [joker, ...initial.players[0].hand.slice(1)]);
    const result = reduce(state, discard(0, joker));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalidDiscard");
    if (result.error.kind !== "invalidDiscard") return;
    expect(result.error.reason).toBe("jokers may not be discarded");
  });

  it("rejects tile not in hand", () => {
    const state = overrideHand(
      toAwaitingTurnAction(baseOpts, 0),
      0,
      Array.from({ length: 14 }, () => flower),
    );
    const result = reduce(state, discard(0, { suit: "crak", value: 1 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("tileNotInHand");
    if (result.error.kind !== "tileNotInHand") return;
    expect(result.error.player).toBe(0);
  });
});

describe("reduceDiscard happy path", () => {
  it("accepts a joker discard when allowDiscardingJokers is true (default)", () => {
    const initial = toAwaitingTurnAction(baseOpts, 0);
    const state = overrideHand(initial, 0, [joker, ...initial.players[0].hand.slice(1)]);
    const result = reduce(state, discard(0, joker));
    expect(result.ok).toBe(true);
  });

  it("removes the tile, appends to discards, opens claim window", () => {
    const initial = toAwaitingTurnAction(baseOpts, 0);
    const tile = initial.players[0].hand[0];
    if (tile === undefined) throw new Error("expected non-empty hand");
    const next = step(initial, discard(0, tile));

    expect(next.players[0].hand).toHaveLength(initial.players[0].hand.length - 1);
    expect(next.discards).toHaveLength(initial.discards.length + 1);
    expect(serializeTile(next.discards[next.discards.length - 1] as Tile)).toBe(
      serializeTile(tile),
    );
    expect(next.phase).toEqual({
      kind: "awaitingClaimWindow",
      discarder: 0,
      tile,
    });
  });

  it("leaves other players' hands untouched", () => {
    const initial = toAwaitingTurnAction(baseOpts, 0);
    const tile = initial.players[0].hand[0];
    if (tile === undefined) throw new Error("expected non-empty hand");
    const next = step(initial, discard(0, tile));
    for (const id of [1, 2, 3] as const) {
      expect(next.players[id].hand).toEqual(initial.players[id].hand);
    }
  });

  it("leaves state.currentTurn unchanged (claim resolution decides next)", () => {
    const initial = toAwaitingTurnAction(baseOpts, 0);
    const tile = initial.players[0].hand[0];
    if (tile === undefined) throw new Error("expected non-empty hand");
    const next = step(initial, discard(0, tile));
    expect(next.currentTurn).toBe(initial.currentTurn);
  });

  for (const player of PLAYER_IDS) {
    it(`works for discarder player ${player}`, () => {
      const initial = toAwaitingTurnAction(baseOpts, player);
      const tile = initial.players[player].hand[0];
      if (tile === undefined) throw new Error("expected non-empty hand");
      const next = step(initial, discard(player, tile));
      expect(next.phase).toEqual({ kind: "awaitingClaimWindow", discarder: player, tile });
      expect(next.players[player].hand).toHaveLength(initial.players[player].hand.length - 1);
    });
  }

  it("allows a dead player to discard (rules.md §10)", () => {
    const initial = markDead(toAwaitingTurnAction(baseOpts, 0), 0);
    const tile = initial.players[0].hand[0];
    if (tile === undefined) throw new Error("expected non-empty hand");
    const result = reduce(initial, discard(0, tile));
    expect(result.ok).toBe(true);
  });
});

describe("reduceDiscard invariants", () => {
  it("preserves the 152-tile multiset across a discard", () => {
    const deck = makeStandardDeck();
    const initial = toAwaitingTurnAction(baseOpts, 0);
    expect(multisetEqual(allTiles(initial), deck)).toBe(true);
    const tile = initial.players[0].hand[0];
    if (tile === undefined) throw new Error("expected non-empty hand");
    const next = step(initial, discard(0, tile));
    expect(multisetEqual(allTiles(next), deck)).toBe(true);
  });

  it("preserves the 152-tile multiset for any seed", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 16 }), (seed) => {
        const deck = makeStandardDeck();
        const initial = toAwaitingTurnAction({ ...baseOpts, seed }, 0);
        const tile = initial.players[0].hand[0];
        if (tile === undefined) throw new Error("expected non-empty hand");
        const next = step(initial, discard(0, tile));
        expect(multisetEqual(allTiles(next), deck)).toBe(true);
      }),
    );
  });

  it("is deterministic — same state + same action yields equal output", () => {
    const initial = toAwaitingTurnAction(baseOpts, 0);
    const tile = initial.players[0].hand[0];
    if (tile === undefined) throw new Error("expected non-empty hand");
    const a = step(initial, discard(0, tile));
    const b = step(initial, discard(0, tile));
    expect(a).toEqual(b);
  });
});
