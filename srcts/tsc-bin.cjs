#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const rawArgs = process.argv.slice(2);
const args =
  rawArgs.length === 1 && rawArgs[0] === "tsconfig.json"
    ? ["-p", "tsconfig.json"]
    : rawArgs;

const tscCli = require.resolve("typescript/bin/tsc");
const result = spawnSync(process.execPath, [tscCli, ...args], {
  stdio: "inherit"
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
