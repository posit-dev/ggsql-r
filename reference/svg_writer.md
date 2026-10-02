# Create a writer for a ggsql spec

Writers turn a `Spec` object (as returned by
[`ggsql_execute()`](https://r.ggsql.org/reference/ggsql_execute.md))
into an output artifact. ggsql provides the following writers:

## Usage

``` r
svg_writer(width = 600, height = 400, dpi = 96)

pdf_writer(width = 600, height = 400, dpi = 96)

hep_writer()
```

## Arguments

- width, height:

  Canvas dimensions in pixels. For `hep_writer()` these are hints to the
  consumer rather than a fixed size.

- dpi:

  Resolution of the canvas in dots per inch.

## Value

A `Writer` object.

## Details

- `svg_writer()`: A vector graphic in SVG format

- `pdf_writer()`: A vector graphic in PDF format

- `hep_writer()`: A `.hep` plot document — a self-contained description
  of the resolved plot that a consumer (e.g. the ggsql htmlwidget) can
  render and re-layout at any size

- [`vegalite_writer()`](https://r.ggsql.org/reference/vegalite_writer.md):
  A Vega-Lite JSON specification. **Deprecated** — the Vega-Lite backend
  is being phased out of ggsql in favour of the native writers above

## Examples

``` r
svg_writer()
#> <ggsql_writer> [svg]
pdf_writer()
#> <ggsql_writer> [pdf]
hep_writer()
#> <ggsql_writer> [hep]
```
