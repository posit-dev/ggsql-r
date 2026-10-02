# Create a ggsql htmlwidget

Create a `ggsql_hep` htmlwidget from a spec. The spec is rendered to a
`.hep` plot document server-side and displayed in the browser with the
hephaestus SVG renderer compiled to WebAssembly, which re-lays out the
plot as its container changes size.

## Usage

``` r
ggsql_widget(spec, width = NULL, height = NULL)
```

## Arguments

- spec:

  A `Spec` object returned by
  [`ggsql_execute()`](https://r.ggsql.org/reference/ggsql_execute.md).

- width, height:

  Optional widget dimensions passed to
  [`htmlwidgets::createWidget()`](https://rdrr.io/pkg/htmlwidgets/man/createWidget.html).

## Value

An `htmlwidget` with class `ggsql_hep`.
