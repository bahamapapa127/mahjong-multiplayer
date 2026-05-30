import { describe, expect, it } from "vitest";
import type { PlayerId } from "./player.js";
import type { PlayerState, PlayerStateTuple } from "./state.js";
import { setPlayer } from "./state-update.js";

function makePlayer(id: PlayerId): PlayerState {
  return { id, hand: [], exposures: [], isDead: false };
}

const players: PlayerStateTuple = [makePlayer(0), makePlayer(1), makePlayer(2), makePlayer(3)];

describe("setPlayer", () => {
  it("replaces each slot while reusing the other three references", () => {
    for (const id of [0, 1, 2, 3] as const) {
      const next: PlayerState = { ...players[id], isDead: true };
      const updated = setPlayer(players, id, next);
      expect(updated[id]).toBe(next);
      for (const other of [0, 1, 2, 3] as const) {
        if (other === id) continue;
        expect(updated[other]).toBe(players[other]);
      }
    }
  });

  it("does not mutate the input tuple", () => {
    const snapshot = [...players];
    setPlayer(players, 2, { ...players[2], isDead: true });
    expect(players).toEqual(snapshot);
  });
});
