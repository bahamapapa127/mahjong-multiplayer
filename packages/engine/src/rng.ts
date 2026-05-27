const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;
const UINT32_DIVISOR = 0x100000000;

function hashSeed(seed: string): number {
  let hash = FNV_OFFSET_BASIS_32;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME_32);
  }
  return hash >>> 0;
}

/** Build a deterministic PRNG seeded from a string. Each call returns a number in [0, 1). */
export function makeSeededRng(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_DIVISOR;
  };
}

/** Return a Fisher–Yates shuffle of `items` driven by `rng`. Input is not mutated. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    /* v8 ignore if -- @preserve unreachable: Fisher–Yates bounds guarantee in-range */
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}
