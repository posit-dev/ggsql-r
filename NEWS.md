# ggsql (development version)

* `ggsql_widget()` is now exported as the public way to build a `ggsql_vega`
  htmlwidget from a writer and spec, e.g.
  `ggsql_widget(vegalite_writer(), spec)`.

* `ggsql_widget()` gains a `min_width` argument. When set, the widget renders
  at no less than that width and scales down to fit narrower hosts (useful for
  resizable panes and small Shiny layouts).

* Widgets no longer apply narrow-width scaling by default. Previously, any
  widget in a container narrower than 450px was rendered at 450px and
  CSS-scaled down to fit; now widgets render at their true host width unless
  you opt in via `min_width` (pass `min_width = 450` to restore the old
  behavior).

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
