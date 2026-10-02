import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "..");

export const generatedAsset = "inst/htmlwidgets/ggsql_hep.js";

export async function buildWidget() {
  await esbuild.build({
    entryPoints: [path.join(moduleDir, "index.ts")],
    bundle: true,
    outfile: path.join(repoRoot, generatedAsset),
    format: "iife",
    // hephaestus-svg.js resolves its default wasm/font URLs against
    // import.meta.url at module scope; in an IIFE that is undefined and the
    // URL constructor throws while the bundle evaluates. Those defaults are
    // never used — the widget passes wasm and font bytes explicitly — so any
    // well-formed base keeps module evaluation safe.
    define: { "import.meta.url": "document.baseURI" },
    target: ["es2020"],
    sourcemap: false,
    platform: "browser",
  });
}
