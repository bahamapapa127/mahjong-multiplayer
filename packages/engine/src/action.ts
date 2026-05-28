import type { PlayerId } from "./player.js";
import type { Tile } from "./tile.js";

export type ClaimIntent =
  | { readonly kind: "pass" }
  | { readonly kind: "claimMahjong"; readonly handId: string }
  | {
      readonly kind: "claimExposure";
      readonly groupSize: 3 | 4 | 5;
      readonly ownTilesUsed: readonly Tile[];
    };

export type JokerSwap = {
  readonly exposureOwner: PlayerId;
  readonly exposureIndex: number;
  readonly ownTile: Tile;
};

export type Action =
  | {
      readonly kind: "charlestonPass";
      readonly player: PlayerId;
      readonly tiles: readonly Tile[];
      readonly blind: boolean;
    }
  | { readonly kind: "charlestonHalt"; readonly player: PlayerId }
  | {
      readonly kind: "courtesyPassDeclare";
      readonly player: PlayerId;
      readonly tiles: readonly Tile[];
    }
  | {
      readonly kind: "jokerSwap";
      readonly player: PlayerId;
      readonly swaps: readonly [JokerSwap, ...JokerSwap[]];
    }
  | { readonly kind: "discard"; readonly player: PlayerId; readonly tile: Tile }
  | {
      readonly kind: "declareMahjongSelfPick";
      readonly player: PlayerId;
      readonly handId: string;
    }
  | {
      readonly kind: "resolveClaimWindow";
      readonly discarder: PlayerId;
      readonly intents: Readonly<Record<PlayerId, ClaimIntent>>;
    }
  | {
      readonly kind: "challengeDeadHand";
      readonly challenger: PlayerId;
      readonly target: PlayerId;
    };
