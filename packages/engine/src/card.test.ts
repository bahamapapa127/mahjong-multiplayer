import { describe, expect, it } from "vitest";
import type { Card } from "./card.js";

describe("Card", () => {
  it("constructs a placeholder card with id, name, and version", () => {
    const card: Card = {
      id: "test-card-2026",
      name: "Test Card",
      version: "0.0.1",
    };
    expect(card.id).toBe("test-card-2026");
    expect(card.name).toBe("Test Card");
    expect(card.version).toBe("0.0.1");
  });
});
