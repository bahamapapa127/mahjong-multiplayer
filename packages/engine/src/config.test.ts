import { describe, expect, it } from "vitest";
import type { RuleConfig } from "./config.js";

describe("RuleConfig", () => {
  it("constructs a config with NMJL-canonical defaults", () => {
    const config: RuleConfig = {
      charleston: {
        allowBlindPasses: true,
        courtesyPass: true,
        allowJokersInCharleston: false,
      },
      jokers: { allowDiscardingJokers: true },
      play: { deadHandDetection: "manual" },
    };
    expect(config.charleston.allowBlindPasses).toBe(true);
    expect(config.play.deadHandDetection).toBe("manual");
  });

  it("accepts 'auto' for deadHandDetection", () => {
    const config: RuleConfig = {
      charleston: {
        allowBlindPasses: false,
        courtesyPass: false,
        allowJokersInCharleston: true,
      },
      jokers: { allowDiscardingJokers: false },
      play: { deadHandDetection: "auto" },
    };
    expect(config.play.deadHandDetection).toBe("auto");
  });
});
