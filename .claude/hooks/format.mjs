// PostToolUse hook: auto-format edited TS/JSON files with Biome.
// Skips silently if Biome isn't installed yet (e.g., before first `pnpm install`).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path;
if (!filePath) process.exit(0);
if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc)$/.test(filePath)) process.exit(0);

const isWindows = process.platform === "win32";
const biomeBin = join(projectDir, "node_modules", ".bin", isWindows ? "biome.cmd" : "biome");
if (!existsSync(biomeBin)) process.exit(0);

try {
  execFileSync(biomeBin, ["format", "--write", filePath], {
    stdio: "inherit",
    shell: isWindows,
  });
} catch {
  // Never fail the edit; formatting is best-effort.
}
