# Save a ggsql spec to a file

This function renders a specification with one of the native ggsql
writers and writes it to disk. The format is derived from the file
extension: `.svg`, `.pdf`, and `.hep` are written directly by the
corresponding writer, `.png` is converted from the SVG output using the
rsvg package, and `.json` writes the (deprecated) Vega-Lite
representation.

## Usage

``` r
ggsql_save(spec, file, width = 600, height = 400, dpi = 96)
```

## Arguments

- spec:

  A `Spec` object returned by
  [`ggsql_execute()`](https://r.ggsql.org/reference/ggsql_execute.md).

- file:

  Output file path. Extension determines format: `.svg`, `.pdf`, `.hep`,
  `.png`, or `.json`.

- width:

  Width in pixels.

- height:

  Height in pixels.

- dpi:

  Resolution in dots per inch.

## Value

`file`, invisibly.

## Examples

``` r
reader <- duckdb_reader()
ggsql_register(reader, mtcars, "cars")
spec <- ggsql_execute(reader,
  "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
)
spec_file <- tempfile(fileext = ".svg")
ggsql_save(spec, spec_file)
```
