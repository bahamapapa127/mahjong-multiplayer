import type { Card } from "./card.js";
import type { RuleConfig } from "./config.js";
import type { Phase } from "./phase.js";
import type { PlayerId } from "./player.js";
import type { Tile } from "./tile.js";

export type Exposure = {
  readonly groupSize: 3 | 4 | 5;
  readonly baseTile: Tile;
  readonly jokerSlots: number;
};

export type PlayerState = {
  readonly id: PlayerId;
  readonly hand: readonly Tile[];
  readonly exposures: readonly Exposure[];
  readonly isDead: boolean;
};

export type PlayerStateTuple = readonly [PlayerState, PlayerState, PlayerState, PlayerState];

export type GameState = {
  readonly config: RuleConfig;
  readonly seed: string;
  readonly card: Card;
  readonly wall: readonly Tile[];
  readonly discards: readonly Tile[];
  readonly players: PlayerStateTuple;
  readonly east: PlayerId;
  readonly currentTurn: PlayerId;
  readonly phase: Phase;
};
