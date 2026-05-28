import { describe, expect, it } from "vitest";
import type { Result } from "./result.js";
import { flower, joker, multisetEqual, unwrapErr, unwrapOk } from "./test-fixtures.js";

describe("unwrapOk", () => {
  it("returns the value when the result is ok", () => {
    const result: Result<number, string> = { ok: true, value: 42 };
    expect(unwrapOk(result)).toBe(42);
  });

  it("throws when the result is an error", () => {
    const result: Result<number, string> = { ok: false, error: "boom" };
    expect(() => unwrapOk(result)).toThrow(/boom/);
  });
});

describe("unwrapErr", () => {
  it("returns the error when the result is not ok", () => {
    const result: Result<number, string> = { ok: false, error: "boom" };
    expect(unwrapErr(result)).toBe("boom");
  });

  it("throws when the result is ok", () => {
    const result: Result<number, string> = { ok: true, value: 42 };
    expect(() => unwrapErr(result)).toThrow(/42/);
  });
});

describe("multisetEqual", () => {
  it("returns true for two equal multisets in different orders", () => {
    expect(multisetEqual([flower, joker], [joker, flower])).toBe(true);
  });

  it("returns false for arrays of different lengths", () => {
    expect(multisetEqual([flower], [flower, flower])).toBe(false);
  });

  it("returns false for equal-length arrays with different contents", () => {
    expect(multisetEqual([flower, flower], [flower, joker])).toBe(false);
  });
});
