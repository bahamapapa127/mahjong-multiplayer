import type { PlayerId } from "./player.js";
import type { Tile } from "./tile.js";

export type CharlestonPassIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type CharlestonCourtesyCount = 0 | 1 | 2 | 3;

export type CharlestonReceived = Partial<
  Record<PlayerId, { readonly tiles: readonly Tile[]; readonly blind: boolean }>
>;

export type CharlestonStep =
  | {
      readonly kind: "collecting";
      readonly passIndex: CharlestonPassIndex;
      readonly received: CharlestonReceived;
    }
  | { readonly kind: "stopWindow" }
  | {
      readonly kind: "courtesy";
      readonly offers: Partial<Record<PlayerId, CharlestonCourtesyCount>>;
    };

export type GameOutcome =
  | {
      readonly kind: "mahjong";
      readonly winner: PlayerId;
      readonly handId: string;
      readonly claimedFrom: "wall" | PlayerId;
    }
  | { readonly kind: "wallGame" };

export type Phase =
  | { readonly kind: "charleston"; readonly step: CharlestonStep }
  | {
      readonly kind: "awaitingTurnAction";
      readonly player: PlayerId;
      readonly cameFrom: "wall" | "claim";
    }
  | {
      readonly kind: "awaitingClaimWindow";
      readonly discarder: PlayerId;
      readonly tile: Tile;
    }
  | { readonly kind: "terminal"; readonly outcome: GameOutcome };
