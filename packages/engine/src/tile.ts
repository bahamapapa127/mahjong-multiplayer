export type Suit = "crak" | "bam" | "dot";
export type Wind = "N" | "E" | "S" | "W";
export type DragonColor = "red" | "green" | "white";
export type SuitedValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Tile =
  | { suit: Suit; value: SuitedValue }
  | { honor: "wind"; wind: Wind }
  | { honor: "dragon"; color: DragonColor }
  | { honor: "flower" }
  | { honor: "joker" };

/** The three Mahjong suits — crak, bam, dot. */
export const SUITS: readonly Suit[] = ["crak", "bam", "dot"];
/** The four winds — N, E, S, W. */
export const WINDS: readonly Wind[] = ["N", "E", "S", "W"];
/** The three dragons — red, green, white. */
export const DRAGON_COLORS: readonly DragonColor[] = ["red", "green", "white"];
/** The nine suited tile values, 1 through 9. */
export const SUITED_VALUES: readonly SuitedValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const SUITED_VALUE_RE = /^[1-9]$/;

/** Structural equality on tiles — two tiles are equal iff their data matches. */
export function tilesEqual(a: Tile, b: Tile): boolean {
  if ("suit" in a) {
    return "suit" in b && a.suit === b.suit && a.value === b.value;
  }
  if (!("honor" in b)) {
    return false;
  }
  if (a.honor === "wind" && b.honor === "wind") {
    return a.wind === b.wind;
  }
  if (a.honor === "dragon" && b.honor === "dragon") {
    return a.color === b.color;
  }
  if (a.honor === "flower" && b.honor === "flower") {
    return true;
  }
  if (a.honor === "joker" && b.honor === "joker") {
    return true;
  }
  return false;
}

/** Render a tile as its compact string form (round-trippable through `parseTile`). */
export function serializeTile(t: Tile): string {
  if ("suit" in t) {
    if (t.suit === "crak") return `c${t.value}`;
    if (t.suit === "bam") return `b${t.value}`;
    return `d${t.value}`;
  }
  if (t.honor === "wind") return `w${t.wind}`;
  if (t.honor === "dragon") {
    if (t.color === "red") return "Dr";
    if (t.color === "green") return "Dg";
    return "Dw";
  }
  if (t.honor === "flower") return "F";
  return "J";
}

/** Parse a tile from its compact string form. Returns `null` on invalid input. */
export function parseTile(s: string): Tile | null {
  if (s === "F") return { honor: "flower" };
  if (s === "J") return { honor: "joker" };
  if (s.length !== 2) return null;

  const first = s.charAt(0);
  const second = s.charAt(1);

  if (first === "c" || first === "b" || first === "d") {
    if (!SUITED_VALUE_RE.test(second)) return null;
    const suit: Suit = first === "c" ? "crak" : first === "b" ? "bam" : "dot";
    return { suit, value: Number(second) as SuitedValue };
  }

  if (first === "w") {
    if (second !== "N" && second !== "E" && second !== "S" && second !== "W") {
      return null;
    }
    return { honor: "wind", wind: second };
  }

  if (first === "D") {
    if (second === "r") return { honor: "dragon", color: "red" };
    if (second === "g") return { honor: "dragon", color: "green" };
    if (second === "w") return { honor: "dragon", color: "white" };
    return null;
  }

  return null;
}

/** Build a fresh 152-tile American Mahjong deck. The result is mutable so callers can shuffle in place. */
export function makeStandardDeck(): Tile[] {
  const deck: Tile[] = [];
  for (const suit of SUITS) {
    for (const value of SUITED_VALUES) {
      for (let copy = 0; copy < 4; copy++) {
        deck.push({ suit, value });
      }
    }
  }
  for (const wind of WINDS) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push({ honor: "wind", wind });
    }
  }
  for (const color of DRAGON_COLORS) {
    for (let copy = 0; copy < 4; copy++) {
      deck.push({ honor: "dragon", color });
    }
  }
  for (let copy = 0; copy < 8; copy++) {
    deck.push({ honor: "flower" });
  }
  for (let copy = 0; copy < 8; copy++) {
    deck.push({ honor: "joker" });
  }
  return deck;
}
