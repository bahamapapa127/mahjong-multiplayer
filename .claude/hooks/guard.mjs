// PreToolUse hook on Bash: block patterns that are almost always destructive.
// Exit 2 blocks the tool call; exit 0 allows it.
let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const cmd = payload?.tool_input?.command ?? "";

const dangerous = [
  { pattern: /\brm\s+-rf\s+\/(\s|$)/, reason: "rm -rf / (root)" },
  { pattern: /\brm\s+-rf\s+~(\s|\/|$)/, reason: "rm -rf ~ (home)" },
  { pattern: /\brm\s+-rf\s+\$HOME/, reason: "rm -rf $HOME" },
  { pattern: /\brm\s+-rf\s+\*(\s|$)/, reason: "rm -rf * (cwd contents)" },
  {
    pattern: /\bgit\s+push\s+(--force|-f)(\s+origin)?\s+(main|master)(\s|$)/,
    reason: "git push --force to main/master",
  },
  {
    pattern: /\bgit\s+reset\s+--hard\s+origin\//,
    reason: "git reset --hard origin/* (discards local commits)",
  },
  {
    pattern: /\bgit\s+clean\s+-fd?x?\s*$/,
    reason: "git clean -fd (destructive, no path)",
  },
  {
    pattern: /\bgit\s+checkout\s+--?\s*\.\s*$/,
    reason: "git checkout -- . (discards all working changes)",
  },
  {
    pattern: /\bgit\s+restore\s+\.\s*$/,
    reason: "git restore . (discards all working changes)",
  },
];

for (const { pattern, reason } of dangerous) {
  if (pattern.test(cmd)) {
    process.stderr.write(
      `[claude-guard] Blocked: ${reason}\nCommand: ${cmd}\nIf this is intentional, ask the user explicitly before running.\n`,
    );
    process.exit(2);
  }
}

process.exit(0);
