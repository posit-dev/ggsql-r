# srcts Build Design

## Goal

Add a minimal TypeScript + esbuild workflow for the htmlwidget runtime so that:

- `srcts/` becomes the source of truth for first-party widget code and JS tests.
- `inst/htmlwidgets/` contains generated package assets plus vendored third-party libraries.
- contributors can rebuild and verify generated assets with a small number of obvious commands.
- Node remains optional for normal R development and package checks.

## Non-Goals

- Replacing the vendored Vega update flow.
- Introducing a larger frontend toolchain such as Vite, webpack, ESLint, or Prettier.
- Performing a major runtime rewrite beyond modest modernization needed for the move.
- Making Node a required dependency for routine R testing.

## Constraints

- The JS workflow should stay accessible to contributors who are not primarily JS developers.
- Generated assets in `inst/` must be easy to verify against source in `srcts/`.
- The repo may be used without Node installed; JS-specific checks must skip cleanly in that case.
- The shipped widget asset remains `inst/htmlwidgets/ggsql_viz.js`.

## Proposed Layout

### Source tree

Create a new `srcts/` directory containing:

- `srcts/ggsql_viz.ts`: the widget runtime source.
- `srcts/ggsql-viz.test.ts`: widget lifecycle tests migrated from the current Node VM tests.
- `srcts/ggsql-viz-sizing.test.ts`: sizing helper tests migrated from the current Node tests.
- `srcts/build.mjs`: a tiny esbuild entrypoint that emits the package asset.

### Generated tree

Keep `inst/htmlwidgets/` as package-facing output:

- `inst/htmlwidgets/ggsql_viz.js`: generated from `srcts/ggsql_viz.ts`.
- `inst/htmlwidgets/ggsql_viz.css`: remains hand-maintained unless a later change justifies moving CSS into the build.
- `inst/htmlwidgets/lib/...`: vendored Vega dependencies, still updated by the existing shell helper.

This split keeps the ownership model simple:

- edit first-party runtime code in `srcts/`
- build into `inst/htmlwidgets/`
- commit both source and generated output

## Build Tooling

Add a small Node toolchain at repo root:

- `package.json`
- committed lockfile
- `tsconfig.json`

The scripts should stay narrow:

- `npm run build`: run `node srcts/build.mjs`
- `npm run test`: run the Node test suite for `srcts/`
- `npm run check`: run JS tests, rebuild the asset, and fail if the rebuild changes tracked files

`srcts/build.mjs` should use esbuild with one entrypoint and minimal options:

- entry: `srcts/ggsql_viz.ts`
- outfile: `inst/htmlwidgets/ggsql_viz.js`
- bundle enabled
- browser platform
- no minification by default
- output format compatible with the existing htmlwidgets runtime expectations

The build should favor readable emitted code over aggressive optimization. The main goal is maintainability.

## Verification Workflow

The source-of-truth check should be deterministic and easy to explain:

1. run the JS tests
2. rebuild `inst/htmlwidgets/ggsql_viz.js`
3. use git diff to confirm the rebuild did not change tracked files

This should live behind `npm run check`.

Add a small helper under `tools/` so R contributors and CI can invoke the same verification logic from the repo without knowing the Node details. The helper should:

- detect whether `node` and `npm` are available
- print a clear skip message and exit successfully when Node is absent
- otherwise run the JS verification command and surface failures directly

This keeps Node optional while still giving maintainers and CI a single enforcement command.

## Testing Strategy

### JS tests

Preserve the existing lightweight Node test approach:

- keep using Node’s built-in test runner
- migrate the existing VM-based tests from `inst/htmlwidgets/` into `srcts/`
- update paths and fixtures so the tests exercise the maintained source/build flow

The migration should remain behavior-preserving. The tests should continue covering:

- widget registration
- custom element lifecycle
- stale embed cleanup
- resize behavior
- compound sizing allocation
- no-mutation guarantees for sizing helpers

### R-side behavior

R tests should not require Node. Any R-facing verification hook must skip cleanly when Node is unavailable.

If an R test is added around the verifier helper, it should verify:

- skip behavior without Node
- successful invocation path when Node is present

That test should remain optional and quiet in ordinary package checks.

## Runtime Modernization Scope

The migration is a good opportunity for targeted modernization in the widget runtime:

- replace `var` with `const` and `let`
- add TypeScript types for widget state, layout objects, and helper inputs
- use smaller typed helper functions where they improve readability
- preserve the current browser-facing behavior and htmlwidgets integration

The implementation should avoid mixing infrastructure work with broad runtime redesign. The acceptable scope is:

- syntax modernization
- type annotations
- modest helper extraction
- small cleanup that makes the code easier to maintain

The implementation should not introduce unrelated behavior changes unless required to keep the migrated tests green.

## Contributor Workflow

The intended workflow for maintainers should be short:

1. edit files in `srcts/`
2. run `npm run check`
3. commit both `srcts/` changes and any generated updates in `inst/htmlwidgets/`

Documentation should be brief and task-oriented, likely in a contributor-facing doc or a short section in existing package documentation.

## Risks And Mitigations

### Risk: toolchain feels heavier than the value it provides

Mitigation:

- keep the Node surface area to TypeScript, esbuild, and the built-in test runner
- avoid adding lint and formatter tooling in this change
- provide a single obvious verification command

### Risk: generated assets drift from source

Mitigation:

- treat `srcts/` as the only first-party source of truth
- make `npm run check` fail on rebuild diffs
- expose the same verification path through a helper script for maintainers and CI

### Risk: Node becomes an accidental hard dependency

Mitigation:

- keep Node checks behind an optional helper
- make R-side hooks skip cleanly when Node is unavailable
- avoid wiring JS verification into default package checks in a way that hard-fails without Node

## Success Criteria

This design is successful when:

- the widget runtime is maintained from `srcts/` instead of editing `inst/htmlwidgets/ggsql_viz.js` directly
- contributors can run a minimal `npm run build` / `npm run check` workflow
- generated assets in `inst/` can be verified against source reproducibly
- Node is optional for non-JS contributors
- the migrated widget code is modestly modernized without a large behavior rewrite
