# ggsql (development version)

# ggsql 0.5.2

This release updates the bundled ggsql Rust library to 0.5.2 and moves display
and export over to the new native writers, with breaking changes to
`ggsql_widget()` and the `writer` knitr chunk option:

* The bundled ggsql Rust library has been updated to 0.5.2, bringing the new
  native hephaestus-based writers.
* New writers: `svg_writer()`, `pdf_writer()`, and `hep_writer()`, rendered
  natively by ggsql without any JavaScript round-trip. `vegalite_writer()` is
  deprecated and will be removed in a future release.
* `ggsql_save()` now exports SVG and PDF directly through the native writers,
  and also supports `.hep` output. PNG export converts the native SVG output
  with rsvg. The V8 package is no longer needed for rendering.
* Display has moved from Vega-Lite to a `.hep` plot document rendered in the
  browser by the hephaestus SVG renderer compiled to WebAssembly:
  * `ggsql_widget()` now takes a spec as its only required argument
    (`ggsql_widget(spec)`) and produces a `ggsql_hep` htmlwidget that re-lays
    out the plot as its container changes size, with fonts bundled.
  * The `min_width` argument has been removed; the new renderer re-layouts
    rather than scales, so narrow containers get a properly laid out plot.
  * The `writer` knitr chunk option now accepts `"hep"` (default for HTML
    output), `"svg"`, `"pdf"` (default for LaTeX output), and `"png"`. The old
    `"vegalite"`/`"vegalite_svg"`/`"vegalite_png"` values still work with a
    deprecation warning.
* `ggsql_widget()` is now exported as the public way to build an htmlwidget
  from a spec.
* Now works correctly on Windows ARM64 (#15)

# ggsql 0.3.3

* Declare correct Rust version dependency at 1.86
* Bump ggsql dependency to 0.3.3
* Patch ggsql dependency to work with Rust 1.86 so it works on CRAN build
  machine

# ggsql 0.3.2

* The vendored Rust crate archive is no longer shipped inside the source
  tarball. It is downloaded at install time from the matching GitHub
  Release (`vendor.tar.xz`) and verified against a sidecar SHA256. Override
  with `GGSQL_VENDOR_TARBALL`, `GGSQL_VENDOR_URL`, or `NOT_CRAN`.

# ggsql 0.3.1

* Initial CRAN submission.
