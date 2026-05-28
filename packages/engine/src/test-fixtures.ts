import type { Card } from "./card.js";
import type { RuleConfig } from "./config.js";
import type { InitOptions } from "./init.js";
import type { Result } from "./result.js";
import { serializeTile, type Tile } from "./tile.js";

export const defaultConfig: RuleConfig = {
  charleston: {
    allowBlindPasses: true,
    courtesyPass: true,
    allowJokersInCharleston: false,
  },
  jokers: { allowDiscardingJokers: true },
  play: { deadHandDetection: "manual" },
};

export const placeholderCard: Card = {
  id: "test-card",
  name: "Test",
  version: "0.0.0",
};

export const flower: Tile = { honor: "flower" };
export const joker: Tile = { honor: "joker" };

export function makeOpts(overrides: Partial<InitOptions> = {}): InitOptions {
  return {
    config: defaultConfig,
    seed: "seed-1",
    card: placeholderCard,
    ...overrides,
  };
}

export function multisetEqual(a: readonly Tile[], b: readonly Tile[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].map(serializeTile).sort();
  const sortedB = [...b].map(serializeTile).sort();
  return sortedA.every((t, i) => t === sortedB[i]);
}

export function unwrapOk<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`expected ok result, got error: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (result.ok) {
    throw new Error(`expected err result, got value: ${JSON.stringify(result.value)}`);
  }
  return result.error;
}
