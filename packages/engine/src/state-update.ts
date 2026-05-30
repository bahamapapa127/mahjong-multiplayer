import type { PlayerId } from "./player.js";
import type { PlayerState, PlayerStateTuple } from "./state.js";

/** Return a new player tuple with `id`'s slot replaced by `next`; the other three slots are reused unchanged. */
export function setPlayer(
  players: PlayerStateTuple,
  id: PlayerId,
  next: PlayerState,
): PlayerStateTuple {
  if (id === 0) return [next, players[1], players[2], players[3]];
  if (id === 1) return [players[0], next, players[2], players[3]];
  if (id === 2) return [players[0], players[1], next, players[3]];
  return [players[0], players[1], players[2], next];
}
