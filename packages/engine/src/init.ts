import type { Card } from "./card.js";
import type { RuleConfig } from "./config.js";
import type { PlayerId } from "./player.js";
import { makeSeededRng, shuffle } from "./rng.js";
import type { GameState, PlayerState, PlayerStateTuple } from "./state.js";
import { makeStandardDeck, type Tile } from "./tile.js";

export type InitOptions = {
  readonly config: RuleConfig;
  readonly seed: string;
  readonly card: Card;
  readonly east?: PlayerId;
};

function pickEast(rng: () => number): PlayerId {
  const idx = Math.floor(rng() * 4);
  if (idx === 1) return 1;
  if (idx === 2) return 2;
  if (idx === 3) return 3;
  return 0;
}

function makePlayer(id: PlayerId, hand: readonly Tile[]): PlayerState {
  return { id, hand, exposures: [], isDead: false };
}

/** Build a fresh `GameState` for the start of a hand: shuffled wall, East chosen or random, tiles dealt, Charleston entered. */
export function makeInitialState(opts: InitOptions): GameState {
  const rng = makeSeededRng(opts.seed);
  const wall = shuffle(makeStandardDeck(), rng);
  const east = opts.east ?? pickEast(rng);

  // Deal order is part of the deterministic contract: 13 to each player in
  // PlayerId order (0, 1, 2, 3), then 1 extra to East. Changing this changes
  // every recorded seed's resulting hands.
  const hands: [Tile[], Tile[], Tile[], Tile[]] = [
    wall.splice(0, 13),
    wall.splice(0, 13),
    wall.splice(0, 13),
    wall.splice(0, 13),
  ];
  hands[east].push(...wall.splice(0, 1));

  const players: PlayerStateTuple = [
    makePlayer(0, hands[0]),
    makePlayer(1, hands[1]),
    makePlayer(2, hands[2]),
    makePlayer(3, hands[3]),
  ];

  return {
    config: opts.config,
    seed: opts.seed,
    card: opts.card,
    wall,
    discards: [],
    players,
    east,
    currentTurn: east,
    phase: {
      kind: "charleston",
      step: { kind: "collecting", passIndex: 0, received: {} },
    },
  };
}
