import type { Phase } from "./phase.js";
import type { PlayerId } from "./player.js";
import type { Tile } from "./tile.js";

export type EngineError =
  | {
      readonly kind: "wrongPhase";
      readonly expected: readonly Phase["kind"][];
      readonly actual: Phase["kind"];
    }
  | {
      readonly kind: "notYourTurn";
      readonly expected: PlayerId;
      readonly actual: PlayerId;
    }
  | {
      readonly kind: "tileNotInHand";
      readonly player: PlayerId;
      readonly tile: Tile;
    }
  | {
      readonly kind: "invalidDiscard";
      readonly tile: Tile;
      readonly reason: string;
    }
  | { readonly kind: "invalidExposure"; readonly reason: string }
  | { readonly kind: "invalidJokerSwap"; readonly reason: string }
  | {
      readonly kind: "mahjongInError";
      readonly handId: string;
      readonly reason: string;
    }
  | { readonly kind: "invalidCharlestonPass"; readonly reason: string }
  | { readonly kind: "deadPlayerAction"; readonly player: PlayerId }
  | { readonly kind: "failedDeadHandChallenge"; readonly target: PlayerId }
  | { readonly kind: "unknown"; readonly message: string };
