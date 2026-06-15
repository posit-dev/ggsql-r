# Create a ggsql htmlwidget

Create a `ggsql_vega` htmlwidget from a writer and spec.

## Usage

``` r
ggsql_widget(writer, spec, width = NULL, height = NULL, min_width = NULL)
```

## Arguments

- writer:

  A `Writer` object created by e.g.
  [`vegalite_writer()`](https://r.ggsql.org/reference/vegalite_writer.md).

- spec:

  A `Spec` object returned by
  [`ggsql_execute()`](https://r.ggsql.org/reference/ggsql_execute.md).

- width, height:

  Optional widget dimensions passed to
  [`htmlwidgets::createWidget()`](https://rdrr.io/pkg/htmlwidgets/man/createWidget.html).

- min_width:

  Optional minimum render width for small containers. When supplied, the
  widget renders at at least this width and scales down to fit narrower
  hosts.

## Value

An `htmlwidget` with class `ggsql_vega`.
