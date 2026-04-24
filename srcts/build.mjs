// Bundles srcts/index.ts → inst/htmlwidgets/ggsql_vega.js as an IIFE
// (immediately-invoked function expression) suitable for loading in a browser.
// Run via: npm run build

import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

async function main() {
  await esbuild.build({
    entryPoints: [path.join(scriptDir, "index.ts")],
    bundle: true,
    outfile: path.join(repoRoot, "inst", "htmlwidgets", "ggsql_vega.js"),
    format: "iife",
    target: ["es2020"],
    sourcemap: false,
    platform: "browser",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
