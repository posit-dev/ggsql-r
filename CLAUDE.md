# CLAUDE.md

Guidance for working on the **ggsql** R package.

## What this package is

R bindings to the [ggsql](https://ggsql.org) Rust visualization library.
ggsql is “SQL + grammar-of-graphics” — queries look like SQL with extra
`VISUALIZE ... DRAW ...` clauses. This package exposes a ggsql `Reader`
/ `Spec` / `Writer` pipeline to R, plus a **knitr engine**
([ggsql](https://r.ggsql.org) chunks) that makes it usable from
Rmarkdown and Quarto, with bidirectional data flow between R, Python,
and ggsql chunks.

Homepage: <https://r.ggsql.org> · Repo: posit-dev/ggsql-r

## Architecture at a glance

    R code (R/*.R)
       │
       │  R6 wrappers (Reader, Spec, Writer) → .ptr → extendr-wrappers.R
       ▼
    extendr FFI (.Call into src/rust/...)
       │
       ▼
    Rust crate src/rust/  (depends on `ggsql` crate + polars + duckdb + extendr-api)

- Data crosses the FFI as **Arrow IPC stream bytes** — never as R lists.
  R side uses `nanoarrow` (`R/convert.R` → `df_to_ipc` / `ipc_to_df`);
  Rust side uses `polars` `IpcStreamReader` / `IpcStreamWriter`.
- The three public R6 classes (`Reader`, `Spec`, `Writer` in
  `R/reader.R`, `R/spec.R`, `R/writer.R`) each hold a `.ptr` to a
  Rust-owned struct (`GgsqlReader`, `GgsqlSpec`, `GgsqlWriter` declared
  in `src/rust/src/lib.rs`). The exported functions (`ggsql_execute`,
  `ggsql_register`, `ggsql_render`, etc.) are thin R wrappers that
  dispatch through those pointers.
- `R/extendr-wrappers.R` is **auto-generated** by extendr — do not edit
  by hand. Regenerate with `rextendr::document()` after changing
  signatures in `src/rust/src/lib.rs`.

## Directory layout

| Path                                     | Purpose                                                                                                                                                                                                                                                                                                                            |
|------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `R/`                                     | R source. One file per concern: `reader.R`, `spec.R`, `writer.R`, `validate.R`, `render.R` (V8-based server-side Vega-Lite rendering to SVG/PNG), `engine.R` (knitr engine), `convert.R` (IPC helpers), `extendr-wrappers.R` (generated), `zzz.R` (onLoad via [`rlang::on_load`](https://rlang.r-lib.org/reference/on_load.html)). |
| `src/rust/`                              | Rust crate (`crate-type = staticlib`, library name `ggsql`). `src/lib.rs` is the single FFI surface. `Cargo.toml` pins the `ggsql` crate and polars features. `vendor.tar.xz` / `vendor-config.toml` enable offline CRAN builds.                                                                                                   |
| `src/Makevars.in`, `src/Makevars.win.in` | Templates with `@PLACEHOLDERS@`. `tools/config.R` fills them in at `configure` time.                                                                                                                                                                                                                                               |
| `configure` / `configure.win`            | Shell wrappers that invoke `Rscript tools/config.R`.                                                                                                                                                                                                                                                                               |
| `cleanup` / `cleanup.win`                | `rm -f src/Makevars{,.win}` — run by R CMD build after install.                                                                                                                                                                                                                                                                    |
| `tools/config.R`                         | Detects `DEBUG`, `NOT_CRAN`, webR/wasm target, vendor presence, and emits `src/Makevars{,.win}`.                                                                                                                                                                                                                                   |
| `tools/msrv.R`                           | Enforces Rust MSRV (read from DESCRIPTION `SystemRequirements`).                                                                                                                                                                                                                                                                   |
| `inst/ggsql.xml`                         | KDE-syntax highlighting definition installed for the knitr engine (added to Pandoc via `--syntax-definition`).                                                                                                                                                                                                                     |
| `srcts/`                                 | TypeScript source of truth for the htmlwidgets runtime. `srcts/index.ts` bundles to `inst/htmlwidgets/ggsql_vega.js`; `srcts/vega/*.test.ts` covers widget behavior in Node.                                                                                                                                                       |
| `inst/test_chunks.qmd`                   | Fixture Quarto doc used by engine tests.                                                                                                                                                                                                                                                                                           |
| `vignettes/`                             | Quarto vignettes (`ggsql.qmd`, `engine.qmd`). `VignetteBuilder: quarto`.                                                                                                                                                                                                                                                           |
| `tests/testthat/`                        | `test-engine.R`, `test-reader.R`, `test-spec.R`, `test-validate.R`, `test-writer.R` plus `_snaps/`.                                                                                                                                                                                                                                |
| `.github/workflows/`                     | `R-CMD-check.yaml` (macOS, Windows, Ubuntu × several R versions), `pkgdown.yaml`, `test-coverage.yaml`, `format-suggest.yaml`.                                                                                                                                                                                                     |
| `_pkgdown.yml`, `pkgdown/`               | pkgdown site config (deployed to r.ggsql.org).                                                                                                                                                                                                                                                                                     |
| `air.toml`                               | [Air](https://posit-dev.github.io/air/) formatter config (empty ⇒ defaults).                                                                                                                                                                                                                                                       |

## Build system

Two-stage: the `configure` script generates `src/Makevars` (or `.win`)
from `src/Makevars.in` via `tools/config.R`, then R CMD build runs the
normal Makevars. The Makevars shells out to
`cargo build --manifest-path=./rust/Cargo.toml`, producing a static lib
(`rust/target/<profile>/libggsql.a`) that gets linked into the package
`.so`.

Environment variables that affect the build (read in `tools/config.R`):

- `DEBUG` set → `cargo build` (no `--release`), implies `NOT_CRAN`.
- `NOT_CRAN` set → omit CRAN-required `-j 2 --offline` flags.
- On webR (`wasm32-unknown-emscripten`) → sets `--target`, uses
  `panic=abort` profile overrides.

When editing Rust: run `devtools::load_all()` (triggers `configure` and
recompiles) or `rextendr::document()` (also regenerates
`R/extendr-wrappers.R` + Rd). A normal `R CMD build` will rebuild on
install.

Offline/CRAN builds rely on `src/rust/vendor.tar.xz` (cargo vendor
archive). If you bump Rust deps, regenerate the archive so CRAN builds
keep working.

## TypeScript / JavaScript assets

`srcts/` is the source of truth for the browser-side widget code. The
built artifact checked into the package is
`inst/htmlwidgets/ggsql_vega.js`.

The browser-side visualization runtime lives in `srcts/`, while
`R/widget.R`, `R/shiny.R`, and `R/engine.R` are the main R entry points
that hand specs off to that runtime. Files under `inst/htmlwidgets/` are
generated package assets or vendored browser dependencies, so prefer
editing `srcts/` and rebuilding rather than patching built assets by
hand.

After making any change under `srcts/`, rebuild the generated asset with
`npm run build`. Before committing JS/TS changes, run `npm run check`;
it typechecks, rebuilds the bundle, runs the Node tests, and fails if
the checked-in generated asset drifted from the TypeScript source.

## The FFI contract

When adding or changing a Rust-exposed function:

1.  Edit `src/rust/src/lib.rs` — add an `#[extendr]` fn or impl method.
    Return `Robj`/`Nullable<…>` for nullable values; use `Raw` for byte
    buffers.
2.  Register the item in the `extendr_module! { ... }` macro at the
    bottom of `lib.rs`.
3.  Run `rextendr::document()` to regenerate `R/extendr-wrappers.R` and
    the NAMESPACE `useDynLib` entries.
4.  Wrap the new binding in a friendly R function in the appropriate
    `R/*.R` file (validate inputs with
    [`rlang::check_required`](https://rlang.r-lib.org/reference/check_required.html)
    / `check_string`, error with
    [`cli::cli_abort`](https://cli.r-lib.org/reference/cli_abort.html)).
    Keep the pattern: exported R fn → R6 method → `.ptr$method(...)`
    call.

Data transfer: convert data frames to Arrow IPC with `df_to_ipc()`
before crossing the boundary, and back with `ipc_to_df()`. Factors are
coerced to character in `df_to_ipc` because nanoarrow doesn’t support
dictionary IPC encoding — keep this in mind when debugging column-type
surprises.

The Rust side currently uses `.expect("...")` liberally; errors surface
to R as panics caught by extendr and reported as R errors. Prefer
improving error messages in the R wrapper with `try_fetch` /
[`cli::cli_abort`](https://cli.r-lib.org/reference/cli_abort.html)
rather than propagating Rust-style messages.

## The knitr engine

Registered on load (`R/engine.R` bottom:
`on_load(knitr::knit_engines$set(ggsql = ggsql_engine))`). Key
behaviors:

- **Persistent reader per document**: `ggsql_env$reader` caches a
  default in-memory DuckDB reader across chunks. Custom
  `connection: "duckdb://..."` chunk option → cached per connection
  string in `ggsql_env$readers`.
- **`r:`/`py:` data refs**: `resolve_data_refs()` scans the query for
  `r:name` / `py:name`, pulls the object from
  [`knitr::knit_global()`](https://rdrr.io/pkg/knitr/man/knit_global.html)
  or
  [`reticulate::py`](https://rstudio.github.io/reticulate/reference/py.html),
  registers it as `__r_name__` / `__py_name__`, and rewrites the query.
  [`ggsql_table_names()`](https://r.ggsql.org/reference/ggsql_register.md)
  hides names matching `^__(ggsql|r|py)_`.
- **`sql.<tablename>` proxy**: injected into the knit global (and Python
  globals if reticulate is live) so later R/Python chunks can read back
  tables that a ggsql chunk created. Implemented as an S3 class
  `ggsql_tables` with `$`, `[[`, `names`, `print` methods.
- **Inline options**: lines prefixed with `--|` or `#|` at the top of a
  chunk are parsed as YAML and merged into chunk options (kebab-case →
  dot-case, so `fig-alt` becomes `fig.alt`). See
  `parse_chunk_options()`.
- **Writer selection**: chunk option `writer` = `vegalite` (default,
  HTML embed via vega-embed CDN), `vegalite_svg`, or `vegalite_png`.
  LaTeX output auto-selects `vegalite_png`. SVG/PNG rendering goes
  through V8 (see `R/render.R`, `get_vega_ctx`) and optionally `rsvg`
  for PNG.
- **`output.var`**: captures the result (data.frame for SQL, Vega-Lite
  JSON for visual) into the knit env instead of rendering.
- **Syntax highlighting**: `register_syntax_highlighting()` adds
  `inst/ggsql.xml` to `rmarkdown.pandoc.args` so Pandoc gets a ggsql
  definition. The chunk `class.source` defaults to `"sql"` as a
  fallback.

## Testing

`testthat` 3rd edition. Tests rely on:

- `ggsql_engine` being callable with a constructed `opts` list (see the
  `run_query()` helper in `test-engine.R`).
- Snapshot tests in `tests/testthat/_snaps/`.
- Some tests write CSVs to `tests/testthat/` and expect to clean up —
  watch for stray files in `figure/`.

Suggested packages used in tests: `gapminder`, `quarto`, `reticulate`,
`rsvg`, `V8`, `withr`. Gate usage with
[`rlang::check_installed()`](https://rlang.r-lib.org/reference/is_installed.html)
/ [`requireNamespace()`](https://rdrr.io/r/base/ns-load.html).

## Conventions

- Formatting: [Air](https://posit-dev.github.io/air/) — use 2-space
  indent, native pipe `|>`, no trailing whitespace.
  `format-suggest.yaml` enforces in CI.
- Error/message UX: always go through `cli`
  ([`cli::cli_abort`](https://cli.r-lib.org/reference/cli_abort.html),
  [`cli::cli_text`](https://cli.r-lib.org/reference/cli_text.html),
  [`cli::cli_bullets`](https://cli.r-lib.org/reference/cli_bullets.html)).
  Use inline `{.val ...}`, `{.code ...}`, `{.path ...}` styling.
- Argument validation at public boundaries:
  [`rlang::check_required()`](https://rlang.r-lib.org/reference/check_required.html),
  [`rlang::check_string()`](https://rlang.r-lib.org/reference/check_type_scalar.html),
  [`rlang::check_installed()`](https://rlang.r-lib.org/reference/is_installed.html).
- R6 classes are **not** cloneable (`cloneable = FALSE`) because they
  hold external pointers; never add `clone()` calls.
- Do not export the `Reader`/`Spec`/`Writer` R6 classes themselves —
  only the constructor/accessor functions. `$.GgsqlReader` etc. are
  exported only so extendr dispatch works.
- Roxygen 7.3.x with markdown. Regenerate docs with
  `devtools::document()` or `rextendr::document()` (the latter also
  handles the FFI wrappers).
- README is generated: edit `README.Rmd`, then re-knit to produce
  `README.md` and `man/figures/README-*`.

## Release / CRAN notes

- `SystemRequirements: Cargo (Rust's package manager), rustc` is
  required and enforced by `tools/msrv.R`.
- CRAN builds use `--offline -j 2` against the vendored crates in
  `src/rust/vendor.tar.xz`. Keep this archive in sync with `Cargo.lock`.
- The `_pkgdown.yml`, `docs/`, `pkgdown/`, `air.toml`, `.vscode/`,
  `codecov.yml`, `README.Rmd`, and `.github/` are already in
  `.Rbuildignore` — add new dev-only paths there when needed.
- `Config/rextendr/version` in DESCRIPTION should match the rextendr
  version used to generate the wrappers.

## Things that tend to trip people up

- Editing `R/extendr-wrappers.R` by hand — it gets clobbered on the next
  `rextendr::document()`. Put logic in `R/*.R` wrappers or in Rust.
- Forgetting to rerun the generator after changing Rust signatures —
  you’ll get `function not found` or argument-count errors at runtime.
- The `configure` script writes `src/Makevars` on every build; the
  `cleanup` script removes it afterwards. If you see a stale
  `src/Makevars` in git status, that’s expected — it’s
  gitignored/buildignored.
- `VISUALIZE`/`VISUALISE` spellings are both accepted by the ggsql
  parser — docs and examples mix them.
- IPC conversion coerces factors to character. If you’re round-tripping
  a data frame through ggsql and a column “loses” its factor class,
  that’s why.
- The in-memory DuckDB reader is shared across knitr chunks of the same
  document — tables registered in one chunk persist. Tests that touch
  the engine should either use a fresh connection or clean up
  explicitly.
