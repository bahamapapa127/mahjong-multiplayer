import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type DragonColor,
  makeStandardDeck,
  parseTile,
  type Suit,
  type SuitedValue,
  serializeTile,
  type Tile,
  tilesEqual,
  type Wind,
} from "./tile.js";

const SUITS: readonly Suit[] = ["crak", "bam", "dot"];
const WINDS: readonly Wind[] = ["N", "E", "S", "W"];
const DRAGON_COLORS: readonly DragonColor[] = ["red", "green", "white"];
const SUITED_VALUES: readonly SuitedValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function countTiles(deck: Tile[], predicate: (t: Tile) => boolean): number {
  return deck.filter(predicate).length;
}

const suitArb = fc.constantFrom<Suit>("crak", "bam", "dot");
const windArb = fc.constantFrom<Wind>("N", "E", "S", "W");
const dragonArb = fc.constantFrom<DragonColor>("red", "green", "white");
const valueArb = fc.constantFrom<SuitedValue>(1, 2, 3, 4, 5, 6, 7, 8, 9);

const tileArb: fc.Arbitrary<Tile> = fc.oneof(
  fc.record({ suit: suitArb, value: valueArb }),
  fc.record({ honor: fc.constant("wind" as const), wind: windArb }),
  fc.record({ honor: fc.constant("dragon" as const), color: dragonArb }),
  fc.constant({ honor: "flower" as const }),
  fc.constant({ honor: "joker" as const }),
);

describe("makeStandardDeck", () => {
  it("returns exactly 152 tiles", () => {
    expect(makeStandardDeck()).toHaveLength(152);
  });

  it("contains 36 crak, 36 bam, 36 dot tiles", () => {
    const deck = makeStandardDeck();
    expect(countTiles(deck, (t) => "suit" in t && t.suit === "crak")).toBe(36);
    expect(countTiles(deck, (t) => "suit" in t && t.suit === "bam")).toBe(36);
    expect(countTiles(deck, (t) => "suit" in t && t.suit === "dot")).toBe(36);
  });

  it("contains 4 of each suited value in each suit", () => {
    const deck = makeStandardDeck();
    for (const suit of SUITS) {
      for (const value of SUITED_VALUES) {
        expect(countTiles(deck, (t) => "suit" in t && t.suit === suit && t.value === value)).toBe(
          4,
        );
      }
    }
  });

  it("contains 16 winds total with 4 of each direction", () => {
    const deck = makeStandardDeck();
    expect(countTiles(deck, (t) => "honor" in t && t.honor === "wind")).toBe(16);
    for (const wind of WINDS) {
      expect(countTiles(deck, (t) => "honor" in t && t.honor === "wind" && t.wind === wind)).toBe(
        4,
      );
    }
  });

  it("contains 12 dragons total with 4 of each color", () => {
    const deck = makeStandardDeck();
    expect(countTiles(deck, (t) => "honor" in t && t.honor === "dragon")).toBe(12);
    for (const color of DRAGON_COLORS) {
      expect(
        countTiles(deck, (t) => "honor" in t && t.honor === "dragon" && t.color === color),
      ).toBe(4);
    }
  });

  it("contains 8 flowers", () => {
    expect(countTiles(makeStandardDeck(), (t) => "honor" in t && t.honor === "flower")).toBe(8);
  });

  it("contains 8 jokers", () => {
    expect(countTiles(makeStandardDeck(), (t) => "honor" in t && t.honor === "joker")).toBe(8);
  });

  it("returns a fresh array on each call", () => {
    const a = makeStandardDeck();
    const b = makeStandardDeck();
    expect(a).not.toBe(b);
    a.pop();
    expect(b).toHaveLength(152);
  });
});

describe("tilesEqual", () => {
  it("returns true for two equal suited tiles", () => {
    expect(tilesEqual({ suit: "crak", value: 5 }, { suit: "crak", value: 5 })).toBe(true);
  });

  it("returns false for same suit but different value", () => {
    expect(tilesEqual({ suit: "crak", value: 5 }, { suit: "crak", value: 7 })).toBe(false);
  });

  it("returns false for different suit but same value", () => {
    expect(tilesEqual({ suit: "crak", value: 5 }, { suit: "bam", value: 5 })).toBe(false);
  });

  it("returns true for two equal wind tiles", () => {
    expect(tilesEqual({ honor: "wind", wind: "N" }, { honor: "wind", wind: "N" })).toBe(true);
  });

  it("returns false for different wind directions", () => {
    expect(tilesEqual({ honor: "wind", wind: "N" }, { honor: "wind", wind: "E" })).toBe(false);
  });

  it("returns true for two equal dragon tiles", () => {
    expect(tilesEqual({ honor: "dragon", color: "red" }, { honor: "dragon", color: "red" })).toBe(
      true,
    );
  });

  it("returns false for different dragon colors", () => {
    expect(tilesEqual({ honor: "dragon", color: "red" }, { honor: "dragon", color: "green" })).toBe(
      false,
    );
  });

  it("returns true for two flowers", () => {
    expect(tilesEqual({ honor: "flower" }, { honor: "flower" })).toBe(true);
  });

  it("returns true for two jokers", () => {
    expect(tilesEqual({ honor: "joker" }, { honor: "joker" })).toBe(true);
  });

  it("returns false for flower vs joker", () => {
    expect(tilesEqual({ honor: "flower" }, { honor: "joker" })).toBe(false);
  });

  it("returns false for suited vs honor", () => {
    expect(tilesEqual({ suit: "crak", value: 5 }, { honor: "flower" })).toBe(false);
    expect(tilesEqual({ honor: "wind", wind: "N" }, { suit: "crak", value: 5 })).toBe(false);
  });

  it("returns false for different honor kinds with same shape", () => {
    expect(tilesEqual({ honor: "wind", wind: "N" }, { honor: "dragon", color: "red" })).toBe(false);
    expect(tilesEqual({ honor: "wind", wind: "N" }, { honor: "flower" })).toBe(false);
    expect(tilesEqual({ honor: "dragon", color: "red" }, { honor: "joker" })).toBe(false);
  });
});

describe("serializeTile", () => {
  it("serializes craks as c1..c9", () => {
    expect(serializeTile({ suit: "crak", value: 1 })).toBe("c1");
    expect(serializeTile({ suit: "crak", value: 9 })).toBe("c9");
  });

  it("serializes bams as b1..b9", () => {
    expect(serializeTile({ suit: "bam", value: 5 })).toBe("b5");
  });

  it("serializes dots as d1..d9", () => {
    expect(serializeTile({ suit: "dot", value: 3 })).toBe("d3");
  });

  it("serializes winds as wN/wE/wS/wW", () => {
    expect(serializeTile({ honor: "wind", wind: "N" })).toBe("wN");
    expect(serializeTile({ honor: "wind", wind: "E" })).toBe("wE");
    expect(serializeTile({ honor: "wind", wind: "S" })).toBe("wS");
    expect(serializeTile({ honor: "wind", wind: "W" })).toBe("wW");
  });

  it("serializes dragons as Dr/Dg/Dw", () => {
    expect(serializeTile({ honor: "dragon", color: "red" })).toBe("Dr");
    expect(serializeTile({ honor: "dragon", color: "green" })).toBe("Dg");
    expect(serializeTile({ honor: "dragon", color: "white" })).toBe("Dw");
  });

  it("serializes flower as F", () => {
    expect(serializeTile({ honor: "flower" })).toBe("F");
  });

  it("serializes joker as J", () => {
    expect(serializeTile({ honor: "joker" })).toBe("J");
  });
});

describe("parseTile", () => {
  it("round-trips every tile in the standard deck", () => {
    for (const tile of makeStandardDeck()) {
      const parsed = parseTile(serializeTile(tile));
      expect(parsed).not.toBeNull();
      expect(tilesEqual(parsed as Tile, tile)).toBe(true);
    }
  });

  it("parses suited tiles correctly", () => {
    expect(parseTile("c1")).toEqual({ suit: "crak", value: 1 });
    expect(parseTile("b9")).toEqual({ suit: "bam", value: 9 });
    expect(parseTile("d5")).toEqual({ suit: "dot", value: 5 });
  });

  it("parses wind tiles correctly", () => {
    expect(parseTile("wN")).toEqual({ honor: "wind", wind: "N" });
    expect(parseTile("wE")).toEqual({ honor: "wind", wind: "E" });
    expect(parseTile("wS")).toEqual({ honor: "wind", wind: "S" });
    expect(parseTile("wW")).toEqual({ honor: "wind", wind: "W" });
  });

  it("parses dragon tiles correctly", () => {
    expect(parseTile("Dr")).toEqual({ honor: "dragon", color: "red" });
    expect(parseTile("Dg")).toEqual({ honor: "dragon", color: "green" });
    expect(parseTile("Dw")).toEqual({ honor: "dragon", color: "white" });
  });

  it("parses flower as F", () => {
    expect(parseTile("F")).toEqual({ honor: "flower" });
  });

  it("parses joker as J", () => {
    expect(parseTile("J")).toEqual({ honor: "joker" });
  });

  it("returns null for empty string", () => {
    expect(parseTile("")).toBeNull();
  });

  it("returns null for single non-F/J character", () => {
    expect(parseTile("x")).toBeNull();
    expect(parseTile("c")).toBeNull();
  });

  it("returns null for out-of-range suited values", () => {
    expect(parseTile("c0")).toBeNull();
    expect(parseTile("c10")).toBeNull();
    expect(parseTile("cA")).toBeNull();
  });

  it("returns null for unknown wind direction", () => {
    expect(parseTile("wX")).toBeNull();
    expect(parseTile("wn")).toBeNull();
  });

  it("returns null for unknown dragon color", () => {
    expect(parseTile("Dx")).toBeNull();
    expect(parseTile("DR")).toBeNull();
  });

  it("returns null for case-mismatched prefixes", () => {
    expect(parseTile("dr")).toBeNull();
    expect(parseTile("C5")).toBeNull();
    expect(parseTile("W5")).toBe(null);
  });

  it("returns null for strings with whitespace", () => {
    expect(parseTile(" c1")).toBeNull();
    expect(parseTile("c1 ")).toBeNull();
  });

  it("returns null for strings longer than 2 characters that aren't F/J", () => {
    expect(parseTile("cc1")).toBeNull();
    expect(parseTile("null")).toBeNull();
    expect(parseTile("F5")).toBeNull();
  });

  it("returns null for unknown first-character prefixes", () => {
    expect(parseTile("xy")).toBeNull();
    expect(parseTile("ab")).toBeNull();
  });
});

describe("property: round-trip", () => {
  it("parseTile(serializeTile(t)) equals t for any valid Tile", () => {
    fc.assert(
      fc.property(tileArb, (t) => {
        const parsed = parseTile(serializeTile(t));
        return parsed !== null && tilesEqual(parsed, t);
      }),
    );
  });
});

describe("property: malformed input rejection", () => {
  it("parseTile(s) !== null implies serializeTile(parsed) === s", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const parsed = parseTile(s);
        if (parsed === null) return true;
        return serializeTile(parsed) === s;
      }),
    );
  });
});
