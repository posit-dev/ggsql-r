# Create a DuckDB reader

Creates a DuckDB database connection that can execute SQL queries and
register data frames as queryable tables. The default creates an empty
in-memory database but you can also pass the path to a DuckDB database
to directly interact with that.

## Usage

``` r
duckdb_reader(database = NULL)
```

## Arguments

- database:

  Path to a DuckDB database file, or `NULL` (the default) for an
  in-memory database.

## Value

A `Reader` object.

## Examples

``` r
reader <- duckdb_reader()
ggsql_register(reader, mtcars, "cars")
df <- ggsql_execute_sql(reader, "SELECT mpg, disp FROM cars LIMIT 5")
```
