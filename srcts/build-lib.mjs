import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "..");

export const generatedAsset = "inst/htmlwidgets/ggsql_vega.js";

export async function buildWidget() {
  await esbuild.build({
    entryPoints: [path.join(moduleDir, "index.ts")],
    bundle: true,
    outfile: path.join(repoRoot, generatedAsset),
    format: "iife",
    target: ["es2020"],
    sourcemap: false,
    platform: "browser",
  });
}
