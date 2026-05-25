/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "engine-no-node-core",
      severity: "error",
      comment:
        "packages/engine must be pure. No Node built-ins (fs, path, os, crypto, ...) " +
        "in non-test source. The seeded RNG and clock come from the caller.",
      from: {
        path: "^packages/engine/src/",
        pathNot: "\\.(test|spec)\\.ts$",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "engine-no-apps",
      severity: "error",
      comment:
        "packages/engine is a library. Dependency direction is apps -> engine, " +
        "never engine -> apps.",
      from: { path: "^packages/engine/" },
      to: { path: "^apps/" },
    },
    {
      name: "shared-no-workspace-imports",
      severity: "error",
      comment:
        "packages/shared is the bottom layer (types only). It cannot import from " +
        "engine, server, or web.",
      from: { path: "^packages/shared/" },
      to: { path: "^(packages/engine/|apps/)" },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies break tree-shaking and confuse refactors.",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
  },
};
