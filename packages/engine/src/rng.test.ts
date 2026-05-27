import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { makeSeededRng, shuffle } from "./rng.js";
import {
  type DragonColor,
  type Suit,
  type SuitedValue,
  serializeTile,
  type Tile,
  type Wind,
} from "./tile.js";

function collect(rng: () => number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rng());
  return out;
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

describe("makeSeededRng", () => {
  it("returns identical sequences for the same seed", () => {
    expect(collect(makeSeededRng("abc"), 20)).toEqual(collect(makeSeededRng("abc"), 20));
  });

  it("returns different sequences for different seeds", () => {
    expect(collect(makeSeededRng("a"), 5)).not.toEqual(collect(makeSeededRng("b"), 5));
  });

  it("produces values in [0, 1) over 1000 draws", () => {
    const rng = makeSeededRng("range");
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("handles an empty seed string", () => {
    const v = makeSeededRng("")();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("handles seeds with non-ASCII characters", () => {
    const v = makeSeededRng("日本🀄")();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});

describe("shuffle", () => {
  it("returns a permutation of the input", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = shuffle(input, makeSeededRng("p"));
    expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
  });

  it("does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5];
    const snapshot = [...input];
    shuffle(input, makeSeededRng("m"));
    expect(input).toEqual(snapshot);
  });

  it("is deterministic for the same rng seed", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(shuffle(input, makeSeededRng("seed"))).toEqual(shuffle(input, makeSeededRng("seed")));
  });

  it("returns a new array instance", () => {
    const input = [1, 2, 3];
    expect(shuffle(input, makeSeededRng("x"))).not.toBe(input);
  });

  it("returns a new empty array for an empty input", () => {
    const input: number[] = [];
    const out = shuffle(input, makeSeededRng("e"));
    expect(out).toEqual([]);
    expect(out).not.toBe(input);
  });

  it("returns a new single-element array unchanged", () => {
    const input = [42];
    const out = shuffle(input, makeSeededRng("s"));
    expect(out).toEqual([42]);
    expect(out).not.toBe(input);
  });
});

describe("property: shuffle preserves the multiset", () => {
  it("for any Tile[] and any seed", () => {
    fc.assert(
      fc.property(fc.array(tileArb), fc.string(), (tiles, seed) => {
        const shuffled = shuffle(tiles, makeSeededRng(seed));
        const a = tiles.map(serializeTile).sort();
        const b = shuffled.map(serializeTile).sort();
        return a.length === b.length && a.every((s, i) => s === b[i]);
      }),
    );
  });
});

describe("property: distinct seeds diverge", () => {
  it("first 10 outputs differ for any two distinct seed strings", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }), (s1, s2) => {
        fc.pre(s1 !== s2);
        const a = collect(makeSeededRng(s1), 10);
        const b = collect(makeSeededRng(s2), 10);
        return a.some((v, i) => v !== b[i]);
      }),
    );
  });
});
