# Utility functions for visualization specifications

These functions allow you to extract various information from a `Spec`
object returned by
[`ggsql_execute()`](https://r.ggsql.org/reference/ggsql_execute.md).

## Usage

``` r
ggsql_metadata(spec)

ggsql_sql(spec)

ggsql_visual(spec)

ggsql_layer_count(spec)

ggsql_layer_data(spec, index = 1L)

ggsql_stat_data(spec, index = 1L)

ggsql_layer_sql(spec, index = 1L)

ggsql_stat_sql(spec, index = 1L)

ggsql_warnings(spec)
```

## Arguments

- spec:

  A `Spec` object as returned by
  [`ggsql_execute()`](https://r.ggsql.org/reference/ggsql_execute.md)

- index:

  Layer index

## Value

- `ggsql_metadata`: A list with elements `rows`, `columns`, and
  `layer_count`

- `ggsql_sql`: A character string with the SQL portion of the query

- `ggsql_visual`: A character string with the visual portion of the
  query

- `ggsql_layer_count`: An integer giving the number of layers

- `ggsql_layer_data`: A data frame, or `NULL` if no data is available
  for this layer

- `ggsql_stat_data`: A data frame, or `NULL` if the layer doesn't use a
  stat transform

- `ggsql_layer_sql`: A character string with the SQL query used by the
  layer to fetch its data, or `NULL` if the layer doesn't have any data.

- `ggsql_stat_sql`: A character string with the SQL query used by the
  layers stat transform, or `NULL` if the layer doesn't have a stat
  transform.

- `ggsql_warnings`: A data.frame with columns `message`, `line`, and
  `column` giving the validation warnings for the spec

## Examples

``` r
reader <- duckdb_reader()
ggsql_register(reader, mtcars, "cars")
spec <- ggsql_execute(reader,
  "SELECT * FROM cars VISUALISE mpg AS x DRAW histogram"
)

ggsql_metadata(spec)
#> $rows
#> [1] 17
#> 
#> $columns
#> [1] "fill"    "stroke"  "pos2"    "opacity" "pos1end" "pos1"    "pos2end"
#> 
#> $layer_count
#> [1] 1
#> 

ggsql_visual(spec)
#> [1] "VISUALISE mpg AS x DRAW histogram"
```
