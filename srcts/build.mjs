// Bundles srcts/index.ts → inst/htmlwidgets/ggsql_vega.js as an IIFE
// (immediately-invoked function expression) suitable for loading in a browser.
// Run via: npm run build

import { buildWidget } from "./build-lib.mjs";

buildWidget().catch((error) => {
  console.error(error);
  process.exit(1);
});
