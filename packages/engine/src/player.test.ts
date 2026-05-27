import { describe, expect, it } from "vitest";
import { PLAYER_IDS, type PlayerId } from "./player.js";

describe("PlayerId", () => {
  it("indexes a 4-tuple in counterclockwise order", () => {
    const seats: readonly [string, string, string, string] = ["north", "east", "south", "west"];
    const id: PlayerId = 2;
    expect(seats[id]).toBe("south");
  });
});

describe("PLAYER_IDS", () => {
  it("lists 0 through 3 in order", () => {
    expect(PLAYER_IDS).toEqual([0, 1, 2, 3]);
  });
});
