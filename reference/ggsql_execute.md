# Execute a ggsql query

Parses the query, and execute it against the reader's database. Returns
either a visualization specification ready for rendering
(`ggsql_execute`) or a data frame with the query result
(`ggsql_execute_sql`).

## Usage

``` r
ggsql_execute(reader, query)

ggsql_execute_sql(reader, query)
```

## Arguments

- reader:

  A `Reader` object created by
  [`duckdb_reader()`](https://r.ggsql.org/reference/duckdb_reader.md).

- query:

  A ggsql query string (SQL + VISUALISE clause).

## Value

A `Spec` object.

## Examples

``` r
reader <- duckdb_reader()
ggsql_register(reader, mtcars, "cars")
spec <- ggsql_execute(reader,
  "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
)
```
