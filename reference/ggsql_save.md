# Save a ggsql spec to a file

This function renders a specification and returns it either as a
Vegalite json string, an SVG or a PNG. For the latter two, the Vegalite
JSON is rendered to SVG using the V8 package and, potentially, converted
to PNG using the rsvg package.

## Usage

``` r
ggsql_save(spec, file, width = 600, height = 400)
```

## Arguments

- spec:

  A `Spec` object returned by
  [`ggsql_execute()`](https://r.ggsql.org/reference/ggsql_execute.md).

- file:

  Output file path. Extension determines format: `.svg`, `.png`, or
  `.json`.

- width:

  Width in pixels.

- height:

  Height in pixels.

## Value

`file`, invisibly.

## Examples

``` r
reader <- duckdb_reader()
ggsql_register(reader, mtcars, "cars")
spec <- ggsql_execute(reader,
  "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
)
svg_file <- tempfile(fileext = ".svg")
ggsql_save(spec, svg_file)
```
