import { describe, expect, it } from "vitest";
import type { Result } from "./result.js";

describe("Result", () => {
  it("constructs an ok variant and narrows when ok is true", () => {
    const result: Result<number, string> = { ok: true, value: 42 };
    if (result.ok) {
      expect(result.value).toBe(42);
      return;
    }
    throw new Error("expected ok variant");
  });

  it("constructs an err variant and narrows when ok is false", () => {
    const result: Result<number, string> = { ok: false, error: "boom" };
    if (!result.ok) {
      expect(result.error).toBe("boom");
      return;
    }
    throw new Error("expected err variant");
  });
});
