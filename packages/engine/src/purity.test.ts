import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("./", import.meta.url));

const bannedPatterns: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\bMath\.random\b/,
    reason: "Math.random — engine must use a seeded RNG passed in by the caller",
  },
  {
    pattern: /\bDate\.now\b/,
    reason: "Date.now — engine must take a clock from the caller",
  },
  {
    pattern: /\bperformance\.(now|timeOrigin)\b/,
    reason: "performance.now/timeOrigin — engine must take a clock from the caller",
  },
  {
    pattern: /\bnew\s+Date\s*\(\s*\)/,
    reason: "new Date() — engine must take a clock from the caller (new Date(arg) is OK)",
  },
  {
    pattern: /(?<![\w.])process\./,
    reason: "process.* — engine cannot read env, argv, or system info",
  },
  {
    pattern: /(?<![\w.])crypto\./,
    reason: "crypto.* — engine must use the seeded RNG, not system randomness",
  },
  {
    pattern: /(?<![\w.])set(?:Timeout|Interval|Immediate)\s*\(/,
    reason:
      "setTimeout/Interval/Immediate — engine must be synchronous; scheduling lives server-side",
  },
  {
    pattern: /\bqueueMicrotask\s*\(/,
    reason: "queueMicrotask — engine must be synchronous",
  },
  {
    pattern: /\brequire\s*\(/,
    reason: "require() — engine is ESM only",
  },
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(abs));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !/\.(test|spec)\.ts$/.test(entry.name)
    ) {
      out.push(abs);
    }
  }
  return out;
}

describe("engine purity", () => {
  const files = collectSourceFiles(srcDir);

  it("scans at least one source file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const absPath of files) {
    const relPath = relative(srcDir, absPath).replace(/\\/g, "/");
    it(`${relPath} contains no banned identifiers`, () => {
      const source = readFileSync(absPath, "utf8");
      for (const { pattern, reason } of bannedPatterns) {
        expect(source, reason).not.toMatch(pattern);
      }
    });
  }
});
